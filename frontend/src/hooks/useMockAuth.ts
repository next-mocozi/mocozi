'use client';

// 프론트만으로 로그인 상태를 모사하는 임시 hook.
// TODO: 백엔드 연동 시 useAuth.ts (실제 /api/auth 호출) 로 교체.

import { useEffect, useState } from 'react';

const KEY = 'mock_auth';
const EVT = 'mock-auth-change';

function readState(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEY) === '1';
}

export function useMockAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // hydration mismatch 방지: 클라이언트에서 마운트된 후에만 진짜 상태 노출
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsLoggedIn(readState());
    setHydrated(true);

    const sync = () => setIsLoggedIn(readState());
    // 다른 탭(storage) + 같은 탭(custom event) 양쪽 변경 동기화
    window.addEventListener('storage', sync);
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVT, sync);
    };
  }, []);

  const login = () => {
    localStorage.setItem(KEY, '1');
    window.dispatchEvent(new Event(EVT));
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
    setIsLoggedIn(false);
  };

  return { isLoggedIn, hydrated, login, logout };
}
