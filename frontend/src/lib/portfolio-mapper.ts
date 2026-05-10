// 프론트 PortfolioItem ↔ 백엔드 DTO 변환.
//
// 프론트 id는 number(Date.now() 기반), 백엔드 id는 UUID(string) — 1:1로 매칭하기 위해
// localStorage에 별도 매핑 테이블을 둔다. 기존 코드의 `id: number` 가정을 깨지 않으면서
// 점진적으로 백엔드 동기화를 도입하기 위함.

import type {
  PortfolioItem,
  PortfolioItemType,
} from '@/app/portfolio/_lib';
import {
  ITEMS_STORAGE_KEY,
  VISIBILITY_STORAGE_KEY,
  FIRST_POST_STORAGE_KEY,
} from '@/app/portfolio/_lib';
import {
  createItem as apiCreateItem,
  updateItem as apiUpdateItem,
  deleteItem as apiDeleteItem,
  getMyPortfolio as apiGetMyPortfolio,
} from './portfolio-api';
import type {
  BackendPortfolioItem,
  BackendPortfolioItemType,
  CreateItemPayload,
  UpdateItemPayload,
} from './portfolio-api';

// ──────── id 매핑 테이블 (localStorage) ────────
const ID_MAP_KEY = 'mock_portfolio_id_map'; // { [localId: number]: serverId: string }

type IdMap = Record<number, string>;

function readIdMap(): IdMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ID_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeIdMap(map: IdMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
  } catch {
    // 무시 — 매핑 실패는 동기화 비용일 뿐 사용성을 막지 않음
  }
}

export function getServerId(localId: number): string | undefined {
  return readIdMap()[localId];
}

export function setServerId(localId: number, serverId: string): void {
  const map = readIdMap();
  map[localId] = serverId;
  writeIdMap(map);
}

export function removeServerId(localId: number): void {
  const map = readIdMap();
  delete map[localId];
  writeIdMap(map);
}

/** localId(number) ← serverId(string) 역방향 조회 */
export function findLocalIdByServerId(serverId: string): number | undefined {
  const map = readIdMap();
  for (const [k, v] of Object.entries(map)) {
    if (v === serverId) return Number(k);
  }
  return undefined;
}

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

// ──────── 매퍼 ────────
/** description은 백엔드에서 NOT NULL. 빈 값일 경우 안전 fallback. */
function ensureDescription(item: PortfolioItem): string {
  if (item.description && item.description.trim().length > 0) {
    return item.description;
  }
  return item.summary?.trim() || item.title;
}

export function toCreatePayload(item: PortfolioItem): CreateItemPayload {
  return {
    type: TYPE_TO_BACKEND[item.type],
    title: item.title,
    description: ensureDescription(item),
    techStack: [], // 프론트 PortfolioItem에는 별도 techStack 없음 → 빈 배열
    duration: item.period || '',
    role: '', // PortfolioItem에 role 없음 → 빈 문자열 (백엔드 NOT NULL이지만 길이 제한 없음)
    domain: item.domain || '',
    tags: item.tags ?? [],
    summary: item.summary,
    featured: item.featured ?? false,
    thumbnail: item.thumbnail,
    period: item.period,
    current: item.current ?? false,
  };
}

export function toUpdatePayload(item: PortfolioItem): UpdateItemPayload {
  // 부분 업데이트도 동일 페이로드 (백엔드 dto는 모두 옵셔널)
  return toCreatePayload(item);
}

/** 백엔드 응답 → 프론트 PortfolioItem.
 *  localId는 매핑이 있으면 재사용, 없으면 createdAt 기반으로 새로 부여. */
export function fromBackendItem(b: BackendPortfolioItem): PortfolioItem {
  const existingLocalId = findLocalIdByServerId(b.id);
  const localId =
    existingLocalId ?? new Date(b.createdAt).getTime() ?? Date.now();

  if (!existingLocalId) {
    setServerId(localId, b.id);
  }

  return {
    id: localId,
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
    createdAt: new Date(b.createdAt).getTime(),
  };
}

// ──────── 동기화 헬퍼 ────────
/** 프론트 PortfolioItem 1개를 백엔드와 동기화.
 *  - 매핑된 serverId가 있으면 updateItem
 *  - 없으면 createItem 후 mapping 저장
 *  실패해도 throw하지 않음 — caller(handleSave 등)는 localStorage만 갱신해도 동작해야 함. */
export async function syncItemToBackend(
  item: PortfolioItem,
): Promise<BackendPortfolioItem | null> {
  try {
    const serverId = getServerId(item.id);
    if (serverId) {
      return await apiUpdateItem(serverId, toUpdatePayload(item));
    }
    const created = await apiCreateItem(toCreatePayload(item));
    if (created?.id) setServerId(item.id, created.id);
    return created;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[portfolio-sync] sync failed (localStorage 유지):', err);
    }
    return null;
  }
}

/** 백엔드에서 내 포트폴리오를 가져와 localStorage 아이템과 머지.
 *  - 백엔드에만 있는 항목 → localStorage에 추가 (다른 기기/세션 복원)
 *  - 양쪽에 있는 항목 → localStorage 버전 유지 (편집 중인 풍부한 정보 보호)
 *  - localStorage에만 있는 항목 → 그대로 둠 (다음 저장 시 동기화됨)
 *  실패해도 throw 안 함 — 오프라인이거나 백엔드 미가동 시에도 동작 유지. */
export async function hydratePortfolioFromBackend(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const remote = await apiGetMyPortfolio();
    if (!remote || !Array.isArray(remote.items)) return;

    const localRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
    const localList: PortfolioItem[] = localRaw ? JSON.parse(localRaw) : [];

    const knownLocalIds = new Set(localList.map((it) => it.id));
    const toAdd: PortfolioItem[] = [];

    for (const b of remote.items) {
      const mappedLocalId = findLocalIdByServerId(b.id);
      if (mappedLocalId !== undefined && knownLocalIds.has(mappedLocalId)) {
        continue; // 이미 localStorage에 있음
      }
      const fronted = fromBackendItem(b);
      if (!knownLocalIds.has(fronted.id)) {
        toAdd.push(fronted);
        knownLocalIds.add(fronted.id);
      }
    }

    if (toAdd.length > 0) {
      const merged = [...localList, ...toAdd];
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(merged));
    }

    // 메타(visibility, firstPostAt)도 백엔드 → localStorage 머지.
    // 다른 기기/세션에서 로그인 시 백엔드 값으로 정정.
    if (typeof remote.isPublic === 'boolean') {
      localStorage.setItem(
        VISIBILITY_STORAGE_KEY,
        remote.isPublic ? 'public' : 'private',
      );
    }
    if (remote.firstPostAt) {
      const ts = new Date(remote.firstPostAt).getTime();
      if (!Number.isNaN(ts)) {
        localStorage.setItem(FIRST_POST_STORAGE_KEY, String(ts));
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[portfolio-sync] hydrate failed (localStorage 유지):', err);
    }
  }
}

/** 백엔드에서 아이템 삭제. 매핑도 정리. 실패해도 throw 안 함. */
export async function deleteItemFromBackend(localId: number): Promise<void> {
  const serverId = getServerId(localId);
  if (!serverId) return;
  try {
    await apiDeleteItem(serverId);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[portfolio-sync] delete failed:', err);
    }
  } finally {
    removeServerId(localId);
  }
}
