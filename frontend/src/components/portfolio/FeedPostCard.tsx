'use client';

import { TYPE_META } from '@/app/portfolio/_lib';
import type { FeedPost } from '@/lib/feed/types';
import { timeAgo } from '@/lib/timeAgo';

const KIND_LABEL: Record<FeedPost['kind'], { label: string; bg: string; text: string }> = {
  item: { label: '항목', bg: 'bg-purple-100', text: 'text-purple-700' },
  experience: { label: '경력', bg: 'bg-indigo-100', text: 'text-indigo-700' },
  career: { label: '대외 활동', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  profile: { label: '프로필', bg: 'bg-rose-100', text: 'text-rose-700' },
};

/** 게시물(FeedPost) 카드.
 *  카드 전체 클릭 → 상세 패널 열기. 작성자 영역 클릭 → 작성자 프로필 패널 열기.
 *  좋아요/댓글/공유/DM 등 인터랙션은 두지 않는다. */
export default function FeedPostCard({
  post,
  selected,
  onOpenDetail,
  onOpenAuthor,
}: {
  post: FeedPost;
  selected: boolean;
  onOpenDetail: (post: FeedPost) => void;
  onOpenAuthor: (authorUserId: string) => void;
}) {
  const created = timeAgo(post.createdAt);

  return (
    <article
      onClick={() => onOpenDetail(post)}
      className={`card cursor-pointer overflow-hidden p-0 transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      {/* 썸네일 (item 종류이고 thumbnail 있을 때만) */}
      {post.kind === 'item' && post.item.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.item.thumbnail}
          alt=""
          className="block h-56 w-full object-cover"
        />
      )}

      <div className="p-5 sm:p-6">
        {/* 카드 상단 메타 — 종류 뱃지 + 도메인/연도 등 */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <KindBadge kind={post.kind} post={post} />
          <PostMetaTags post={post} />
        </div>

        {/* 제목 / 본문 — 종류별 분기 */}
        <PostTitleAndBody post={post} />

        {/* 비공개 본인 게시물 힌트 */}
        {post.isOwnerPrivate && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
            <span aria-hidden>🔒</span>
            공개로 전환하면 이 게시물이 메인 피드에 노출됩니다.
          </p>
        )}

        {/* 태그 */}
        <PostTags post={post} />

        {/* 하단 — 작성자 + 시간 */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenAuthor(post.author.userId);
            }}
            className="group flex items-center gap-2 text-left"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-sm text-primary-600">
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
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-800 group-hover:text-blue-600">
                {post.author.name}
              </span>
              <span className="block truncate text-xs text-gray-500">
                {post.author.university} · {post.author.department}
              </span>
            </span>
          </button>
          <span className="shrink-0 text-xs text-gray-400">{created}</span>
        </div>
      </div>
    </article>
  );
}

function KindBadge({
  kind,
  post,
}: {
  kind: FeedPost['kind'];
  post: FeedPost;
}) {
  // item 종류는 PortfolioItem.type 으로 더 구체적인 라벨/색을 사용
  if (kind === 'item' && post.kind === 'item') {
    const meta = TYPE_META[post.item.type];
    return (
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}
      >
        {meta.label}
      </span>
    );
  }
  const meta = KIND_LABEL[kind];
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}
    >
      {meta.label}
    </span>
  );
}

function PostMetaTags({ post }: { post: FeedPost }) {
  switch (post.kind) {
    case 'item':
      return (
        <>
          {post.item.domain && (
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
              {post.item.domain}
            </span>
          )}
          {post.item.period && (
            <span className="text-xs text-gray-500">{post.item.period}</span>
          )}
          {post.item.current && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              진행중
            </span>
          )}
        </>
      );
    case 'experience':
      return (
        <>
          <span className="text-xs text-gray-500">{post.exp.period}</span>
          {post.exp.current && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              재직중
            </span>
          )}
        </>
      );
    case 'career':
      return (
        <span className="text-xs font-semibold text-gray-700">
          {post.career.year}년
        </span>
      );
    case 'profile':
      return (
        <span className="text-xs text-gray-500">
          포트폴리오를 시작했어요
        </span>
      );
  }
}

function PostTitleAndBody({ post }: { post: FeedPost }) {
  switch (post.kind) {
    case 'item':
      return (
        <>
          <h3 className="text-xl font-bold leading-snug text-gray-900">
            {post.item.title}
          </h3>
          {post.item.description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden">
              {post.item.description}
            </p>
          )}
        </>
      );
    case 'experience':
      return (
        <>
          <h3 className="text-xl font-bold leading-snug text-gray-900">
            {post.exp.company}
            {post.exp.team && (
              <span className="ml-1 text-base font-medium text-gray-500">
                · {post.exp.team}
              </span>
            )}
          </h3>
          {post.exp.role && (
            <p className="mt-1 text-sm text-gray-700">{post.exp.role}</p>
          )}
        </>
      );
    case 'career':
      return (
        <h3 className="text-lg font-semibold leading-relaxed text-gray-900">
          {post.career.content}
        </h3>
      );
    case 'profile':
      return (
        <>
          <h3 className="text-lg font-bold leading-snug text-gray-900">
            {post.author.name} 님이 포트폴리오를 시작했습니다
          </h3>
          {post.intro && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">
              {post.intro}
            </p>
          )}
        </>
      );
  }
}

function PostTags({ post }: { post: FeedPost }) {
  let tags: string[] = [];
  if (post.kind === 'item') tags = post.item.tags ?? [];
  else if (post.kind === 'profile') tags = post.skills ?? [];
  else if (post.kind === 'experience')
    tags = [post.exp.company, post.exp.role].filter(Boolean);
  // career 는 태그 없음
  if (tags.length === 0) return null;
  const visible = tags.slice(0, 6);
  const more = tags.length - visible.length;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {visible.map((t) => (
        <span
          key={t}
          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
        >
          {t}
        </span>
      ))}
      {more > 0 && (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          +{more}
        </span>
      )}
    </div>
  );
}
