'use client';

import useSWR from 'swr';
import { getFeed, type FeedPortfolio } from '@/lib/portfolio-api';
import { useAuth } from './useAuth';

async function fetchFeed(): Promise<FeedPortfolio[]> {
  const res = await getFeed();
  return res.portfolios ?? [];
}

export function useFeed(): {
  portfolios: FeedPortfolio[] | null;
  isLoading: boolean;
} {
  const { user, loading } = useAuth();
  const { data, isLoading } = useSWR<FeedPortfolio[]>(
    user && !loading ? 'feed' : null,
    fetchFeed,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );
  return {
    // undefined(미수신)와 []는 구분: null=아직 로딩, []=결과 없음
    portfolios: data !== undefined ? data : null,
    isLoading: loading || (!!user && isLoading && !data),
  };
}
