'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolioStatus } from '@/hooks/useMyPortfolioStatus';
import { useMyPortfolio } from '@/hooks/useMyPortfolio';
import { useFeed } from '@/hooks/useFeed';
import { buildOwnerFeedPostsFromApi } from '@/lib/feed/buildOwnerFeed';
import { buildBackendFeedPosts } from '@/lib/feed/buildBackendFeed';
import type { FeedPost } from '@/lib/feed/types';
import PortfolioSegmentedNav from '@/components/portfolio/PortfolioSegmentedNav';
import FeedPostCard from '@/components/portfolio/FeedPostCard';
import FeedDetailPanel, {
  type FeedDetailTarget,
} from '@/components/portfolio/FeedDetailPanel';

/** 메인 포트폴리오 피드.
 *  - 비로그인 → /login
 *  - unwritten → /portfolio/onboarding
 *  - 그 외: 다른 사람들의 모든 공개 게시물 + 본인이 공개일 때 본인 게시물.
 *  - 카드 클릭 → 좌측 슬라이드 + 우측 상세 패널 (segmented controls 가려짐).
 *  - 작성자 영역 클릭 → 우측 패널이 작성자 종합 미리보기 모드로 전환. */
export default function PortfolioFeedPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status } = useMyPortfolioStatus();
  const { portfolio: myPortfolio } = useMyPortfolio();
  const { portfolios: remotePortfolios } = useFeed();
  const [target, setTarget] = useState<FeedDetailTarget | null>(null);
  // 슬라이드 인/아웃 애니메이션을 위해 target 이 사라져도 잠시 유지한다.
  const [renderedTarget, setRenderedTarget] = useState<FeedDetailTarget | null>(null);
  useEffect(() => {
    if (target) {
      setRenderedTarget(target);
      return;
    }
    if (!renderedTarget) return;
    const t = setTimeout(() => setRenderedTarget(null), 320);
    return () => clearTimeout(t);
  }, [target, renderedTarget]);

  // 모바일 풀스크린 오버레이가 열려 있는 동안 배경 스크롤 잠금.
  // 데스크톱(lg+) 사이드 패널은 in-flow 라 페이지 스크롤이 살아 있어야 하므로 제외.
  useEffect(() => {
    if (target === null) return;
    const mql = window.matchMedia('(max-width: 1023px)');
    const apply = () => {
      document.body.style.overflow = mql.matches ? 'hidden' : '';
    };
    apply();
    mql.addEventListener('change', apply);
    return () => {
      mql.removeEventListener('change', apply);
      document.body.style.overflow = '';
    };
  }, [target]);

  // 게이트
  useEffect(() => {
    if (loading || status === 'loading') return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (status === 'unwritten') {
      router.replace('/portfolio/onboarding');
    }
  }, [loading, status, user, router]);

  // 피드 데이터: 백엔드(타인 공개) + 본인(공개일 때).
  // isPublic 판단은 백엔드 응답(myPortfolio.isPublic)을 기준으로 한다.
  const posts: FeedPost[] = useMemo(() => {
    const others = buildBackendFeedPosts(remotePortfolios ?? []);
    if (user && myPortfolio && myPortfolio.isPublic) {
      const mine = buildOwnerFeedPostsFromApi(myPortfolio, user, { isPrivate: false });
      return [...others, ...mine].sort((a, b) => b.createdAt - a.createdAt);
    }
    return [...others].sort((a, b) => b.createdAt - a.createdAt);
  }, [user, remotePortfolios, myPortfolio]);

  // 아주 초기(auth/status 자체가 미정) 만 전체 화면 로딩. backend 메인 피드 fetch
  // 자체는 nav 까지 가리지 않고, 아래쪽 posts 영역에서만 로딩 표시.
  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }
  if (!user || status === 'unwritten') return null;

  const detailOpen = target !== null;
  const selectedPostId =
    target?.mode === 'post' ? target.post.postId : null;

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-8">
      <PortfolioSegmentedNav current="feed" isPublic={myPortfolio?.isPublic} />

      {/* 진짜 2단 레이아웃 — 패널이 열리면 피드와 한 행을 나눠 갖는다.
          overflow-x-clip — 닫혀있을 때 패널이 자기 폭만큼 우측으로 빠져 있어 생기는
          가로 스크롤을 잘라낸다. clip 은 scroll container/stacking context 를 만들지
          않아 내부 패널의 sticky 동작에 영향이 없다. */}
      <div className="relative flex justify-center overflow-x-clip">
        {/* 좌측: 피드 컬럼 — 패널이 열리면 flex-shrink 로 줄어든다. */}
        <div className="w-full min-w-0 max-w-2xl">
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">피드</h1>
            <p className="mt-1 text-sm text-gray-500">
              다른 사람들이 어떤 프로젝트·연구·스터디·경력을 올렸는지
              둘러보세요.
            </p>
          </header>

          {myPortfolio !== null && !myPortfolio.isPublic && (
            <div className="mb-4 flex items-start gap-3 border border-amber-200 bg-amber-50 p-4">
              <span className="mt-0.5 text-lg" aria-hidden>
                🔒
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  내 포트폴리오는 비공개 상태예요
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  메인 피드에는 다른 사람의 공개 게시물만 보입니다. 공개로
                  전환하면 내 게시물도 다른 사람에게 노출돼요.
                </p>
              </div>
              <Link
                href={user ? `/portfolio/${user.id}` : '/portfolio/me'}
                className="shrink-0 bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                공개로 전환
              </Link>
            </div>
          )}

          {remotePortfolios === null ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <p className="text-sm text-gray-400">로딩 중…</p>
            </div>
          ) : posts.length === 0 ? (
            <p className="card text-center text-sm text-gray-500">
              아직 공개된 게시물이 없어요.
            </p>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => (
                <FeedPostCard
                  key={post.postId}
                  post={post}
                  selected={post.postId === selectedPostId}
                  onOpenDetail={(p) => {
                    // 같은 게시물을 다시 누르면 패널 닫기 (토글)
                    setTarget((prev) =>
                      prev?.mode === 'post' && prev.post.postId === p.postId
                        ? null
                        : { mode: 'post', post: p },
                    );
                  }}
                  onOpenAuthor={(uid) => {
                    // 본인 작성자 클릭 → 본인 종합 페이지로 이동(패널 모드 X)
                    if (user && uid === user.id) {
                      router.push(`/portfolio/${uid}`);
                      return;
                    }
                    // 같은 작성자를 다시 누르면 패널 닫기 (토글)
                    setTarget((prev) =>
                      prev?.mode === 'author' && prev.userId === uid
                        ? null
                        : { mode: 'author', userId: uid },
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 데스크톱 — in-flow 패널 컬럼. 열림/닫힘 시 폭이 0↔28rem 으로 애니메이션.
            - 컬럼은 flex 기본 stretch 로 피드 높이만큼 늘어나고, 그 안에서 내부 패널이
              sticky top-20 으로 뷰포트에 고정된다 (스크롤해도 X 버튼이 헤더에 안 가림).
            - 내부 패널의 translate 와 컬럼 width 애니메이션이 동기되어 우→좌 슬라이드.
            - target 이 null 이 된 뒤에도 renderedTarget 으로 잠깐 남아 슬라이드 아웃 표시. */}
        <div
          aria-hidden={!detailOpen}
          className={`hidden shrink-0 transition-[width,opacity,margin] duration-300 ease-out lg:block ${
            detailOpen ? 'ml-6 w-[28rem] opacity-100' : 'w-0 opacity-0'
          }`}
        >
          <div
            className={`sticky top-16 h-[calc(100vh-4rem)] w-[28rem] transition-transform duration-300 ease-out ${
              detailOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {renderedTarget && (
              <FeedDetailPanel
                target={renderedTarget}
                onClose={() => setTarget(null)}
              />
            )}
          </div>
        </div>

        {/* 모바일 — 풀스크린 오버레이. 카드는 우측에서 슬라이드 인/아웃. */}
        {renderedTarget && (
          <div
            className={`fixed inset-0 z-40 flex items-stretch p-2 transition-all duration-300 lg:hidden ${
              detailOpen
                ? 'bg-black/40 opacity-100'
                : 'pointer-events-none bg-black/0 opacity-0'
            }`}
            onClick={() => setTarget(null)}
          >
            <div
              className={`m-auto h-[90vh] w-full max-w-2xl transition-transform duration-300 ease-out ${
                detailOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <FeedDetailPanel
                target={renderedTarget}
                onClose={() => setTarget(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
