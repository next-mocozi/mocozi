'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  TYPE_META,
  type PortfolioItem,
  type PortfolioItemType,
} from '../page';
import ProjectInterview from './_interview';

// TODO: 백엔드 연동
//   - GET    /api/portfolios/:id   로 초기값 로드 (편집 모드)
//   - POST   /api/portfolios       로 신규 생성
//   - PUT    /api/portfolios/:id   로 수정 저장
//   - DELETE /api/portfolios/:id   로 삭제
// (CLAUDE.md §11 TODO)

const ITEMS_STORAGE_KEY = 'mock_portfolio_items';

const DEFAULT_ITEMS: PortfolioItem[] = [
  {
    id: 1,
    type: 'project',
    title: '웹 포트폴리오 사이트',
    description: '개인 포트폴리오 웹사이트를 제작했습니다.',
    period: '2024.01 - 2024.03',
    current: false,
    domain: '웹',
    tags: ['Next.js', 'Tailwind'],
  },
  {
    id: 2,
    type: 'activity',
    title: '오픈소스 컨트리뷰톤',
    description: '오픈소스 프로젝트에 기여한 활동입니다.',
    period: '2024.01 - 현재',
    current: true,
    domain: '오픈소스',
    tags: ['Git', 'TypeScript'],
  },
];

/** 포트폴리오 항목 작성/수정 페이지
 *  - 신규 프로젝트(type=project) 추가 시: 대화형 인터뷰 UI (_interview.tsx)
 *  - 그 외(스터디 등) 또는 기존 항목 편집: 아래 단순 폼
 */
export default function PortfolioEditPage() {
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const isEdit = editIdParam !== null && Number.isFinite(Number(editIdParam));
  const initialTypeParam = searchParams.get('type');
  const initialType: PortfolioItemType =
    initialTypeParam && initialTypeParam in TYPE_META
      ? (initialTypeParam as PortfolioItemType)
      : 'project';

  // 프로젝트는 신규/수정 모두 대화형 인터뷰 UI 사용
  // (수정 시 _interview.tsx 가 mock_portfolio_details 에서 답변을 불러와 미리보기로 표시)
  if (initialType === 'project') return <ProjectInterview />;
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
    // TODO: POST/PUT /api/portfolios 호출 (현재는 mock 저장)
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
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
      const next = isEdit
        ? list.map((it) => (it.id === editId ? payload : it))
        : [...list, payload];
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패해도 이동은 진행
    }
    router.push('/portfolio');
  };

  const handleDelete = () => {
    if (!isEdit || editId === null) return;
    if (!confirm('이 포트폴리오 항목을 삭제하시겠어요?')) return;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      const next = list.filter((it) => it.id !== editId);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 삭제 실패해도 이동은 진행
    }
    router.push('/portfolio');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
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

      <div className="card space-y-6">
        {/* 카테고리 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            카테고리
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_META) as PortfolioItemType[]).map((t) => {
              const meta = TYPE_META[t];
              const selected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : `border-gray-200 ${meta.text} hover:bg-gray-50`
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

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
