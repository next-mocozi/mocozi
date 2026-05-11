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
  const { data, isLoading } = useSWR<BackendPortfolio>(
    user && !loading ? KEY : null,
    getMyPortfolio,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );
  return {
    portfolio: data ?? null,
    // 데이터가 한 번도 안 온 첫 로딩만 true — 이후 방문은 캐시를 즉시 반환
    isLoading: loading || (!!user && isLoading && !data),
  };
}

/** 포트폴리오 데이터 변경(저장/삭제) 후 캐시 즉시 무효화 */
export function invalidateMyPortfolio(): Promise<void> {
  return mutate(KEY) as Promise<void>;
}
