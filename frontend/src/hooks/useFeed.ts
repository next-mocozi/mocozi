'use client';

import useSWR from 'swr';
import { getFeed, type FeedPortfolio } from '@/lib/portfolio-api';
import { useAuth } from './useAuth';

async function fetchFeed(): Promise<FeedPortfolio[]> {
  const res = await getFeed();
  return res.portfolios ?? [];
}

function hasToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')
  );
}

export function useFeed(): {
  portfolios: FeedPortfolio[] | null;
  isLoading: boolean;
} {
  const { user, loading } = useAuth();
  // 토큰이 있으면 auth 응답을 기다리지 않고 피드 요청을 즉시 병렬 발사.
  // 토큰이 만료됐을 경우 api.ts 인터셉터가 refresh → 실패 시 자동 로그아웃 처리.
  const shouldFetch = hasToken() || !!user;
  const { data, isLoading } = useSWR<FeedPortfolio[]>(
    shouldFetch ? 'feed' : null,
    fetchFeed,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      keepPreviousData: true,
    },
  );
  return {
    portfolios: data !== undefined ? data : null,
    // keepPreviousData: 재방문 시 캐시를 즉시 반환하므로 isLoading이 짧아짐
    isLoading: loading || (shouldFetch && isLoading && !data),
  };
}
