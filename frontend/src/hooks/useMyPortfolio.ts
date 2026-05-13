'use client';

import useSWR, { mutate } from 'swr';
import { getMyPortfolio, type BackendPortfolio } from '@/lib/portfolio-api';
import { useAuth } from './useAuth';

const KEY = 'my-portfolio';

export function useMyPortfolio(): {
  portfolio: BackendPortfolio | null;
  isLoading: boolean;
} {
  const { user, loading } = useAuth();
  const shouldFetch =
    (typeof window !== 'undefined' &&
      !!(
        localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')
      )) ||
    !!user;
  const { data, isLoading } = useSWR<BackendPortfolio>(
    shouldFetch ? KEY : null,
    getMyPortfolio,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );
  return {
    portfolio: data ?? null,
    // 데이터가 한 번도 안 온 첫 로딩만 true — 이후 방문은 캐시를 즉시 반환
    isLoading: loading || (shouldFetch && isLoading && !data),
  };
}

/** 포트폴리오 데이터 변경(저장/삭제) 후 캐시 즉시 무효화 */
export function invalidateMyPortfolio(): Promise<void> {
  // 내 포트폴리오 + 전체 피드 캐시 동시 무효화
  // (피드는 내 수정 결과를 다른 사용자도 보지만, 우선 본인이 즉시 갱신본을 보도록)
  return Promise.all([mutate(KEY), mutate('feed')]) as unknown as Promise<void>;
}
