'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolioStatus } from '@/hooks/useMyPortfolioStatus';
import { useMyPortfolio } from '@/hooks/useMyPortfolio';
import { buildOwnerFeedPostsFromApi } from '@/lib/feed/buildOwnerFeed';
import type { FeedPost } from '@/lib/feed/types';
import PortfolioSegmentedNav from '@/components/portfolio/PortfolioSegmentedNav';
import FeedPostCard from '@/components/portfolio/FeedPostCard';
import FeedDetailPanel, {
  type FeedDetailTarget,
} from '@/components/portfolio/FeedDetailPanel';

/** 내 피드 — 본인이 만든 모든 게시물(공개·비공개 무관) 시간순 표시.
 *  메인 피드(`/portfolio`)와 동일한 split-pane 인터랙션. */
export default function MyFeedPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status } = useMyPortfolioStatus();
  const { portfolio: myPortfolio } = useMyPortfolio();
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

  // 본인 게시물 — 비공개 여부와 무관하게 표시.
  // isPrivate 판단은 백엔드 응답(myPortfolio.isPublic)을 기준으로 한다.
  const posts: FeedPost[] = useMemo(() => {
    if (!user || !myPortfolio) return [];
    const isPrivate = !myPortfolio.isPublic;
    return buildOwnerFeedPostsFromApi(myPortfolio, user, { isPrivate }).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }, [user, myPortfolio]);

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
      <div className="relative z-0">
        <PortfolioSegmentedNav current="me" isPublic={myPortfolio?.isPublic} />
      </div>

      {/* overflow-x-clip — 우측 패널이 닫힌 상태(translate-x-full)에서 viewport
          바깥으로 painting 되며 가로 스크롤이 생기는 걸 잘라낸다. clip 은
          sticky/fixed stacking context 를 만들지 않아 sticky 패널 동작 유지. */}
      <div className="relative overflow-x-clip">
        <div
          className={`relative z-20 mx-auto max-w-2xl transition-transform duration-300 ease-out ${
            detailOpen
              ? 'lg:-translate-x-56 xl:-translate-x-64'
              : 'translate-x-0'
          }`}
        >
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">내 피드</h1>
            <p className="mt-1 text-sm text-gray-500">
               내가 올린 모든 게시물(공개·비공개 모두)을 시간순으로 볼 수 있어요
              <br></br>
              {myPortfolio !== null && !myPortfolio.isPublic && (
                <span className="ml-1 text-amber-600">
                현재 비공개 — 공개로 전환하면 메인 피드에도 노출됩니다.
                </span>
              )}
            </p>
          </header>

          {posts.length === 0 ? (
            <div className="card text-center">
              <p className="text-sm text-gray-500">
                아직 올린 게시물이 없어요.
              </p>
              <Link
                href={user ? `/portfolio/${user.id}` : '/portfolio'}
                className="mt-3 inline-flex items-center gap-1 border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                내 포트폴리오에서 항목 추가하기 →
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => (
                <FeedPostCard
                  key={post.postId}
                  post={post}
                  selected={post.postId === selectedPostId}
                  onOpenDetail={(p) => {
                    setTarget((prev) =>
                      prev?.mode === 'post' && prev.post.postId === p.postId
                        ? null
                        : { mode: 'post', post: p },
                    );
                  }}
                  onOpenAuthor={(uid) => {
                    if (user && uid === user.id) {
                      router.push(`/portfolio/${uid}`);
                      return;
                    }
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

        {/* 데스크톱 — 우측 sticky 패널. translate-x 로 우측에서 슬라이드 인/아웃. */}
        <div
          aria-hidden={!detailOpen}
          className={`pointer-events-none absolute inset-y-0 right-0 hidden w-[28rem] xl:w-[32rem] lg:block transition-transform duration-300 ease-out ${
            detailOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="pointer-events-auto sticky top-4 h-[calc(100vh-6rem)]">
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
