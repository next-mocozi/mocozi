// 프론트 PortfolioItem ↔ 백엔드 DTO 변환.
//
// 프론트 id는 number(Date.now() 기반), 백엔드 id는 UUID(string) — 1:1로 매칭하기 위해
// localStorage에 별도 매핑 테이블을 둔다. 기존 코드의 `id: number` 가정을 깨지 않으면서
// 점진적으로 백엔드 동기화를 도입하기 위함.

import type {
  CareerItem,
  Experience,
  PortfolioItem,
  PortfolioItemType,
} from '@/app/portfolio/_lib';
import {
  ITEMS_STORAGE_KEY,
  VISIBILITY_STORAGE_KEY,
  FIRST_POST_STORAGE_KEY,
  EXPS_STORAGE_KEY,
  CAREERS_STORAGE_KEY,
  LINKS_STORAGE_KEY,
} from '@/app/portfolio/_lib';
import type { ProfileLink } from '@/app/portfolio/_platforms';
import {
  createItem as apiCreateItem,
  updateItem as apiUpdateItem,
  deleteItem as apiDeleteItem,
  getMyPortfolio as apiGetMyPortfolio,
  createWorkExperience as apiCreateWork,
  updateWorkExperience as apiUpdateWork,
  deleteWorkExperience as apiDeleteWork,
  createExternalActivity as apiCreateActivity,
  updateExternalActivity as apiUpdateActivity,
  deleteExternalActivity as apiDeleteActivity,
  createPortfolioLink as apiCreateLink,
  updatePortfolioLink as apiUpdateLink,
  deletePortfolioLink as apiDeleteLink,
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
    // production 에서도 항상 출력 — sync silent fail 로 카드가 backend 에 안
    // 가 있는 채 영원히 남던 문제를 빠르게 진단하기 위함.
    console.error('[portfolio-sync] sync failed (localStorage 유지):', err);
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
    //
    // visibility 덮어쓰기 정책 (firstPostAt 와 동일):
    //  - local 비어있음 → backend 값으로 채움 (다른 기기 첫 진입)
    //  - local='private', backend=true → backend 신뢰 (다른 기기에서 공개로 전환)
    //  - local='public', backend=false → 사용자 의도 우선, local 유지.
    //    PATCH /portfolios/me 가 실패한 직후에도 사용자가 방금 한 "공개" 가
    //    다음 hydrate 에서 "비공개" 로 덮어써지는 문제(=visibility 토글이 자꾸
    //    풀리는 현상) 를 차단. 다른 기기 동기화는 backend가 진실이 되는 다음
    //    명시적 PATCH 까지 deferred.
    if (typeof remote.isPublic === 'boolean') {
      const localV = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (!localV) {
        localStorage.setItem(
          VISIBILITY_STORAGE_KEY,
          remote.isPublic ? 'public' : 'private',
        );
      } else if (localV === 'private' && remote.isPublic === true) {
        localStorage.setItem(VISIBILITY_STORAGE_KEY, 'public');
      }
      // localV === 'public' && remote.isPublic === false → local 유지
    }
    if (remote.firstPostAt) {
      const ts = new Date(remote.firstPostAt).getTime();
      if (!Number.isNaN(ts)) {
        // firstPostAt 은 backend 가 진실의 원천. onboarding 시 한 번 정해지고
        // 이후 바뀌지 않는 값이라, local 이 fallback Date.now() 로 채워졌어도
        // backend 값으로 정정해야 한다. (visibility 처럼 사용자가 자주 토글하는
        // 값이 아니므로 무조건 덮어쓰는 게 안전.)
        // 이 정책 덕에 새 기기/시크릿 창에서 첫 진입 시 한 순간 "방금 전" 이
        // 보였다가, hydrate 직후 진짜 onboarding 시점으로 정정된다.
        localStorage.setItem(FIRST_POST_STORAGE_KEY, String(ts));
      }
    }

    // Phase 3 — 부속 메타 머지 (백엔드에만 있는 항목 → localStorage 추가)
    mergeWorkExperiencesFromBackend(remote.workExperiences ?? []);
    mergeActivitiesFromBackend(remote.activities ?? []);
    mergeLinksFromBackend(remote.links ?? []);

    // localStorage → backend 역방향 reconcile.
    // 어떤 이유로 (silent fail / 작성 흐름 도중 멈춤 / 옛 코드 시절 작성 등)
    // backend 에 안 간 항목들을 자동으로 sync. 사용자가 카드를 다시 만들지 않아도
    // 페이지 진입만 하면 backend 가 채워진다. 멱등 — 매핑 있는 건 skip.
    await reconcileLocalToBackend();
  } catch (err) {
    console.error('[portfolio-sync] hydrate failed (localStorage 유지):', err);
  }
}

/** localStorage 에만 있는 (= backend 매핑 없는) 항목들을 backend 로 sync.
 *  items / work / activity / link 4종 모두 처리. 실패해도 throw 안 함. */
async function reconcileLocalToBackend(): Promise<void> {
  if (typeof window === 'undefined') return;

  const readArr = <T,>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  };

  // PortfolioItem
  const items = readArr<PortfolioItem>(ITEMS_STORAGE_KEY);
  for (const it of items) {
    if (!getServerId(it.id)) {
      await syncItemToBackend(it);
    }
  }

  // 실무 경험
  const exps = readArr<Experience>(EXPS_STORAGE_KEY);
  for (const exp of exps) {
    if (!getMappedServerId(WORK_ID_MAP_KEY, exp.id)) {
      await syncWorkExperienceToBackend(exp);
    }
  }

  // 대외 활동
  const careers = readArr<CareerItem>(CAREERS_STORAGE_KEY);
  for (const c of careers) {
    if (!getMappedServerId(ACTIVITY_ID_MAP_KEY, c.id)) {
      await syncActivityToBackend(c);
    }
  }

  // 외부 링크
  const links = readArr<ProfileLink>(LINKS_STORAGE_KEY);
  for (const l of links) {
    if (!getMappedServerId(LINK_ID_MAP_KEY, l.id)) {
      await syncLinkToBackend(l);
    }
  }
}

// ──── hydrate 머지 헬퍼 ────
function mergeWorkExperiencesFromBackend(
  remote: BackendWorkExperience[],
): void {
  if (typeof window === 'undefined') return;
  try {
    const localRaw = localStorage.getItem(EXPS_STORAGE_KEY);
    const local: Experience[] = localRaw ? JSON.parse(localRaw) : [];
    const knownIds = new Set(local.map((e) => e.id));
    const toAdd: Experience[] = [];
    for (const b of remote) {
      const mapped = findLocalIdByServerIdIn(WORK_ID_MAP_KEY, b.id);
      if (mapped !== undefined && knownIds.has(mapped)) continue;
      const localId = mapped ?? new Date(b.createdAt).getTime();
      if (knownIds.has(localId)) continue;
      if (mapped === undefined) setMappedServerId(WORK_ID_MAP_KEY, localId, b.id);
      toAdd.push({
        id: localId,
        company: b.company,
        team: b.team ?? '',
        role: b.role,
        period: b.period,
        current: b.current,
      });
      knownIds.add(localId);
    }
    if (toAdd.length > 0) {
      localStorage.setItem(
        EXPS_STORAGE_KEY,
        JSON.stringify([...local, ...toAdd]),
      );
    }
  } catch {
    // 무시
  }
}

function mergeActivitiesFromBackend(remote: BackendExternalActivity[]): void {
  if (typeof window === 'undefined') return;
  try {
    const localRaw = localStorage.getItem(CAREERS_STORAGE_KEY);
    const local: CareerItem[] = localRaw ? JSON.parse(localRaw) : [];
    const knownIds = new Set(local.map((c) => c.id));
    const toAdd: CareerItem[] = [];
    for (const b of remote) {
      const mapped = findLocalIdByServerIdIn(ACTIVITY_ID_MAP_KEY, b.id);
      if (mapped !== undefined && knownIds.has(mapped)) continue;
      const localId = mapped ?? new Date(b.createdAt).getTime();
      if (knownIds.has(localId)) continue;
      if (mapped === undefined)
        setMappedServerId(ACTIVITY_ID_MAP_KEY, localId, b.id);
      toAdd.push({
        id: localId,
        year: b.year,
        month: b.month ?? undefined,
        content: b.content,
      });
      knownIds.add(localId);
    }
    if (toAdd.length > 0) {
      localStorage.setItem(
        CAREERS_STORAGE_KEY,
        JSON.stringify([...local, ...toAdd]),
      );
    }
  } catch {
    // 무시
  }
}

function mergeLinksFromBackend(remote: BackendPortfolioLink[]): void {
  if (typeof window === 'undefined') return;
  try {
    const localRaw = localStorage.getItem(LINKS_STORAGE_KEY);
    const local: ProfileLink[] = localRaw ? JSON.parse(localRaw) : [];
    const knownIds = new Set(local.map((l) => l.id));
    const knownUrls = new Set(local.map((l) => l.url));
    const toAdd: ProfileLink[] = [];
    for (const b of remote) {
      const mapped = findLocalIdByServerIdIn(LINK_ID_MAP_KEY, b.id);
      if (mapped !== undefined && knownIds.has(mapped)) continue;
      // URL 중복도 중복 추가 방지
      if (knownUrls.has(b.url)) {
        if (mapped === undefined) {
          // 기존 link 와 매핑만 연결
          const existing = local.find((l) => l.url === b.url);
          if (existing) setMappedServerId(LINK_ID_MAP_KEY, existing.id, b.id);
        }
        continue;
      }
      const localId = mapped ?? new Date(b.createdAt).getTime();
      if (knownIds.has(localId)) continue;
      if (mapped === undefined)
        setMappedServerId(LINK_ID_MAP_KEY, localId, b.id);
      toAdd.push({
        id: localId,
        url: b.url,
        label: b.label ?? undefined,
      });
      knownIds.add(localId);
      knownUrls.add(b.url);
    }
    if (toAdd.length > 0) {
      localStorage.setItem(
        LINKS_STORAGE_KEY,
        JSON.stringify([...local, ...toAdd]),
      );
    }
  } catch {
    // 무시
  }
}

/** 백엔드에서 아이템 삭제. 매핑도 정리. 실패해도 throw 안 함. */
export async function deleteItemFromBackend(localId: number): Promise<void> {
  const serverId = getServerId(localId);
  if (!serverId) return;
  try {
    await apiDeleteItem(serverId);
  } catch (err) {
    console.error('[portfolio-sync] delete failed:', err)
  } finally {
    removeServerId(localId);
  }
}

// =====================================================
// Phase 3 — 부속 메타 (실무경험 / 대외활동 / 외부 링크) 매핑·동기화
// =====================================================

/** 종류별 id 매핑 테이블 키 — 충돌 방지를 위해 prefix 분리 */
const WORK_ID_MAP_KEY = 'mock_portfolio_work_id_map';
const ACTIVITY_ID_MAP_KEY = 'mock_portfolio_activity_id_map';
const LINK_ID_MAP_KEY = 'mock_portfolio_link_id_map';

function readMap(key: string): IdMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: IdMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // 무시
  }
}

function getMappedServerId(mapKey: string, localId: number): string | undefined {
  return readMap(mapKey)[localId];
}

function setMappedServerId(
  mapKey: string,
  localId: number,
  serverId: string,
): void {
  const m = readMap(mapKey);
  m[localId] = serverId;
  writeMap(mapKey, m);
}

function removeMappedServerId(mapKey: string, localId: number): void {
  const m = readMap(mapKey);
  delete m[localId];
  writeMap(mapKey, m);
}

function findLocalIdByServerIdIn(
  mapKey: string,
  serverId: string,
): number | undefined {
  const m = readMap(mapKey);
  for (const [k, v] of Object.entries(m)) {
    if (v === serverId) return Number(k);
  }
  return undefined;
}

// ──── 실무 경험 ────
export async function syncWorkExperienceToBackend(
  exp: Experience,
): Promise<BackendWorkExperience | null> {
  try {
    const serverId = getMappedServerId(WORK_ID_MAP_KEY, exp.id);
    const payload = {
      company: exp.company,
      team: exp.team || undefined,
      role: exp.role,
      period: exp.period,
      current: exp.current,
    };
    if (serverId) {
      return await apiUpdateWork(serverId, payload);
    }
    const created = await apiCreateWork(payload);
    if (created?.id) setMappedServerId(WORK_ID_MAP_KEY, exp.id, created.id);
    return created;
  } catch (err) {
    console.error('[portfolio-sync] work sync failed:', err)
    return null;
  }
}

export async function deleteWorkExperienceFromBackend(
  localId: number,
): Promise<void> {
  const serverId = getMappedServerId(WORK_ID_MAP_KEY, localId);
  if (!serverId) return;
  try {
    await apiDeleteWork(serverId);
  } catch (err) {
    console.error('[portfolio-sync] work delete failed:', err)
  } finally {
    removeMappedServerId(WORK_ID_MAP_KEY, localId);
  }
}

// ──── 대외 활동 ────
export async function syncActivityToBackend(
  c: CareerItem,
): Promise<BackendExternalActivity | null> {
  try {
    const serverId = getMappedServerId(ACTIVITY_ID_MAP_KEY, c.id);
    const payload = {
      year: c.year,
      month: c.month || undefined,
      content: c.content,
    };
    if (serverId) {
      return await apiUpdateActivity(serverId, payload);
    }
    const created = await apiCreateActivity(payload);
    if (created?.id) setMappedServerId(ACTIVITY_ID_MAP_KEY, c.id, created.id);
    return created;
  } catch (err) {
    console.error('[portfolio-sync] activity sync failed:', err)
    return null;
  }
}

export async function deleteActivityFromBackend(
  localId: number,
): Promise<void> {
  const serverId = getMappedServerId(ACTIVITY_ID_MAP_KEY, localId);
  if (!serverId) return;
  try {
    await apiDeleteActivity(serverId);
  } catch (err) {
    console.error('[portfolio-sync] activity delete failed:', err)
  } finally {
    removeMappedServerId(ACTIVITY_ID_MAP_KEY, localId);
  }
}

// ──── 외부 링크 ────
export async function syncLinkToBackend(
  link: ProfileLink,
): Promise<BackendPortfolioLink | null> {
  try {
    const serverId = getMappedServerId(LINK_ID_MAP_KEY, link.id);
    const payload = { url: link.url, label: link.label || undefined };
    if (serverId) {
      return await apiUpdateLink(serverId, payload);
    }
    const created = await apiCreateLink(payload);
    if (created?.id) setMappedServerId(LINK_ID_MAP_KEY, link.id, created.id);
    return created;
  } catch (err) {
    console.error('[portfolio-sync] link sync failed:', err)
    return null;
  }
}

export async function deleteLinkFromBackend(localId: number): Promise<void> {
  const serverId = getMappedServerId(LINK_ID_MAP_KEY, localId);
  if (!serverId) return;
  try {
    await apiDeleteLink(serverId);
  } catch (err) {
    console.error('[portfolio-sync] link delete failed:', err)
  } finally {
    removeMappedServerId(LINK_ID_MAP_KEY, localId);
  }
}

/** 전체 배열 동기화 — 편집 페이지에서 한 번에 저장하는 흐름용.
 *  현재 localStorage 의 array 와 백엔드 매핑을 비교해서:
 *   - 매핑이 있는데 array 에 없으면 → 백엔드 삭제
 *   - array 에 있으면 → upsert(syncXxx)
 *  실패해도 throw 안 함. */
export async function syncLinksAllToBackend(
  links: ProfileLink[],
): Promise<void> {
  try {
    const map = readMap(LINK_ID_MAP_KEY);
    const localIds = new Set(links.map((l) => l.id));
    // 삭제: 매핑에는 있지만 array 에서 사라진 것들
    for (const k of Object.keys(map)) {
      const localId = Number(k);
      if (!localIds.has(localId)) {
        await deleteLinkFromBackend(localId);
      }
    }
    // upsert
    for (const link of links) {
      await syncLinkToBackend(link);
    }
  } catch (err) {
    console.error('[portfolio-sync] links bulk sync failed:', err)
  }
}
