'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolio } from '@/hooks/useMyPortfolio';
import {
  INTRO_STORAGE_KEY,
  VISIBILITY_STORAGE_KEY,
  type PortfolioVisibility,
} from '@/app/portfolio/_lib';

export type MyPortfolioStatus =
  | 'loading'
  | 'unauthenticated'
  | 'unwritten'
  | 'private'
  | 'public';

/** 현재 로그인 사용자의 포트폴리오 작성 상태를 판정.
 *  - unwritten: 자기소개(localStorage) 비어있음 OR 기술스택(user.skills) 0개
 *  - private/public: 작성됨 + visibility (localStorage)
 *  로그인/localStorage 변경에 반응하기 위해 'storage' 이벤트와 커스텀 이벤트
 *  'mocozi:portfolio-changed' 를 함께 구독한다 (같은 탭에서 발생한 변경 추적용).
 */
export function useMyPortfolioStatus(): {
  status: MyPortfolioStatus;
  visibility: PortfolioVisibility | null;
  refresh: () => void;
} {
  const { user, loading } = useAuth();
  const { portfolio } = useMyPortfolio();
  const [tick, setTick] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    introFilled: boolean;
    visibility: PortfolioVisibility;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const intro = localStorage.getItem(INTRO_STORAGE_KEY) ?? '';
      const v = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      return {
        introFilled: intro.trim().length > 0,
        visibility: v === 'public' ? 'public' : 'private',
      };
    } catch {
      return null;
    }
  });

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const read = () => {
      try {
        const intro = localStorage.getItem(INTRO_STORAGE_KEY) ?? '';
        const v = localStorage.getItem(VISIBILITY_STORAGE_KEY);
        setSnapshot({
          introFilled: intro.trim().length > 0,
          visibility: v === 'public' ? 'public' : 'private',
        });
      } catch {
        setSnapshot({ introFilled: false, visibility: 'private' });
      }
    };
    read();
    const onStorage = () => read();
    window.addEventListener('storage', onStorage);
    window.addEventListener('mocozi:portfolio-changed', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mocozi:portfolio-changed', onStorage);
    };
  }, [tick, user?.id]);

  // 새 기기/시크릿 창: localStorage 에 visibility 가 없을 때 백엔드 값으로 초기화
  useEffect(() => {
    if (!portfolio) return;
    try {
      const stored = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (!stored) {
        const v: PortfolioVisibility = portfolio.isPublic ? 'public' : 'private';
        localStorage.setItem(VISIBILITY_STORAGE_KEY, v);
        setSnapshot((prev) => (prev ? { ...prev, visibility: v } : prev));
      }
    } catch {}
  }, [portfolio]);

  if (loading) return { status: 'loading', visibility: null, refresh };
  if (!user) return { status: 'unauthenticated', visibility: null, refresh };
  if (!snapshot) return { status: 'loading', visibility: null, refresh };

  // 자기소개는 localStorage(intro) 또는 백엔드(user.bio) 둘 중 하나라도 있으면 인정.
  // 다른 기기/브라우저에서 로그인해도 user.bio가 백엔드에 있으면 자기소개는 작성된 것으로 판단.
  const introFilled =
    snapshot.introFilled || (user.bio?.trim().length ?? 0) > 0;
  // skills는 백엔드(user.skills)가 진실의 원천. 1개 이상 있어야 onboarding 완료로 인정.
  // bio만 있고 skills가 비어있으면 (예: /profile/edit 에서 bio 만 채운 경우) onboarding 으로.
  const skillsFilled = (user.skills?.length ?? 0) >= 1;
  const written = introFilled && skillsFilled;
  if (!written) return { status: 'unwritten', visibility: null, refresh };
  return {
    status: snapshot.visibility,
    visibility: snapshot.visibility,
    refresh,
  };
}

/** 포트폴리오 데이터(자기소개·visibility) 변경 후 호출하면 같은 탭의
 *  useMyPortfolioStatus 가 즉시 재계산된다. */
export function notifyPortfolioChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('mocozi:portfolio-changed'));
}
