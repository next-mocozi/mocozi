'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';
import { loginApi, logoutApi } from '@/lib/authApi';
import { notifyAuthChanged } from '@/providers/SocketProvider';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  university: string;
  department: string;
  grade: string | null;
  bio: string | null;
  skills: string[];
  roles: string[];
  careerSummary: string | null;
  profileImage: string | null;
  bannerColor: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 포트폴리오/프로필 mock 데이터(localStorage)는 계정별 스코프가 없어, 같은
// 브라우저에서 두 계정 옮겨다니면 이전 사용자의 데이터가 새 사용자에게 노출되거나
// 정리되어 영구 손실됐다.
//
// 정책: 정리 대신 "백업·복원".
//  - 사용자 전환 시 현재 mock_* 를 mock_*__<이전 userId> 로 이름 변경하여 보존.
//  - 새 사용자 본인의 백업(mock_*__<currentUserId>)이 있으면 mock_* 로 복원.
//  - 백업 없으면 mock_* 는 비어있는 상태로 시작 (새 사용자가 0부터 작성).
// 이 패턴 덕에 backend sync 가 아직 안 된 카드/메모도 계정별로 격리 보존되어,
// 두 계정 옮겨다녀도 본인 데이터가 사라지지 않는다.
function reconcileMockOwner(currentUserId: string) {
  if (typeof window === 'undefined') return;
  try {
    const ownerId = localStorage.getItem('mock_portfolio_owner');
    if (ownerId === currentUserId) return; // 같은 사용자 → 데이터 유지

    // 1) 이전 사용자 데이터 백업 (이름 변경: mock_X → mock_X__<oldOwner>)
    if (ownerId) {
      const baseKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        // 이미 백업된 키(`__` 포함)는 건드리지 않는다.
        if (k && k.startsWith('mock_') && !k.includes('__')) baseKeys.push(k);
      }
      baseKeys.forEach((k) => {
        const value = localStorage.getItem(k);
        if (value !== null) {
          try {
            localStorage.setItem(`${k}__${ownerId}`, value);
          } catch {
            // 백업 실패해도 진행 — 다음 단계로
          }
          localStorage.removeItem(k);
        }
      });
    }

    // 2) 새 사용자 본인 백업이 있으면 복원 (mock_X__<currentUser> → mock_X)
    const suffix = `__${currentUserId}`;
    const backupKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('mock_') && k.endsWith(suffix)) backupKeys.push(k);
    }
    backupKeys.forEach((k) => {
      const value = localStorage.getItem(k);
      const baseKey = k.slice(0, -suffix.length);
      if (value !== null) {
        try {
          localStorage.setItem(baseKey, value);
        } catch {
          // 복원 실패해도 진행
        }
        localStorage.removeItem(k);
      }
    });

    localStorage.setItem('mock_portfolio_owner', currentUserId);
  } catch {
    // 무시
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    if (accessToken || refreshToken) {
      api
        .get('/api/users/me')
        .then((res) => {
          const u: AuthUser = res.data.data;
          reconcileMockOwner(u.id);
          setUser(u);
        })
        .catch(() => {
          // 토큰 정리는 api.ts 인터셉터가 담당 (401 → refresh 시도 → 실패 시 로그아웃).
          // 여기선 transient 에러(요청 abort, 네트워크 5xx 등)에서 토큰 건드리지 않음.
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { accessToken, refreshToken, user: userData } = await loginApi(email, password);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    reconcileMockOwner(userData.id);
    notifyAuthChanged(); // SocketProvider가 새 토큰으로 socket 재생성
    setUser(userData);
    return userData;
  };

  const refreshUser = async () => {
    const res = await api.get('/api/users/me');
    setUser(res.data.data);
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // 서버 오류여도 클라이언트 측은 정리
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // mock_* 키는 유지 — 같은 사용자가 재로그인할 때 작성해 둔 포트폴리오가
    // 그대로 복원되도록 한다. 다른 사용자가 로그인하면 login() 안의
    // reconcileMockOwner 가 owner 불일치를 감지해 정리한다.
    notifyAuthChanged(); // SocketProvider가 socket 정리
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUser, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
