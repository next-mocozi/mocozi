'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getMyPortfolioPath,
  TYPE_META,
  type PortfolioItemType,
} from '../_lib';
import {
  getMyPortfolio,
  createItem as apiCreateItem,
  updateItem as apiUpdateItem,
  deleteItem as apiDeleteItem,
} from '@/lib/portfolio-api';
import { invalidateMyPortfolio } from '@/hooks/useMyPortfolio';
import { confirmDialog } from '@/components/layout/ConfirmModal';
import { toCreatePayload, fromBackendItem } from '@/lib/portfolio-mapper';
import ProjectInterview from './_interview';
import ResearchForm from './_research';
import StudyForm from './_study';


/** 포트폴리오 항목 작성/수정 페이지
 *  - 신규 프로젝트(type=project) 추가 시: 대화형 인터뷰 UI (_interview.tsx)
 *  - 그 외(스터디 등) 또는 기존 항목 편집: 아래 단순 폼
 */
function PortfolioEditPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const isEdit = editIdParam !== null && Number.isFinite(Number(editIdParam));
  const initialTypeParam = searchParams.get('type');
  const initialType: PortfolioItemType =
    initialTypeParam && initialTypeParam in TYPE_META
      ? (initialTypeParam as PortfolioItemType)
      : 'project';

  // 권한 체크 — 로그인만 확인 (백엔드가 item 소유권을 검증)
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    setAccessChecked(true);
  }, [authLoading, user, router]);

  if (authLoading || !accessChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }
  if (!user) return null;

  // key={editIdParam ?? 'new'} — URL의 id가 바뀔 때 컴포넌트를 완전 재마운트해서
  // 이전 projectId 상태가 남아 loading effect 가드를 막는 문제 방지.
  if (initialType === 'project') return <ProjectInterview key={editIdParam ?? 'new'} />;
  if (initialType === 'research') return <ResearchForm key={editIdParam ?? 'new'} />;
  if (initialType === 'study') return <StudyForm key={editIdParam ?? 'new'} />;
  return <SimpleForm key={editIdParam ?? 'new'} />;
}

function SimpleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = editId !== null && Number.isFinite(editId);
  const initialTypeParam = searchParams.get('type');
  const initialType: PortfolioItemType =
    initialTypeParam && initialTypeParam in TYPE_META
      ? (initialTypeParam as PortfolioItemType)
      : 'project';

  const serverIdRef = useRef<string | null>(null);
  const [type, setType] = useState<PortfolioItemType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [period, setPeriod] = useState('');
  const [current, setCurrent] = useState(false);
  const [domain, setDomain] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [titleError, setTitleError] = useState('');
  // 저장/삭제 중 버튼 비활성화 — 빠른 중복 클릭으로 N개 생성/이중 호출 방지
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 편집 모드: 백엔드에서 기존 항목 로드
  useEffect(() => {
    if (!isEdit || editId === null) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await getMyPortfolio();
        if (cancelled) return;
        const found = (remote.items ?? []).find(
          (b) => new Date(b.createdAt).getTime() === editId,
        );
        if (found) {
          serverIdRef.current = found.id;
          const item = fromBackendItem(found);
          setType(item.type);
          setTitle(item.title);
          setDescription(item.description ?? '');
          setPeriod(item.period ?? '');
          setCurrent(item.current ?? false);
          setDomain(item.domain ?? '');
          setTags(item.tags ?? []);
        }
      } catch {
        // 로드 실패 시 기본 빈 폼 유지
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, editId]);

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, v]);
    setTagInput('');
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  };

  const handleSave = async () => {
    if (isSubmitting) return; // 중복 클릭 가드
    if (!title.trim()) {
      setTitleError('제목을 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    const localId = isEdit && editId !== null ? editId : Date.now();
    const payload = toCreatePayload({
      id: localId,
      serverId: serverIdRef.current ?? undefined,
      type,
      title: title.trim(),
      description: description.trim(),
      period: period.trim(),
      current,
      domain: domain.trim() || undefined,
      tags,
    });
    try {
      if (serverIdRef.current) {
        await apiUpdateItem(serverIdRef.current, payload);
      } else {
        const created = await apiCreateItem(payload);
        // 신규 저장 직후 serverIdRef 갱신 — 같은 폼에서 다시 누르면 update 로 분기되어 중복 생성 방지
        serverIdRef.current = created.id;
      }
    } catch {
      // 저장 실패 시 isSubmitting 만 해제하고 페이지 유지 (사용자가 재시도 가능)
      setIsSubmitting(false);
      return;
    }
    await invalidateMyPortfolio();
    router.push(getMyPortfolioPath());
  };

  const handleDelete = async () => {
    if (isSubmitting) return;
    if (!isEdit || editId === null) return;
    if (!(await confirmDialog('이 포트폴리오 항목을 삭제하시겠어요?'))) return;
    setIsSubmitting(true);
    if (serverIdRef.current) {
      try {
        await apiDeleteItem(serverIdRef.current);
      } catch {
        // 404 = 이미 삭제됨, 그 외도 무시 — 캐시 invalidate 후 화면 갱신만
      }
    }
    await invalidateMyPortfolio();
    router.push(getMyPortfolioPath());
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-2 sm:px-10 sm:py-2">
      {/* 헤더 */}
      <div
        style={{ marginTop: '1rem', marginBottom: '1.25rem' }}
        className="flex items-center justify-between"
      >
        <div>
          <Link
            href="/portfolio"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 포트폴리오로
          </Link>
          <h1 className="text-2xl font-bold">
            {isEdit ? '포트폴리오 수정' : '새 포트폴리오 항목'}
          </h1>
        </div>
      </div>

      <div className="space-y-6 bg-white p-8 shadow-sm sm:p-6">
        {/* 제목 — 카테고리는 항목 유형별로 별도 페이지에서 구현 예정 */}
        <h2
          style={{ marginBottom: '1rem' }}
          className="text-xl font-bold text-gray-900"
        >
          {TYPE_META[type].label} {isEdit ? '수정' : '추가'}
        </h2>

        {/* 제목 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError('');
            }}
            placeholder="예: 웹 포트폴리오 사이트"
            className={`w-full border px-4 py-2 text-sm outline-none focus:ring-2 ${
              titleError
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
            }`}
          />
          {titleError && (
            <p className="mt-1 text-xs text-red-500">{titleError}</p>
          )}
        </div>

        {/* 도메인 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            도메인 <span className="text-xs font-normal text-gray-400">(선택)</span>
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="예: 웹, AI, 핀테크"
            className="w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* 기간 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            기간
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="예: 2024.01 - 2024.03"
              className="flex-1 border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={current}
                onChange={(e) => setCurrent(e.target.checked)}
                className="h-4 w-4 border-gray-300"
              />
              진행중
            </label>
          </div>
        </div>

        {/* 설명 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="활동 내용, 역할, 성과 등을 자유롭게 작성해주세요."
            className="w-full resize-none border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* 태그 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            태그 / 기술 스택
          </label>
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="태그 입력 후 Enter (예: React)"
              className="flex-1 border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={addTag}
              className="bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              추가
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 bg-blue-50 px-2 py-1 text-xs text-blue-600"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-blue-400 hover:text-blue-700"
                    aria-label={`${t} 제거`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="mt-6 flex items-center justify-between gap-2">
        {isEdit ? (
          <button
            onClick={handleDelete}
            disabled={isSubmitting}
            className="border border-red-200 px-6 py-2.5 text-sm text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            삭제
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link
            href="/portfolio"
            className="border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="bg-blue-600 px-6 py-2.5 text-sm text-white shadow-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioEditPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" />}>
      <PortfolioEditPageContent />
    </Suspense>
  );
}
