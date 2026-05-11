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
    const firstAt = p.firstPostAt
      ? new Date(p.firstPostAt).getTime()
      : new Date(p.items[0]?.createdAt ?? Date.now()).getTime();

    // 1) PortfolioItem
    for (const item of p.items ?? []) {
      const it = toPortfolioItem(item);
      posts.push({
        kind: 'item',
        postId: `${p.user.id}-item-${item.id}`,
        author,
        createdAt: it.createdAt ?? firstAt,
        item: it,
      } satisfies FeedPostItem);
    }

    // 2) 실무 경험
    (p.workExperiences ?? []).forEach((w) => {
      posts.push({
        kind: 'experience',
        postId: `${p.user.id}-exp-${w.id}`,
        author,
        createdAt: new Date(w.createdAt).getTime() || firstAt,
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
        createdAt: new Date(c.createdAt).getTime() || firstAt,
        career: {
          id: new Date(c.createdAt).getTime(),
          year: c.year,
          month: c.month ?? undefined,
          content: c.content,
        },
      } satisfies FeedPostCareer);
    });

    // 4) ProfilePost — bio + skills 가 모두 있으면 firstAt 으로 노출
    const intro = (p.user.bio ?? '').trim();
    const skills = p.user.skills ?? [];
    if (intro && skills.length > 0) {
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
