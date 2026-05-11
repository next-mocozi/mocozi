'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getMyPortfolioPath,
  OWNER_STORAGE_KEY,
  TYPE_META,
  type PortfolioItem,
  type PortfolioItemType,
} from '../_lib';
import {
  syncItemToBackend,
  deleteItemFromBackend,
} from '@/lib/portfolio-mapper';
import ProjectInterview from './_interview';
import ResearchForm from './_research';
import StudyForm from './_study';

// TODO: 백엔드 연동
//   - GET    /api/portfolios/:id   로 초기값 로드 (편집 모드)
//   - POST   /api/portfolios       로 신규 생성
//   - PUT    /api/portfolios/:id   로 수정 저장
//   - DELETE /api/portfolios/:id   로 삭제
// (CLAUDE.md §11 TODO)

const ITEMS_STORAGE_KEY = 'mock_portfolio_items';

// 더미 fallback 제거 — 신규 사용자가 클릭 시 존재하지 않는 항목으로 라우팅되어
// 404 가 발생하던 문제 방지. localStorage 비어있으면 빈 배열로 시작.
const DEFAULT_ITEMS: PortfolioItem[] = [];

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

  // 권한 체크 — 로그인 + (편집 모드면) 소유자 일치
  const [accessChecked, setAccessChecked] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (isEdit) {
      try {
        const ownerId = localStorage.getItem(OWNER_STORAGE_KEY);
        if (ownerId && ownerId !== user.id) {
          setDenied(true);
          setAccessChecked(true);
          return;
        }
      } catch {
        // 읽기 실패 시 통과 (mock 한정)
      }
    }
    setAccessChecked(true);
  }, [authLoading, user, isEdit, router]);

  if (authLoading || !accessChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }
  if (!user) return null;
  if (denied) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link
          href="/portfolio"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← 포트폴리오로
        </Link>
        <div className="card text-center">
          <div className="mb-2 text-4xl">🚫</div>
          <p className="font-semibold text-gray-700">수정 권한이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500">
            이 항목은 다른 사용자의 포트폴리오에 속해 있어요.
          </p>
        </div>
      </div>
    );
  }

  // 프로젝트는 신규/수정 모두 대화형 인터뷰 UI 사용
  // (수정 시 _interview.tsx 가 mock_portfolio_details 에서 답변을 불러와 미리보기로 표시)
  if (initialType === 'project') return <ProjectInterview />;
  // 연구는 정형화된 단일 페이지 폼 (mock_research_details 에 저장)
  if (initialType === 'research') return <ResearchForm />;
  // 스터디는 스터디 전용 정형화된 폼 (mock_study_details 에 저장)
  if (initialType === 'study') return <StudyForm />;
  return <SimpleForm />;
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

  const [type, setType] = useState<PortfolioItemType>(initialType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [period, setPeriod] = useState('');
  const [current, setCurrent] = useState(false);
  const [domain, setDomain] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [titleError, setTitleError] = useState('');

  // 편집 모드: 기존 항목 로드
  useEffect(() => {
    if (!isEdit) return;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      const found = list.find((it) => it.id === editId);
      if (found) {
        setType(found.type);
        setTitle(found.title);
        setDescription(found.description);
        setPeriod(found.period);
        setCurrent(found.current);
        setDomain(found.domain ?? '');
        setTags(found.tags);
      }
    } catch {
      // 로드 실패 시 기본 빈 폼 유지
    }
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

  const handleSave = () => {
    if (!title.trim()) {
      setTitleError('제목을 입력해주세요.');
      return;
    }
    const payload: PortfolioItem = {
      id: isEdit && editId !== null ? editId : Date.now(),
      type,
      title: title.trim(),
      description: description.trim(),
      period: period.trim(),
      current,
      domain: domain.trim() || undefined,
      tags,
    };
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      const next = isEdit
        ? list.map((it) => (it.id === editId ? payload : it))
        : [...list, payload];
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패해도 이동은 진행
    }
    void syncItemToBackend(payload);
    router.push(getMyPortfolioPath());
  };

  const handleDelete = () => {
    if (!isEdit || editId === null) return;
    if (!confirm('이 포트폴리오 항목을 삭제하시겠어요?')) return;
    const deletedId = editId;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      const next = list.filter((it) => it.id !== editId);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 삭제 실패해도 이동은 진행
    }
    void deleteItemFromBackend(deletedId);
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

      <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm sm:p-6">
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
            className={`w-full rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 ${
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
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={current}
                onChange={(e) => setCurrent(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
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
            className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={addTag}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              추가
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
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
            className="rounded-full border border-red-200 px-6 py-2.5 text-sm text-red-500 hover:bg-red-50"
          >
            삭제
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link
            href="/portfolio"
            className="rounded-full border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            className="rounded-full bg-blue-600 px-6 py-2.5 text-sm text-white shadow-md hover:bg-blue-700"
          >
            저장
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
