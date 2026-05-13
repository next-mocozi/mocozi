// 백엔드 포트폴리오 API 래퍼.
// localStorage가 진실의 원천에서 백엔드로 옮겨가는 과도기에 사용.
// 모든 호출은 try/catch로 감싸 실패 시 caller가 localStorage fallback을 쓰도록 한다.

import api from './api';

export type BackendPortfolioItemType =
  | 'PROJECT'
  | 'RESEARCH'
  | 'STUDY'
  | 'ACTIVITY'
  | 'ETC';

export type BackendPortfolioItem = {
  id: string;
  portfolioId: string;
  type: BackendPortfolioItemType;
  title: string;
  description: string;
  techStack: string[];
  duration: string;
  role: string;
  domain: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  // 확장 필드 (옵셔널)
  summary?: string | null;
  featured?: boolean;
  thumbnail?: string | null;
  period?: string | null;
  current?: boolean;
  details?: unknown;
};

export type BackendWorkExperience = {
  id: string;
  portfolioId: string;
  company: string;
  team?: string | null;
  role: string;
  period: string;
  current: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackendExternalActivity = {
  id: string;
  portfolioId: string;
  year: string;
  month?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendPortfolioLink = {
  id: string;
  portfolioId: string;
  url: string;
  label?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackendPortfolio = {
  id: string;
  userId: string;
  isPublic?: boolean;
  firstPostAt?: string | null;
  intro?: string | null;
  items: BackendPortfolioItem[];
  // Phase 3 — 부속 메타. 옛 백엔드 응답 호환을 위해 옵셔널.
  workExperiences?: BackendWorkExperience[];
  activities?: BackendExternalActivity[];
  links?: BackendPortfolioLink[];
};

export type CreateItemPayload = {
  type: BackendPortfolioItemType;
  title: string;
  description: string;
  techStack: string[];
  duration: string;
  role: string;
  domain: string;
  tags: string[];
  summary?: string;
  featured?: boolean;
  thumbnail?: string;
  period?: string;
  current?: boolean;
  details?: unknown;
  clientCreatedAt?: string;
};

export type UpdateItemPayload = Partial<CreateItemPayload>;

/** 응답 envelope ({ data: ... }) 안전 unwrap */
function unwrap<T>(res: { data: unknown }): T {
  const d = res.data as { data?: T } | T;
  if (d && typeof d === 'object' && 'data' in (d as object)) {
    return (d as { data: T }).data;
  }
  return d as T;
}

export async function getMyPortfolio(): Promise<BackendPortfolio> {
  const res = await api.get('/api/portfolios/me');
  return unwrap<BackendPortfolio>(res);
}

/** 타인 포트폴리오 조회. 비공개일 때 items/work/activity/link 가 빈 배열로 옴. */
export async function getPortfolioByUserId(
  userId: string,
): Promise<BackendPortfolio | null> {
  const res = await api.get(`/api/portfolios/users/${userId}`);
  return unwrap<BackendPortfolio | null>(res);
}

/** 메인 피드용 사용자 메타 (백엔드에서 select 한 필드와 동일) */
export type FeedUserMeta = {
  id: string;
  lastName: string;
  firstName: string;
  university: string;
  department: string;
  grade: string | null;
  bio: string | null;
  profileImage: string | null;
  roles: string[];
  skills: string[];
  /** 사용자 가입 시점 — firstPostAt 미설정자의 ProfilePost fallback 용도 */
  createdAt: string;
};

export type FeedPortfolio = BackendPortfolio & { user: FeedUserMeta };

export type FeedResponse = { portfolios: FeedPortfolio[] };

/** 메인 피드 — 본인 제외, 공개 포트폴리오 전체 */
export async function getFeed(): Promise<FeedResponse> {
  const res = await api.get('/api/portfolios/feed');
  return unwrap<FeedResponse>(res);
}

export async function createItem(
  payload: CreateItemPayload,
): Promise<BackendPortfolioItem> {
  const res = await api.post('/api/portfolios/items', payload);
  return unwrap<BackendPortfolioItem>(res);
}

export async function updateItem(
  id: string,
  payload: UpdateItemPayload,
): Promise<BackendPortfolioItem> {
  const res = await api.put(`/api/portfolios/items/${id}`, payload);
  return unwrap<BackendPortfolioItem>(res);
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete(`/api/portfolios/items/${id}`);
}

/** 메타 부분 수정 — isPublic, firstPostAt */
export async function updateMyMeta(payload: {
  isPublic?: boolean;
  firstPostAt?: string; // ISO string
  intro?: string;
}): Promise<BackendPortfolio> {
  const res = await api.patch('/api/portfolios/me', payload);
  return unwrap<BackendPortfolio>(res);
}

// =====================================================
// Phase 3 — 부속 메타 CRUD
// =====================================================

// ──── 실무 경험 ────
export type CreateWorkExperiencePayload = {
  company: string;
  team?: string;
  role: string;
  period: string;
  current?: boolean;
};
export type UpdateWorkExperiencePayload = Partial<CreateWorkExperiencePayload>;

export async function createWorkExperience(
  payload: CreateWorkExperiencePayload,
): Promise<BackendWorkExperience> {
  const res = await api.post('/api/portfolios/work', payload);
  return unwrap<BackendWorkExperience>(res);
}

export async function updateWorkExperience(
  id: string,
  payload: UpdateWorkExperiencePayload,
): Promise<BackendWorkExperience> {
  const res = await api.put(`/api/portfolios/work/${id}`, payload);
  return unwrap<BackendWorkExperience>(res);
}

export async function deleteWorkExperience(id: string): Promise<void> {
  await api.delete(`/api/portfolios/work/${id}`);
}

// ──── 대외 활동 ────
export type CreateExternalActivityPayload = {
  year: string;
  month?: string;
  content: string;
};
export type UpdateExternalActivityPayload =
  Partial<CreateExternalActivityPayload>;

export async function createExternalActivity(
  payload: CreateExternalActivityPayload,
): Promise<BackendExternalActivity> {
  const res = await api.post('/api/portfolios/activities', payload);
  return unwrap<BackendExternalActivity>(res);
}

export async function updateExternalActivity(
  id: string,
  payload: UpdateExternalActivityPayload,
): Promise<BackendExternalActivity> {
  const res = await api.put(`/api/portfolios/activities/${id}`, payload);
  return unwrap<BackendExternalActivity>(res);
}

export async function deleteExternalActivity(id: string): Promise<void> {
  await api.delete(`/api/portfolios/activities/${id}`);
}

// ──── 외부 링크 ────
export type CreatePortfolioLinkPayload = {
  url: string;
  label?: string;
};
export type UpdatePortfolioLinkPayload = Partial<CreatePortfolioLinkPayload>;

export async function createPortfolioLink(
  payload: CreatePortfolioLinkPayload,
): Promise<BackendPortfolioLink> {
  const res = await api.post('/api/portfolios/links', payload);
  return unwrap<BackendPortfolioLink>(res);
}

export async function updatePortfolioLink(
  id: string,
  payload: UpdatePortfolioLinkPayload,
): Promise<BackendPortfolioLink> {
  const res = await api.put(`/api/portfolios/links/${id}`, payload);
  return unwrap<BackendPortfolioLink>(res);
}

export async function deletePortfolioLink(id: string): Promise<void> {
  await api.delete(`/api/portfolios/links/${id}`);
}
