// 백엔드 메인 피드 응답을 FeedPost[] 로 평탄화.
// mock 의 getMockFeedPosts 와 동일한 형태로 변환해서, 메인 피드가 같은
// 렌더링 경로(FeedPostCard/FeedDetailPanel)를 그대로 쓸 수 있게 한다.

import type { FeedPortfolio } from '@/lib/portfolio-api';
import type {
  FeedAuthor,
  FeedPost,
  FeedPostCareer,
  FeedPostExperience,
  FeedPostItem,
  FeedPostProfile,
} from '@/lib/feed/types';
import type { PortfolioItem, PortfolioItemType } from '@/app/portfolio/_lib';

const TYPE_FROM_BACKEND: Record<string, PortfolioItemType> = {
  PROJECT: 'project',
  RESEARCH: 'research',
  STUDY: 'study',
  ACTIVITY: 'activity',
  ETC: 'etc',
};

function makeAuthor(p: FeedPortfolio): FeedAuthor {
  const u = p.user;
  return {
    userId: u.id,
    name: u.name,
    university: u.university,
    department: u.department,
    grade: u.grade ?? '',
    profileImage: u.profileImage ?? null,
    mainRole: u.roles?.[0],
  };
}

function toPortfolioItem(b: FeedPortfolio['items'][number]): PortfolioItem {
  return {
    id: new Date(b.createdAt).getTime() || Date.now(),
    type: TYPE_FROM_BACKEND[b.type] ?? 'project',
    title: b.title,
    description: b.description,
    summary: b.summary ?? undefined,
    period: b.period ?? b.duration ?? '',
    current: b.current ?? false,
    domain: b.domain || undefined,
    tags: b.tags ?? [],
    featured: b.featured ?? false,
    thumbnail: b.thumbnail ?? undefined,
    createdAt: new Date(b.createdAt).getTime(),
  };
}

/** 백엔드 메인 피드 응답 → FeedPost[]. 정렬은 호출자가 수행. */
export function buildBackendFeedPosts(portfolios: FeedPortfolio[]): FeedPost[] {
  const posts: FeedPost[] = [];
  for (const p of portfolios) {
    const author = makeAuthor(p);
    // ProfilePost 시점 결정 우선순위:
    //  1. portfolio.firstPostAt (onboarding 시 명시 설정)
    //  2. 가장 오래된 portfolio item 의 createdAt (firstPostAt 미설정 사용자 대응)
    //  3. 둘 다 없으면 null — 아래에서 ProfilePost 자체를 skip
    // (이전엔 fallback 이 Date.now() 라 모든 ProfilePost 가 "방금 전" 으로 표시됨)
    let firstAt: number | null = null;
    if (p.firstPostAt) {
      const ts = new Date(p.firstPostAt).getTime();
      if (!Number.isNaN(ts)) firstAt = ts;
    }
    if (firstAt === null && p.items.length > 0) {
      const itemTimes = p.items
        .map((i) => new Date(i.createdAt).getTime())
        .filter((n) => !Number.isNaN(n));
      if (itemTimes.length > 0) firstAt = Math.min(...itemTimes);
    }

    // 각 게시물 자체 createdAt 우선, 없을 땐 firstAt fallback. 둘 다 없으면 0.
    // (item/exp/career 는 거의 자체 createdAt 이 있어서 firstAt 은 가드용.)
    const fallbackAt = firstAt ?? 0;

    // 1) PortfolioItem
    for (const item of p.items ?? []) {
      const it = toPortfolioItem(item);
      posts.push({
        kind: 'item',
        postId: `${p.user.id}-item-${item.id}`,
        author,
        createdAt: it.createdAt ?? fallbackAt,
        item: it,
      } satisfies FeedPostItem);
    }

    // 2) 실무 경험
    (p.workExperiences ?? []).forEach((w) => {
      posts.push({
        kind: 'experience',
        postId: `${p.user.id}-exp-${w.id}`,
        author,
        createdAt: new Date(w.createdAt).getTime() || fallbackAt,
        exp: {
          id: new Date(w.createdAt).getTime(),
          company: w.company,
          team: w.team ?? '',
          role: w.role,
          period: w.period,
          current: w.current,
        },
      } satisfies FeedPostExperience);
    });

    // 3) 대외 활동
    (p.activities ?? []).forEach((c) => {
      posts.push({
        kind: 'career',
        postId: `${p.user.id}-career-${c.id}`,
        author,
        createdAt: new Date(c.createdAt).getTime() || fallbackAt,
        career: {
          id: new Date(c.createdAt).getTime(),
          year: c.year,
          month: c.month ?? undefined,
          content: c.content,
        },
      } satisfies FeedPostCareer);
    });

    // 4) ProfilePost — bio + skills 둘 다 있고 firstAt 도 결정됐을 때만 노출.
    // firstAt 이 null (firstPostAt 미설정 + items 도 0개) 인 사용자는
    // ProfilePost 자체를 만들지 않는다. "방금 전" 으로 표시되는 혼란 방지.
    const intro = (p.user.bio ?? '').trim();
    const skills = p.user.skills ?? [];
    if (intro && skills.length > 0 && firstAt !== null) {
      posts.push({
        kind: 'profile',
        postId: `${p.user.id}-profile`,
        author,
        createdAt: firstAt,
        intro,
        skills,
      } satisfies FeedPostProfile);
    }
  }
  return posts;
}
