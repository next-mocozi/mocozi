'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolio } from '@/hooks/useMyPortfolio';
import { getPortfolioByUserId, updateItem as apiUpdateItem } from '@/lib/portfolio-api';
import {
  FeaturedStar,
  type PortfolioItem,
  type PortfolioItemType,
} from '../../../_lib';
import ItemFullView, { loadItemDetails } from '../../../_ItemFullView';
import type { Draft } from '../../../edit/_interview';
import type { ResearchDetail } from '../../../edit/_research';
import type { StudyDetail } from '../../../edit/_study';

// 본인 = localStorage, 타인 = backend GET /portfolios/users/:userId 에서 item 로드.

const TYPE_FROM_BACKEND: Record<string, PortfolioItemType> = {
  PROJECT: 'project',
  RESEARCH: 'research',
  STUDY: 'study',
  ACTIVITY: 'activity',
  ETC: 'etc',
};

/** 포트폴리오 항목 상세 페이지 — /portfolio/[userId]/items/[itemId]
 *  본인이면 localStorage 에서 details/research/study 추가 로드.
 *  타인이면 backend 에서 그 사람 portfolio 가져와 itemId 일치 항목만 표시
 *  (상세 인터뷰 데이터는 본인 localStorage 전용이라 타인 viewer 엔 없음). */
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

  // 본인 케이스는 useMyPortfolio SWR hook 으로 통일 — 다른 화면(피드/내포폴/편집기)이
  // invalidateMyPortfolio() 호출하면 이 페이지도 자동 refetch → 수정사항 즉시 반영.
  // (이전엔 여기서만 raw getMyPortfolio() 직접 호출이라 SWR 무효화와 동기 안 돼서
  //  본인 페이지 → 카드 클릭 시 stale 데이터 보이던 버그.)
  const { portfolio: myPortfolio, isLoading: myPortfolioLoading } =
    useMyPortfolio();

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
    let cancelled = false;
    if (isOwner) {
      // SWR 데이터가 아직 안 왔으면 대기
      if (myPortfolioLoading) return;
      const found = (myPortfolio?.items ?? []).find(
        (b) => new Date(b.createdAt).getTime() === itemId,
      );
      if (found) {
        setItem({
          id: new Date(found.createdAt).getTime(),
          serverId: found.id,
          type: TYPE_FROM_BACKEND[found.type] ?? 'project',
          title: found.title,
          description: found.description,
          summary: found.summary ?? undefined,
          period: found.period ?? found.duration ?? '',
          current: found.current ?? false,
          domain: found.domain || undefined,
          tags: found.tags ?? [],
          featured: found.featured ?? false,
          thumbnail: found.thumbnail ?? undefined,
          createdAt: new Date(found.createdAt).getTime(),
        });
        const det = found.details as { kind?: string; data?: unknown } | null;
        if (det?.kind === 'interview') {
          setDetails(det.data as Draft);
          setResearch(null);
          setStudy(null);
        } else if (det?.kind === 'research') {
          setResearch(det.data as ResearchDetail);
          setDetails(null);
          setStudy(null);
        } else if (det?.kind === 'study') {
          setStudy(det.data as StudyDetail);
          setDetails(null);
          setResearch(null);
        } else {
          setDetails(null);
          setResearch(null);
          setStudy(null);
        }
      } else {
        setItem(null);
        // 백엔드에 없으면 localStorage details 캐시 시도 (mid-edit draft)
        const d = loadItemDetails(itemId);
        setDetails(d.details);
        setResearch(d.research);
        setStudy(d.study);
      }
      setLoaded(true);
    } else {
      // 타인: backend 에서 그 사람 portfolio 호출 → itemId(= createdAt 기반 epoch ms)
      // 와 일치하는 item 찾기. 비공개 portfolio 면 items 빈 배열로 응답되어 null.
      (async () => {
        try {
          const remote = await getPortfolioByUserId(paramUserId);
          if (cancelled) return;
          if (!remote) {
            setItem(null);
          } else {
            const found = (remote.items ?? []).find(
              (b) => new Date(b.createdAt).getTime() === itemId,
            );
            if (found) {
              setItem({
                id: new Date(found.createdAt).getTime(),
                type: TYPE_FROM_BACKEND[found.type] ?? 'project',
                title: found.title,
                description: found.description,
                summary: found.summary ?? undefined,
                period: found.period ?? found.duration ?? '',
                current: found.current ?? false,
                domain: found.domain || undefined,
                tags: found.tags ?? [],
                featured: found.featured ?? false,
                thumbnail: found.thumbnail ?? undefined,
                createdAt: new Date(found.createdAt).getTime(),
              });
              // backend details(Json) → 작성자 미리보기 풀세트 복원.
              // 통합 형식 { kind: 'interview' | 'research' | 'study', data: ... } 로
              // 저장돼있다. kind 에 따라 적절한 state 에 넣어 ItemFullView 가 동일하게 렌더.
              const d = found.details as
                | { kind?: string; data?: unknown }
                | undefined
                | null;
              if (d && typeof d === 'object' && 'kind' in d) {
                if (d.kind === 'interview') {
                  setDetails(d.data as Draft);
                  setResearch(null);
                  setStudy(null);
                } else if (d.kind === 'research') {
                  setResearch(d.data as ResearchDetail);
                  setDetails(null);
                  setStudy(null);
                } else if (d.kind === 'study') {
                  setStudy(d.data as StudyDetail);
                  setDetails(null);
                  setResearch(null);
                } else {
                  setDetails(null);
                  setResearch(null);
                  setStudy(null);
                }
              } else {
                setDetails(null);
                setResearch(null);
                setStudy(null);
              }
            } else {
              setItem(null);
              setDetails(null);
              setResearch(null);
              setStudy(null);
            }
          }
        } catch {
          if (!cancelled) setItem(null);
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, itemId, router, isOwner, paramUserId, myPortfolio, myPortfolioLoading]);

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

  /** 별 토글 — 낙관적 업데이트 후 백엔드 동기화 */
  const toggleFeatured = async () => {
    if (!item || !item.serverId) return;
    const willBeFeatured = !item.featured;
    // 대표 개수 제한은 백엔드가 강제함
    const prev = item;
    setItem({ ...item, featured: willBeFeatured });
    try {
      await apiUpdateItem(item.serverId, { featured: willBeFeatured });
    } catch {
      setItem(prev);
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
