import api from '@/lib/api';

/**
 * 채팅 첨부(파일/이미지) signed URL 클라이언트 캐시 + 발급 헬퍼.
 *
 * Phase A 정책 (§16):
 *  - 메시지 마커엔 storage path만 들어있음. 표시 시 backend가 1h TTL signed URL 발급
 *  - 캐시: 같은 path를 1h 안에 재발급하지 않도록 Map<path, {url, expiresAt}>
 *  - 만료된 항목은 자동 제거 + 재발급 큐
 *
 * 동시 호출 합치기:
 *  - 메시지 리스트 렌더 시 같은 batch에 들어온 path들을 모아 한 번에 backend 호출
 *  - 짧은 시간(50ms) 안 다른 컴포넌트가 다른 path 요청해도 같은 in-flight batch에 합류
 */

interface SignedEntry {
  url: string | null;
  expiresAt: number; // epoch ms (null 응답은 30초만 캐시해서 재시도 가능)
}

const cache = new Map<string, SignedEntry>();

/** 발급 진행 중인 path 모음 — 같은 path 중복 요청 합치기 */
const inFlight = new Map<string, Promise<SignedEntry>>();

/** 50ms 안에 모인 path 배치로 한 번의 backend 호출 만들기 (간단한 micro-batch) */
let pendingBatch: Array<{
  path: string;
  resolve: (entry: SignedEntry) => void;
}> = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const BATCH_WINDOW_MS = 50;
/** null 응답 캐시 TTL — 30초. 일시 오류 후 빠르게 재시도 */
const NULL_CACHE_MS = 30 * 1000;

async function flushBatch() {
  const batch = pendingBatch;
  pendingBatch = [];
  batchTimer = null;
  if (batch.length === 0) return;

  const paths = Array.from(new Set(batch.map((b) => b.path)));
  try {
    const res = await api.post<{
      success: boolean;
      data: { signed: Array<{ path: string; url: string | null; expiresAt: string | null }> };
    }>('/api/chat/attachments/sign-url', { paths });
    const byPath = new Map<string, SignedEntry>();
    for (const s of res.data.data.signed) {
      const entry: SignedEntry = {
        url: s.url,
        expiresAt: s.expiresAt
          ? new Date(s.expiresAt).getTime()
          : Date.now() + NULL_CACHE_MS,
      };
      byPath.set(s.path, entry);
      cache.set(s.path, entry);
    }
    for (const item of batch) {
      item.resolve(
        byPath.get(item.path) ?? {
          url: null,
          expiresAt: Date.now() + NULL_CACHE_MS,
        },
      );
    }
  } catch {
    // 네트워크/서버 오류 — 짧게 캐시하고 null 반환 (다음 시도 가능)
    const fallback: SignedEntry = {
      url: null,
      expiresAt: Date.now() + NULL_CACHE_MS,
    };
    for (const item of batch) {
      cache.set(item.path, fallback);
      item.resolve(fallback);
    }
  }
}

/**
 * path 하나에 대해 signed URL 발급(또는 cache hit).
 *
 * 만료된 entry는 자동 갱신. null 응답(권한 없음/메시지 삭제 등)은 30초 캐시 후 재시도.
 */
export async function getSignedUrl(path: string): Promise<string | null> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    // 1분 이상 여유 있으면 그대로 사용 (만료 임박 시 재발급)
    return cached.url;
  }

  // in-flight 합치기
  const existing = inFlight.get(path);
  if (existing) {
    return existing.then((e) => e.url);
  }

  const promise = new Promise<SignedEntry>((resolve) => {
    pendingBatch.push({ path, resolve });
    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        void flushBatch();
      }, BATCH_WINDOW_MS);
    }
  });
  inFlight.set(path, promise);
  try {
    const entry = await promise;
    return entry.url;
  } finally {
    inFlight.delete(path);
  }
}

/** 캐시 직접 무효화 — 메시지 삭제 등 즉시 반영 필요할 때 */
export function invalidateSignedUrl(path: string) {
  cache.delete(path);
}

/** 테스트/디버그 용 — 전체 캐시 초기화 */
export function clearSignedUrlCache() {
  cache.clear();
}
