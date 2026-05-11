'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { findMockFeedUser } from '@/lib/mock/portfolioFeed';
import {
  DEFAULT_ITEMS,
  FeaturedStar,
  MAX_FEATURED,
  MAX_FEATURED_RESEARCH,
  MAX_FEATURED_STUDY,
  ITEMS_STORAGE_KEY,
  type PortfolioItem,
} from '../../../_lib';
import ItemFullView, { loadItemDetails } from '../../../_ItemFullView';
import type { Draft } from '../../../edit/_interview';
import type { ResearchDetail } from '../../../edit/_research';
import type { StudyDetail } from '../../../edit/_study';

// 본인 데이터(localStorage) 또는 mock 피드 데이터(타인) 에서 항목 로드.

/** 포트폴리오 항목 상세 페이지 — /portfolio/[userId]/items/[itemId]
 *  본인이면 localStorage 에서 details/research/study 추가 로드.
 *  타인이면 mock 피드 데이터의 PortfolioItem 만 표시(상세 인터뷰 데이터는 없음). */
export default function PortfolioItemPage({
  params,
}: {
  params: Promise<{ userId: string; itemId: string }>;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { userId: paramUserId, itemId: itemIdStr } = use(params);
  const itemId = Number(itemIdStr);
  const isOwner = !!user && user.id === paramUserId;
  const feedUser = useMemo(
    () => (!isOwner ? findMockFeedUser(paramUserId) : undefined),
    [isOwner, paramUserId],
  );

  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [details, setDetails] = useState<Draft | null>(null);
  const [research, setResearch] = useState<ResearchDetail | null>(null);
  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (isOwner) {
      try {
        const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
        const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
        setItem(list.find((it) => it.id === itemId) ?? null);
      } catch {
        setItem(DEFAULT_ITEMS.find((it) => it.id === itemId) ?? null);
      }
      const d = loadItemDetails(itemId);
      setDetails(d.details);
      setResearch(d.research);
      setStudy(d.study);
    } else {
      // 타인: mock 피드 데이터에서만 항목 검색. 인터뷰 details 는 없음.
      const found = feedUser?.portfolio.items.find((it) => it.id === itemId);
      setItem(found ?? null);
      setDetails(null);
      setResearch(null);
      setStudy(null);
    }
    setLoaded(true);
  }, [authLoading, user, itemId, router, isOwner, feedUser]);

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }
  if (!user) return null;

  // (mock 시대 분기 제거) — feedUser 가 항상 undefined 가 되어 누구를 봐도
  // "비공개" 안내가 잘못 떴음. 타인 viewer 의 진짜 비공개/없음 처리는 추후
  // backend GET /portfolios/users/:id 호출로 대체 예정. 그 전엔 item === null
  // 이면 아래의 "존재하지 않는 항목" 안내가 자연스럽게 표시됨.

  /** 별 토글 — items 전체를 다시 저장 (단일 항목 페이지여도 전체 상태 일관성 유지) */
  const toggleFeatured = () => {
    if (!item) return;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : [];
      const willBeFeatured = !item.featured;
      if (willBeFeatured) {
        // 항목 종류별 대표 개수 제한 (project=4 / research=2 / study=2)
        const limit =
          item.type === 'research'
            ? MAX_FEATURED_RESEARCH
            : item.type === 'study'
              ? MAX_FEATURED_STUDY
              : MAX_FEATURED;
        const sameTypeFeatured = list.filter(
          (it) => it.featured && it.type === item.type,
        ).length;
        const label =
          item.type === 'research'
            ? '대표 연구'
            : item.type === 'study'
              ? '대표 스터디'
              : '대표 프로젝트';
        if (sameTypeFeatured >= limit) {
          alert(`${label}는 최대 ${limit}개까지만 지정할 수 있어요.`);
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
          href={`/portfolio/${paramUserId}`}
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
        href={`/portfolio/${paramUserId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 포트폴리오로
      </Link>

      <div className="card relative">
        {isOwner && (
          <FeaturedStar featured={!!item.featured} onToggle={toggleFeatured} />
        )}

        <ItemFullView
          item={item}
          details={details}
          research={research}
          study={study}
        />

        {isOwner && (
          <div className="mt-4 flex justify-end">
            <Link
              href={`/portfolio/edit?id=${item.id}&type=${item.type}`}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              수정
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
