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

export type BackendPortfolio = {
  id: string;
  userId: string;
  items: BackendPortfolioItem[];
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
