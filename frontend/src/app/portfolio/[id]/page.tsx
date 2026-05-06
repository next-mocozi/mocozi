'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  MAX_FEATURED,
  OWNER_STORAGE_KEY,
  VISIBILITY_STORAGE_KEY,
  type PortfolioItem,
  type PortfolioVisibility,
} from '../page';
import { type Draft } from '../edit/_interview';
import type { ResearchDetail } from '../edit/_research';
import type { StudyDetail } from '../edit/_study';
import { PortfolioItemView } from './_PortfolioItemView';

// TODO: 백엔드 연동 — `GET /api/portfolios/:id` 로 교체
//       (CLAUDE.md §11). 현재는 mock — localStorage 에서 로드.

const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const DETAILS_STORAGE_KEY = 'mock_portfolio_details';
const RESEARCH_DETAILS_KEY = 'mock_research_details';
const STUDY_DETAILS_KEY = 'mock_study_details';

const DEFAULT_ITEMS: PortfolioItem[] = [];

/** 포트폴리오 항목 상세 페이지 — 인터뷰 미리보기(SummaryView)와 동일한 양식으로 표시 */
export default function PortfolioItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = use(params);
  const itemId = id;
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [details, setDetails] = useState<Draft | null>(null);
  const [research, setResearch] = useState<ResearchDetail | null>(null);
  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<PortfolioVisibility>('private');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      setItem(list.find((it) => it.id === itemId) ?? null);
    } catch {
      setItem(DEFAULT_ITEMS.find((it) => it.id === itemId) ?? null);
    }
    try {
      const raw = localStorage.getItem(DETAILS_STORAGE_KEY);
      const map: Record<string, Draft> = raw ? JSON.parse(raw) : {};
      setDetails(map[String(itemId)] ?? null);
    } catch {
      setDetails(null);
    }
    try {
      const raw = localStorage.getItem(RESEARCH_DETAILS_KEY);
      const map: Record<string, ResearchDetail> = raw ? JSON.parse(raw) : {};
      setResearch(map[String(itemId)] ?? null);
    } catch {
      setResearch(null);
    }
    try {
      const raw = localStorage.getItem(STUDY_DETAILS_KEY);
      const map: Record<string, StudyDetail> = raw ? JSON.parse(raw) : {};
      setStudy(map[String(itemId)] ?? null);
    } catch {
      setStudy(null);
    }
    try {
      setOwnerId(localStorage.getItem(OWNER_STORAGE_KEY));
      const v = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      setVisibility(v === 'public' ? 'public' : 'private');
    } catch {
      // 기본값 유지
    }
    setLoaded(true);
  }, [authLoading, user, itemId, router]);

  if (authLoading || !loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }
  if (!user) return null;

  const isOwner = !ownerId || user.id === ownerId;
  if (!isOwner && visibility !== 'public') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/portfolio"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← 포트폴리오로
        </Link>
        <div className="card text-center">
          <div className="mb-2 text-4xl">🔒</div>
          <p className="font-semibold text-gray-700">비공개 포트폴리오입니다.</p>
          <p className="mt-1 text-sm text-gray-500">
            소유자만 이 항목을 볼 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  const toggleFeatured = () => {
    if (!item) return;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : [];
      const willBeFeatured = !item.featured;
      if (willBeFeatured) {
        const featuredCount = list.filter(
          (it) => it.featured && it.type !== 'study',
        ).length;
        if (featuredCount >= MAX_FEATURED) {
          alert(`대표 프로젝트는 최대 ${MAX_FEATURED}개까지만 지정할 수 있어요.`);
          return;
        }
      }
      const next = list.map((it) =>
        it.id === itemId ? { ...it, featured: willBeFeatured } : it,
      );
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
      setItem({ ...item, featured: willBeFeatured });
    } catch {
      // 저장 실패 무시
    }
  };

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Link
        href="/portfolio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 포트폴리오로
      </Link>

      <PortfolioItemView
        item={item}
        details={details}
        research={research}
        study={study}
        isOwner={isOwner}
        onToggleFeatured={toggleFeatured}
        showEditLink
      />
    </div>
  );
}
