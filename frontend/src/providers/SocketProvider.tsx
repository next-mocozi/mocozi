'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useSocket } from '@/hooks/useSocket';

/**
 * 앱 전역 socket Provider
 *
 * 목적:
 *  - useSocket / useNotifications를 layout.tsx에서 한 번만 호출
 *  - 모든 페이지가 같은 socket 인스턴스 + 같은 unread 상태를 공유
 *  - 페이지 전환 시 socket 재생성·재연결 비용 회피
 *
 * 토큰 변동 대응 (Day 11 fix):
 *  - localStorage.accessToken은 SSR/CSR 모두에서 lazy 접근. 첫 마운트 시점에 없으면
 *    그냥 socket 안 만듦 → 그 후 로그인하면 토큰이 들어왔는데 socket이 안 만들어지는 문제
 *  - 해결: token을 React state로 추적하고 'storage' 이벤트(다른 탭) +
 *    'mocozi:auth-changed' 커스텀 이벤트(같은 탭의 로그인/로그아웃)로 갱신
 *  - useSocket의 options.token deps가 변경됨 → effect 재실행 → 새 socket 생성
 *
 * 두 종류의 소비자 훅을 노출:
 *  - useChatSocket()        — 연결 상태 + 액션 메서드
 *  - useChatNotifications() — unread 상태 + 토스트 트리거
 */

type SocketCtx = ReturnType<typeof useSocket>;
type NotificationsCtx = ReturnType<typeof useNotifications>;

const SocketContext = createContext<SocketCtx | null>(null);
const NotificationsContext = createContext<NotificationsCtx | null>(null);

/**
 * 같은 탭에서 로그인/로그아웃 시 dispatch 되는 커스텀 이벤트.
 * useAuth.login/logout 등에서 setItem 직후 dispatch.
 */
export const AUTH_CHANGED_EVENT = 'mocozi:auth-changed';

/** localStorage에서 토큰 읽기 (SSR-safe) */
function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function SocketProvider({ children }: { children: ReactNode }) {
  // 토큰을 React state로 보유 — 변경되면 useSocket effect 재실행 트리거
  const [token, setToken] = useState<string | null>(null);

  // 마운트 시 초기 토큰 + 변동 이벤트 listen
  useEffect(() => {
    setToken(readToken());

    const refresh = () => setToken(readToken());
    // 'storage' 이벤트는 OTHER 탭이 localStorage를 변경할 때만 발생 — 같은 탭은 안 옴
    window.addEventListener('storage', refresh);
    // 같은 탭의 로그인/로그아웃은 커스텀 이벤트로 알림
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, []);

  // useSocket는 options.token이 바뀌면 자동으로 socket을 재생성
  const socketState = useSocket({ token: token ?? undefined });
  // 같은 socket 인스턴스를 공유. socket이 null이면 useNotifications도 listener 등록 안 함
  const notificationsState = useNotifications(socketState.socket);

  return (
    <SocketContext.Provider value={socketState}>
      <NotificationsContext.Provider value={notificationsState}>
        {children}
      </NotificationsContext.Provider>
    </SocketContext.Provider>
  );
}

/**
 * SocketProvider 안에서만 호출 가능. 밖에서 호출 시 명확한 에러로 위치 오류 알림.
 */
export function useChatSocket(): SocketCtx {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error(
      'useChatSocket은 <SocketProvider> 내부에서만 호출할 수 있습니다.',
    );
  }
  return ctx;
}

export function useChatNotifications(): NotificationsCtx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      'useChatNotifications은 <SocketProvider> 내부에서만 호출할 수 있습니다.',
    );
  }
  return ctx;
}

/**
 * 로그인/로그아웃 후 호출하면 SocketProvider가 즉시 토큰 갱신.
 * api 인터셉터가 자동 발사하면 좋겠으나 명시적 트리거가 단순.
 */
export function notifyAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}
