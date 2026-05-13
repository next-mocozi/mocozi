// 프론트 PortfolioItem ↔ 백엔드 DTO 순수 변환 헬퍼.
// localStorage 의존성 없음 — 모든 데이터는 백엔드가 source of truth.

import type {
  CareerItem,
  Experience,
  PortfolioItem,
  PortfolioItemType,
} from '@/app/portfolio/_lib';
import type { ProfileLink } from '@/app/portfolio/_platforms';
import {
  createItem as apiCreateItem,
  updateItem as apiUpdateItem,
  deleteItem as apiDeleteItem,
  createPortfolioLink as apiCreateLink,
  updatePortfolioLink as apiUpdateLink,
} from './portfolio-api';
import type {
  BackendPortfolioItem,
  BackendPortfolioItemType,
  BackendWorkExperience,
  BackendExternalActivity,
  BackendPortfolioLink,
  CreateItemPayload,
  UpdateItemPayload,
} from './portfolio-api';

// ──────── type 변환 ────────
const TYPE_TO_BACKEND: Record<PortfolioItemType, BackendPortfolioItemType> = {
  project: 'PROJECT',
  research: 'RESEARCH',
  study: 'STUDY',
  activity: 'ACTIVITY',
  etc: 'ETC',
};

const TYPE_FROM_BACKEND: Record<BackendPortfolioItemType, PortfolioItemType> = {
  PROJECT: 'project',
  RESEARCH: 'research',
  STUDY: 'study',
  ACTIVITY: 'activity',
  ETC: 'etc',
};

// ──────── details 통합 payload ────────
export type ItemDetailsPayload =
  | { kind: 'interview'; data: unknown }
  | { kind: 'research'; data: unknown }
  | { kind: 'study'; data: unknown };

// ──────── 매퍼 ────────
function ensureDescription(item: PortfolioItem): string {
  if (item.description && item.description.trim().length > 0) {
    return item.description;
  }
  return item.summary?.trim() || item.title;
}

export function toCreatePayload(item: PortfolioItem): CreateItemPayload {
  const originalTs = item.createdAt ?? item.id;
  return {
    type: TYPE_TO_BACKEND[item.type],
    title: item.title,
    description: ensureDescription(item),
    techStack: [],
    duration: item.period || '',
    role: '',
    domain: item.domain || '',
    tags: item.tags ?? [],
    summary: item.summary,
    featured: item.featured ?? false,
    thumbnail: item.thumbnail,
    period: item.period,
    current: item.current ?? false,
    clientCreatedAt: new Date(originalTs).toISOString(),
  };
}

export function toUpdatePayload(item: PortfolioItem): UpdateItemPayload {
  return toCreatePayload(item);
}

/** 백엔드 응답 → 프론트 PortfolioItem. serverId 를 직접 보관. */
export function fromBackendItem(b: BackendPortfolioItem): PortfolioItem {
  const localId = new Date(b.createdAt).getTime() || Date.now();
  return {
    id: localId,
    serverId: b.id,
    type: TYPE_FROM_BACKEND[b.type],
    title: b.title,
    description: b.description,
    summary: b.summary ?? undefined,
    period: b.period ?? b.duration ?? '',
    current: b.current ?? false,
    domain: b.domain || undefined,
    tags: b.tags ?? [],
    featured: b.featured ?? false,
    thumbnail: b.thumbnail ?? undefined,
    createdAt: localId,
  };
}

export function fromBackendWorkExperience(b: BackendWorkExperience): Experience {
  return {
    id: new Date(b.createdAt).getTime() || Date.now(),
    serverId: b.id,
    company: b.company,
    team: b.team ?? '',
    role: b.role,
    period: b.period,
    current: b.current,
  };
}

export function fromBackendActivity(b: BackendExternalActivity): CareerItem {
  return {
    id: new Date(b.createdAt).getTime() || Date.now(),
    serverId: b.id,
    year: b.year,
    month: b.month ?? undefined,
    content: b.content,
  };
}

export function fromBackendLink(b: BackendPortfolioLink): ProfileLink {
  return {
    id: new Date(b.createdAt).getTime() || Date.now(),
    serverId: b.id,
    url: b.url,
    label: b.label ?? undefined,
  };
}

// ──────── 동기화 헬퍼 (편집 폼 전용) ────────
/** 편집 폼의 "포트폴리오에 저장" 시 호출.
 *  item.serverId 가 있으면 update, 없으면 create. */
export async function syncItemToBackend(
  item: PortfolioItem,
  details?: ItemDetailsPayload,
): Promise<BackendPortfolioItem | null> {
  try {
    const basePayload = toCreatePayload(item);
    // details.data 안에 큰 base64 thumbnail 이 들어있으면 payload 가 사실상 2배 — backend
    // body limit(20MB) 에 걸려 silent 실패 가능. top-level thumbnail 필드가 이미 그 값을
    // 갖고 있으므로 detail 쪽에선 잘라낸다. (피드 카드 / 상세 패널 양쪽이 모두
    // item.thumbnail 을 먼저 보므로 detail.thumbnail 누락은 무해.)
    const slimDetails = (() => {
      if (details === undefined) return undefined;
      const data = details.data as Record<string, unknown> | null | undefined;
      if (!data || typeof data !== 'object') return details;
      // 동일 객체 변형 금지 — 새 객체 반환
      const { thumbnail: _stripped, ...rest } = data as { thumbnail?: unknown };
      void _stripped;
      return { ...details, data: rest } as ItemDetailsPayload;
    })();
    const payload = slimDetails !== undefined
      ? { ...basePayload, details: slimDetails }
      : basePayload;
    if (item.serverId) {
      // update 시 clientCreatedAt 제외 — UpdatePortfolioDto 에 그 필드가 없어서
      // ValidationPipe(whitelist) 가 거부, silent 실패하던 버그.
      // (clientCreatedAt 은 createItem 시에만 의미 있음 — Prisma createdAt 을
      //  frontend Date.now() 와 맞추기 위함. update 엔 무관.)
      const { clientCreatedAt: _ignored, ...updatePayload } = payload;
      void _ignored;
      return await apiUpdateItem(item.serverId, updatePayload);
    }
    return await apiCreateItem(payload);
  } catch (err) {
    console.error('[portfolio-sync] sync failed:', err);
    return null;
  }
}

/** 백엔드에서 아이템 삭제. serverId 직접 전달. */
export async function deleteItemFromBackend(serverId: string): Promise<void> {
  try {
    await apiDeleteItem(serverId);
  } catch (err) {
    console.error('[portfolio-sync] delete failed:', err);
  }
}

/** 링크 목록 전체 동기화 — serverId 있으면 update, 없으면 create.
 *  삭제는 별도로 처리해야 함 (여기서는 add/update 만 처리). */
export async function syncLinksAllToBackend(links: ProfileLink[]): Promise<void> {
  await Promise.allSettled(
    links.map(async (link) => {
      const payload = { url: link.url, label: link.label ?? undefined };
      if (link.serverId) {
        await apiUpdateLink(link.serverId, payload);
      } else {
        await apiCreateLink(payload);
      }
    }),
  );
}
