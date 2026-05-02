'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { TYPE_META, type PortfolioItem } from '../page';

// TODO: 백엔드 연동 — `GET /api/portfolios/:id` 로 교체
//       (CLAUDE.md §11). 현재는 mock — localStorage 에서 로드.

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

/** 포트폴리오 항목 상세 페이지 */
export default function PortfolioItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const itemId = Number(id);
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      setItem(list.find((it) => it.id === itemId) ?? null);
    } catch {
      setItem(DEFAULT_ITEMS.find((it) => it.id === itemId) ?? null);
    } finally {
      setLoaded(true);
    }
  }, [itemId]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/portfolio"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← 포트폴리오로
        </Link>
        <div className="card text-center">
          <p className="text-gray-500">존재하지 않는 항목이에요.</p>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[item.type];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/portfolio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 포트폴리오로
      </Link>

      <div className="card mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}
          >
            {meta.label}
          </span>
          <span className="text-xs text-gray-500">{item.period}</span>
          {item.current && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              진행중
            </span>
          )}
        </div>

        <h1 className="mb-2 text-2xl font-bold">{item.title}</h1>
        {item.domain && (
          <p className="mb-4 text-sm text-gray-500">도메인 · {item.domain}</p>
        )}
        <p className="whitespace-pre-wrap text-gray-700">{item.description}</p>

        {item.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Link
            href={`/portfolio/edit?id=${item.id}`}
            className="btn-secondary text-sm"
          >
            수정
          </Link>
        </div>
      </div>
    </div>
  );
}
