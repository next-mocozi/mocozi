// 본인 포트폴리오 데이터(localStorage)를 FeedPost[] 로 변환.
// 메인 피드에서 본인이 공개 상태일 때, 그리고 내 피드(/portfolio/me)에서 항상 사용.

import type { AuthUser } from '@/contexts/AuthContext';
import {
  CAREERS_STORAGE_KEY,
  EXPS_STORAGE_KEY,
  FIRST_POST_STORAGE_KEY,
  INTRO_STORAGE_KEY,
  ITEMS_STORAGE_KEY,
  type CareerItem,
  type Experience,
  type PortfolioItem,
} from '@/app/portfolio/_lib';
import type {
  FeedAuthor,
  FeedPost,
  FeedPostCareer,
  FeedPostExperience,
  FeedPostItem,
  FeedPostProfile,
} from '@/lib/feed/types';

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadString(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function loadNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function makeAuthor(user: AuthUser, mainRole?: string): FeedAuthor {
  return {
    userId: user.id,
    name: user.name,
    university: user.university,
    department: user.department,
    grade: user.grade ?? '',
    profileImage: null,
    mainRole,
  };
}

/** 본인 데이터 → FeedPost[]
 *  isOwnerPrivate: 본인이 비공개 상태이면 모든 본인 게시물에 true 로 표시.
 *  내 피드에서는 비공개 게시물에도 "공개로 전환하면 노출" 힌트를 표시할 때 사용.
 *
 *  ProfilePost(첫 게시물 = 자기소개+기술스택)는 자기소개와 기술 스택이 모두 있으면
 *  무조건 포함된다. FIRST_POST_STORAGE_KEY 가 저장돼 있으면 그 값을 timestamp 로 쓰고,
 *  없으면(이번 변경 전 가입한 사용자) 다른 게시물보다 더 옛날을 fallback 으로 사용해
 *  피드 맨 아래(가장 오래된 게시물)에 자연스럽게 자리하도록 한다. */
export function buildOwnerFeedPosts(
  user: AuthUser,
  options: { isPrivate: boolean; mainRole?: string } = { isPrivate: false },
): FeedPost[] {
  const author = makeAuthor(user, options.mainRole);
  const posts: FeedPost[] = [];

  // 1) PortfolioItem 들 — draft 제외
  const items = loadJson<PortfolioItem[]>(ITEMS_STORAGE_KEY, []);
  items
    .filter((it) => !it.draft)
    .forEach((item) => {
      posts.push({
        kind: 'item',
        postId: `${user.id}-item-${item.id}`,
        author,
        // item.createdAt 우선 — 없으면 id (Date.now() 형태) 를 timestamp 로 사용
        createdAt: item.createdAt ?? item.id,
        item,
        isOwnerPrivate: options.isPrivate,
      } satisfies FeedPostItem);
    });

  // 2) 실무 경험 — id 를 timestamp 로 사용
  const experiences = loadJson<Experience[]>(EXPS_STORAGE_KEY, []);
  experiences.forEach((exp) => {
    posts.push({
      kind: 'experience',
      postId: `${user.id}-exp-${exp.id}`,
      author,
      createdAt: exp.id,
      exp,
      isOwnerPrivate: options.isPrivate,
    } satisfies FeedPostExperience);
  });

  // 3) 대외 활동 — id 를 timestamp 로 사용
  const careers = loadJson<CareerItem[]>(CAREERS_STORAGE_KEY, []);
  careers.forEach((c) => {
    posts.push({
      kind: 'career',
      postId: `${user.id}-career-${c.id}`,
      author,
      createdAt: c.id,
      career: c,
      isOwnerPrivate: options.isPrivate,
    } satisfies FeedPostCareer);
  });

  // 4) ProfilePost — 첫 게시물. intro + skills 가 모두 있으면 무조건 포함.
  const intro = loadString(INTRO_STORAGE_KEY).trim();
  const skills = user.skills ?? [];
  if (intro && skills.length > 0) {
    const stored = loadNumber(FIRST_POST_STORAGE_KEY);
    let createdAt: number;
    if (stored) {
      createdAt = stored;
    } else {
      // FIRST_POST_STORAGE_KEY 미설정 — 오늘로 처리.
      // (이전 fallback 은 "다른 게시물보다 1일 이전" 또는 "1년 전" 이었지만,
      //  근거 없는 과거 시점이 사용자에게 "왜 1년 전?" 으로 보이는 혼란만 만들었다.
      //  정보가 없으면 가장 자연스러운 default 인 "지금" 으로 처리.)
      createdAt = Date.now();
      // 다음 진입에서 안정적으로 같은 시점이 보이도록 즉시 저장.
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(FIRST_POST_STORAGE_KEY, String(createdAt));
        }
      } catch {
        // 저장 실패해도 표시는 정상 — 다음 새로고침에서 또 Date.now() 로 fallback.
      }
    }
    posts.push({
      kind: 'profile',
      postId: `${user.id}-profile`,
      author,
      createdAt,
      intro,
      skills,
      isOwnerPrivate: options.isPrivate,
    } satisfies FeedPostProfile);
  }

  return posts;
}
