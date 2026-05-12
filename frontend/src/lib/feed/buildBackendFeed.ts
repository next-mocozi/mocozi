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
    //  2. 모든 게시물(item/work/activity/link) 중 가장 오래된 createdAt
    //  3. user.createdAt (가입 시점) — onboarding PATCH 가 어떤 이유로 실패해
    //     firstPostAt 이 null 인 사용자도 자기소개·기술스택만 있으면 노출되도록
    // 어떤 경우든 null 로 두지 않음 — "방금 전" 으로 표시되던 fallback 만 제거.
    let firstAt: number | null = null;
    if (p.firstPostAt) {
      const ts = new Date(p.firstPostAt).getTime();
      if (!Number.isNaN(ts)) firstAt = ts;
    }
    if (firstAt === null) {
      const allTimes = [
        ...p.items.map((i) => new Date(i.createdAt).getTime()),
        ...(p.workExperiences ?? []).map((w) => new Date(w.createdAt).getTime()),
        ...(p.activities ?? []).map((a) => new Date(a.createdAt).getTime()),
        ...(p.links ?? []).map((l) => new Date(l.createdAt).getTime()),
      ].filter((n) => !Number.isNaN(n));
      if (allTimes.length > 0) firstAt = Math.min(...allTimes);
    }
    if (firstAt === null && p.user.createdAt) {
      const ts = new Date(p.user.createdAt).getTime();
      if (!Number.isNaN(ts)) firstAt = ts;
    }

    // 각 게시물 자체 createdAt 우선, 없을 땐 firstAt fallback. 둘 다 없으면 0.
    // (item/exp/career 는 거의 자체 createdAt 이 있어서 firstAt 은 가드용.)
    const fallbackAt = firstAt ?? 0;

    // 1) PortfolioItem (+ backend details 첨부)
    for (const item of p.items ?? []) {
      const it = toPortfolioItem(item);
      posts.push({
        kind: 'item',
        postId: `${p.user.id}-item-${item.id}`,
        author,
        createdAt: it.createdAt ?? fallbackAt,
        item: it,
        // backend details(Json) — { kind, data } 통합 형식.
        // 타인 viewer 의 PostDetail 패널이 작성자 미리보기 그대로 노출.
        rawDetails:
          (item.details as { kind?: string; data?: unknown } | undefined) ??
          null,
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

    // 4) ProfilePost — intro + skills 만 있으면 무조건 노출.
    // portfolio.intro 우선, 없으면 user.bio fallback (onboarding 이전 가입자 대응)
    const intro = (p.intro ?? '').trim() || (p.user.bio ?? '').trim();
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
