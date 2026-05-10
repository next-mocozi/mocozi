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

// 포트폴리오/프로필 mock 데이터(localStorage)는 계정별 스코프가 없어,
// 같은 브라우저에서 다른 계정으로 로그인하면 이전 사용자의 직군·링크·아이템 등이
// 그대로 남는다. 사용자 id 가 바뀐 시점(소유자 불일치)에만 mock_* 를 정리한다.
// owner 가 비어있으면 현재 사용자를 새 owner 로 등록해 (재)로그인 시 데이터를 유지한다.
function reconcileMockOwner(currentUserId: string) {
  try {
    const ownerId = localStorage.getItem('mock_portfolio_owner');
    if (ownerId === currentUserId) return; // 같은 사용자 → 데이터 유지
    if (!ownerId) {
      // 첫 사용 또는 직전에 데이터가 비어있던 상태 → 현재 사용자로 owner 등록
      localStorage.setItem('mock_portfolio_owner', currentUserId);
      return;
    }
    // 다른 사용자 → 이전 사용자의 mock_* 정리 후 owner 갱신
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('mock_')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
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
          // 토큰 정리는 api.ts 인터셉터가 담당
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
