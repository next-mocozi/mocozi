'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TYPE_META } from '@/app/portfolio/_lib';
import ItemFullView, {
  loadItemDetails,
} from '@/app/portfolio/_ItemFullView';
import { findMockFeedUser } from '@/lib/mock/portfolioFeed';
import type { FeedPost } from '@/lib/feed/types';
import { timeAgo } from '@/lib/timeAgo';

/** 우측 상세 패널 — 두 가지 모드:
 *  - 'post': 게시물(FeedPost) 상세. 작성자 + 본문(항목/경험/경력/프로필) 전체 노출.
 *    item 종류는 ItemFullView 로 인터뷰/연구/스터디 본문까지 모두 표시 — 별도 페이지로
 *    리다이렉트하지 않고 패널 안에서 끝까지 읽을 수 있도록 한다.
 *  - 'author': 작성자(userId) 종합 미리보기. 자기소개·기술·항목 일부 + "전체 페이지 보기".
 *  좋아요/댓글/공유/DM 등 인터랙션은 두지 않음. */
export type FeedDetailTarget =
  | { mode: 'post'; post: FeedPost }
  | { mode: 'author'; userId: string };

export default function FeedDetailPanel({
  target,
  onClose,
}: {
  target: FeedDetailTarget;
  onClose: () => void;
}) {
  // Esc 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold text-gray-700">
          {target.mode === 'post' ? '게시물' : '작성자 포트폴리오'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="패널 닫기"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
        {target.mode === 'post' ? (
          <PostDetail post={target.post} />
        ) : (
          <AuthorDetail userId={target.userId} />
        )}
      </div>
    </aside>
  );
}

// ──────── 게시물 상세 ────────
function PostDetail({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const created = timeAgo(post.createdAt);

  // 본인 게시물의 item 이라면 localStorage 에서 인터뷰/연구/스터디 상세 로드.
  // 타인(mock) 게시물은 details 가 없어 PortfolioItem.description 만 노출됨.
  const itemDetails = useMemo(() => {
    if (post.kind !== 'item') return null;
    if (!user || user.id !== post.author.userId) return null;
    return loadItemDetails(post.item.id);
  }, [post, user]);

  return (
    <div className="space-y-5">
      {/* 작성자 + 등록 시간 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/portfolio/${post.author.userId}`}
          className="group flex items-center gap-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm text-primary-600">
            {post.author.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.author.profileImage}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              '👤'
            )}
          </span>
          <span>
            <span className="block text-sm font-semibold text-gray-800 group-hover:text-blue-600">
              {post.author.name}
            </span>
            <span className="block text-xs text-gray-500">
              {post.author.university} · {post.author.department}
              {post.author.grade &&
                ` · ${/^\d+$/.test(post.author.grade) ? `${post.author.grade}학년` : post.author.grade}`}
            </span>
          </span>
        </Link>
        <span className="text-xs text-gray-400">{created}</span>
      </div>

      {/* 종류별 본문 — item 은 풀 상세, 그 외는 컴팩트 표시 */}
      {post.kind === 'item' ? (
        <ItemFullView
          item={post.item}
          details={itemDetails?.details}
          research={itemDetails?.research}
          study={itemDetails?.study}
        />
      ) : (
        <PostBody post={post} />
      )}

    </div>
  );
}

function PostBody({ post }: { post: Exclude<FeedPost, { kind: 'item' }> }) {
  switch (post.kind) {
    case 'experience':
      return (
        <div>
          <h2 className="text-xl font-bold leading-snug text-gray-900">
            {post.exp.company}
            {post.exp.team && (
              <span className="ml-1 text-base font-medium text-gray-500">
                · {post.exp.team}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-gray-700">{post.exp.role}</p>
          <p className="mt-2 text-xs text-gray-500">{post.exp.period}</p>
        </div>
      );
    case 'career':
      return (
        <div>
          <p className="text-sm font-semibold text-gray-700">
            {post.career.year}년
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-relaxed text-gray-900">
            {post.career.content}
          </h2>
        </div>
      );
    case 'profile':
      return (
        <div>
          <h2 className="text-lg font-bold leading-snug text-gray-900">
            {post.author.name} 님이 포트폴리오를 시작했습니다
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {post.intro}
          </p>
          {post.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.skills.map((s) => (
                <span
                  key={s}
                  className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      );
  }
}

// ──────── 작성자 종합 미리보기 ────────
function AuthorDetail({ userId }: { userId: string }) {
  const feedUser = useMemo(() => findMockFeedUser(userId), [userId]);

  if (!feedUser) {
    return (
      <div className="text-center">
        <div className="mb-2 text-3xl">🔒</div>
        <p className="font-semibold text-gray-700">
          비공개 처리된 포트폴리오입니다.
        </p>
        <p className="mt-1 text-sm text-gray-500">
          소유자가 공개로 전환하면 열람할 수 있어요.
        </p>
      </div>
    );
  }

  const portfolio = feedUser.portfolio;
  return (
    <div className="space-y-5">
      {/* 프로필 헤더 */}
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl text-primary-600">
          {feedUser.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={feedUser.profileImage}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            '👤'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-gray-900">
            {feedUser.name}
          </h2>
          <p className="text-xs text-gray-500">
            {feedUser.university} · {feedUser.department}
            {feedUser.grade &&
              ` · ${/^\d+$/.test(feedUser.grade) ? `${feedUser.grade}학년` : feedUser.grade}`}
          </p>
          {feedUser.bio && (
            <p className="mt-1 text-xs text-gray-600">{feedUser.bio}</p>
          )}
        </div>
      </div>

      {/* 직군 */}
      {(feedUser.mainRole || (feedUser.subRoles && feedUser.subRoles.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1">
          {feedUser.mainRole && (
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
              {feedUser.mainRole}
            </span>
          )}
          {feedUser.subRoles?.map((r) => (
            <span
              key={r}
              className="rounded-full border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* 기술 스택 */}
      {feedUser.skills.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-500">기술 스택</h3>
          <div className="flex flex-wrap gap-1">
            {feedUser.skills.map((s) => (
              <span
                key={s}
                className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 자기소개 */}
      {portfolio.introduction && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-500">자기소개</h3>
          <p className="whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm leading-relaxed text-gray-700">
            {portfolio.introduction}
          </p>
        </div>
      )}

      {/* 항목 미리보기 — 최근 3개 */}
      {portfolio.items.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-500">
            포트폴리오 항목
          </h3>
          <ul className="space-y-2">
            {portfolio.items.slice(0, 3).map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-100 px-3 py-2"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] ${meta.bg} ${meta.text}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {item.period}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.title}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 전체 페이지로 이동 */}
      <Link
        href={`/portfolio/${feedUser.userId}`}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
      >
        전체 포트폴리오 보기 →
      </Link>
    </div>
  );
}
