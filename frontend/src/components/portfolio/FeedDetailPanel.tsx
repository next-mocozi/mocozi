'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { TYPE_META, type PortfolioItem, type PortfolioItemType } from '@/app/portfolio/_lib';
import ItemFullView, {
  loadItemDetails,
} from '@/app/portfolio/_ItemFullView';
import api from '@/lib/api';
import { getPortfolioByUserId, type BackendPortfolio } from '@/lib/portfolio-api';
import type { FeedPost } from '@/lib/feed/types';
import { timeAgo } from '@/lib/timeAgo';

/** 작성자 종합 미리보기 패널에서 사용. backend GET /api/users/:id + /portfolios/users/:id 로
 *  필요한 필드만 채운 가벼운 형태. */
type AuthorDetailData = {
  name: string;
  university: string;
  department: string;
  grade: string | null;
  profileImage: string | null;
  bio: string | null;
  roles: string[];
  skills: string[];
  portfolio: BackendPortfolio | null;
};

const TYPE_FROM_BACKEND: Record<string, PortfolioItemType> = {
  PROJECT: 'project',
  RESEARCH: 'research',
  STUDY: 'study',
  ACTIVITY: 'activity',
  ETC: 'etc',
};

/** 우측 상세 패널 — 두 가지 모드:
 *  - 'post': 게시물(FeedPost) 상세. 작성자 + 본문(항목/경험/경력/프로필) 전체 노출.
 *    item 종류는 ItemFullView 로 인터뷰/연구/스터디 본문까지 모두 표시 — 별도 페이지로
 *    리다이렉트하지 않고 패널 안에서 끝까지 읽을 수 있도록 한다.
 *  - 'author': 작성자(userId) 종합 미리보기. 자기소개·기술·항목 일부 + "전체 페이지 보기".
 *  좋아요/댓글/공유/DM 등 인터랙션은 두지 않음. */
export type FeedDetailTarget =
  | { mode: 'post'; post: FeedPost }
  | { mode: 'author'; userId: string };

const EDITABLE_ITEM_TYPES = ['project', 'research', 'study'] as const;
type EditableItemType = (typeof EDITABLE_ITEM_TYPES)[number];

/** 본인 게시물에 떠는 메뉴 항목들 — kind/type 별로 다름.
 *  - 수정: 인라인 편집 페이지로 라우팅 (있을 때만)
 *  - 관리: 본인 portfolio 의 해당 종류 관리 모달로 라우팅 (?manage=...) */
type OwnerMenuLink = { label: string; href: string; danger?: boolean };

function getOwnerMenuLinks(post: FeedPost, ownerId: string): OwnerMenuLink[] {
  const portfolioBase = `/portfolio/${ownerId}`;
  if (post.kind === 'item') {
    const t = post.item.type;
    const links: OwnerMenuLink[] = [];
    if ((EDITABLE_ITEM_TYPES as readonly string[]).includes(t)) {
      links.push({
        label: '수정',
        href: `/portfolio/edit?type=${t as EditableItemType}&id=${post.item.id}`,
      });
    }
    // 관리 모달 — type 별 query
    const manageKey =
      t === 'research' ? 'research' : t === 'study' ? 'study' : 'portfolio';
    links.push({
      label: '관리·삭제',
      href: `${portfolioBase}?manage=${manageKey}`,
      danger: true,
    });
    return links;
  }
  if (post.kind === 'experience') {
    return [
      { label: '관리·삭제', href: `${portfolioBase}?manage=experience`, danger: true },
    ];
  }
  if (post.kind === 'career') {
    return [
      { label: '관리·삭제', href: `${portfolioBase}?manage=career`, danger: true },
    ];
  }
  if (post.kind === 'profile') {
    // 자기소개·기술스택 수정 — onboarding 페이지의 수정 모드 (?edit=1).
    // (전체 프로필(이름·학교·링크 등) 편집은 /profile/edit. ProfilePost 의 본문은
    // intro+skills 만이라 그것에 맞는 좁은 폼으로.)
    return [
      { label: '자기소개·기술 수정', href: `/portfolio/onboarding?edit=1` },
    ];
  }
  return [];
}

export default function FeedDetailPanel({
  target,
  onClose,
}: {
  target: FeedDetailTarget;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Esc 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // target 이 바뀌면 메뉴 닫기
  useEffect(() => {
    setMenuOpen(false);
  }, [target]);

  // author 모드일 때 헤더 이름은 AuthorDetail 내부 fetch 로 채워지므로
  // 헤더에선 일반적인 "프로필" 라벨만 노출.
  const authorName: string | undefined = undefined;

  // 본인 작성 게시물에 메뉴 노출 — kind 별 적절한 수정/관리 링크
  const ownerMenuLinks: OwnerMenuLink[] =
    target.mode === 'post' && user?.id === target.post.author.userId
      ? getOwnerMenuLinks(target.post, user.id)
      : [];

  return (
    <aside className="flex h-full flex-col overflow-hidden border border-gray-200 bg-white shadow-lg">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold text-gray-700">
          {target.mode === 'post'
            ? '게시물'
            : authorName
              ? `${authorName}님의 프로필`
              : '프로필'}
        </p>
        <div className="flex items-center gap-1">
          {ownerMenuLinks.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="수정·관리 메뉴"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="inline-flex h-8 w-8 items-center justify-center text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden border border-gray-200 bg-white shadow-lg"
                  >
                    {ownerMenuLinks.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        role="menuitem"
                        className={`block px-3 py-2 text-sm hover:bg-gray-50 ${
                          link.danger
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-gray-700'
                        }`}
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="패널 닫기"
            className="inline-flex h-8 w-8 items-center justify-center text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
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

  // 본인·타인 모두 rawDetails 를 공통 파서로 처리.
  // 본인 게시물은 localStorage 에서 먼저 시도하고, 비어있으면 rawDetails 로 fallback.
  // (새 기기/시크릿 창에서 localStorage 가 없을 때 첫 번째 질문만 보이던 문제 수정)
  const itemDetails = useMemo(() => {
    if (post.kind !== 'item') return null;

    const parseRaw = () => {
      const raw = post.rawDetails;
      if (!raw || typeof raw !== 'object') return null;
      if (raw.kind === 'interview') return { details: raw.data as never, research: null, study: null };
      if (raw.kind === 'research') return { details: null, research: raw.data as never, study: null };
      if (raw.kind === 'study') return { details: null, research: null, study: raw.data as never };
      return null;
    };

    if (user && user.id === post.author.userId) {
      const local = loadItemDetails(post.item.id);
      if (local.details !== null || local.research !== null || local.study !== null) {
        return local;
      }
      return parseRaw();
    }
    return parseRaw();
  }, [post, user]);

  return (
    <div className="space-y-5">
      {/* 작성자 + 등록 시간 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/portfolio/${post.author.userId}`}
          className="group flex items-center gap-2"
        >
          <span className="flex h-8 w-8 items-center justify-center bg-primary-100 text-sm text-primary-600">
            {post.author.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.author.profileImage}
                alt=""
                className="h-full w-full object-cover"
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
            {post.career.month ? ` ${Number(post.career.month)}월` : ''}
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
                  className="bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
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
// backend GET /api/users/:id + /api/portfolios/users/:id 로 데이터 fetch.
// 비공개 portfolio 는 backend 가 items/work/activity/link 빈 배열로 응답.
// SWR로 캐싱 — 60초 내 같은 작성자 재클릭 시 즉시 표시.
async function fetchAuthorDetail(userId: string): Promise<AuthorDetailData> {
  const [userRes, portfolio] = await Promise.all([
    api.get(`/api/users/${userId}`),
    getPortfolioByUserId(userId).catch(() => null),
  ]);
  const u = (userRes.data?.data ?? userRes.data) as
    | (Omit<AuthorDetailData, 'portfolio'> & { id: string })
    | null;
  if (!u) throw new Error('not found');
  return {
    name: u.name,
    university: u.university,
    department: u.department,
    grade: u.grade ?? null,
    profileImage: u.profileImage ?? null,
    bio: u.bio ?? null,
    roles: u.roles ?? [],
    skills: u.skills ?? [],
    portfolio,
  };
}

function AuthorDetail({ userId }: { userId: string }) {
  const { data, isLoading, error } = useSWR(
    `author-${userId}`,
    () => fetchAuthorDetail(userId),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }

  if (error || !data) {
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

  // backend roles[] → mainRole / subRoles 분리
  const mainRole = data.roles[0];
  const subRoles = data.roles.slice(1);
  // 대표 프로젝트/연구/스터디 — backend item 형식을 프론트 type 으로 변환
  const featured: PortfolioItem[] = (data.portfolio?.items ?? [])
    .filter((b) => b.featured)
    .map((b) => ({
      id: new Date(b.createdAt).getTime() || Date.now(),
      type: TYPE_FROM_BACKEND[b.type] ?? 'project',
      title: b.title,
      description: b.description,
      summary: b.summary ?? undefined,
      period: b.period ?? b.duration ?? '',
      current: b.current ?? false,
      domain: b.domain || undefined,
      tags: b.tags ?? [],
      featured: true,
      thumbnail: b.thumbnail ?? undefined,
      createdAt: new Date(b.createdAt).getTime(),
    }));

  return (
    <div className="space-y-5">
      {/* 프로필 헤더 — 이름 오른쪽에 [포트폴리오로 →] 버튼 */}
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-primary-100 text-2xl text-primary-600">
          {data.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.profileImage}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            '👤'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 truncate text-lg font-bold text-gray-900">
              {data.name}
            </h2>
            <Link
              href={`/portfolio/${userId}`}
              className="inline-flex shrink-0 items-center gap-1 border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              포트폴리오로 →
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            {data.university} · {data.department}
            {data.grade &&
              ` · ${/^\d+$/.test(data.grade) ? `${data.grade}학년` : data.grade}`}
          </p>
        </div>
      </div>

      {/* 직군 */}
      {(mainRole || subRoles.length > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {mainRole && (
            <span className="bg-blue-600 px-3 py-1 text-xs leading-none text-white">
              {mainRole}
            </span>
          )}
          {subRoles.map((r) => (
            <span
              key={r}
              className="border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {/* 기술 스택 */}
      {data.skills.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-500">기술 스택</h3>
          <div className="flex flex-wrap gap-1">
            {data.skills.map((s) => (
              <span
                key={s}
                className="bg-blue-50 px-2 py-1 text-xs text-blue-600"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 자기소개 — backend 는 user.bio 한 필드. mock 의 portfolio.introduction 와 동일 위치. */}
      {data.bio && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-500">자기소개</h3>
          <p className="whitespace-pre-wrap border border-gray-100 bg-gray-50/50 px-4 py-3 text-sm leading-relaxed text-gray-700">
            {data.bio}
          </p>
        </div>
      )}

      {/* 대표 프로젝트·연구·스터디 — featured 만 노출 */}
      {featured.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-500">
            대표 프로젝트·연구·스터디
          </h3>
          <ul className="space-y-2">
            {featured.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <li
                  key={item.id}
                  className="border border-gray-100 px-3 py-2"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-3xs ${meta.bg} ${meta.text}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-2xs text-gray-500">
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
    </div>
  );
}
