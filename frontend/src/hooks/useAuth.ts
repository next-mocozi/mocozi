'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

/** 인증된 사용자 정보 */
interface AuthUser {
  id: string;
  email: string;
  name: string;
  university: string;
}

/** 인증 훅 - 로그인/로그아웃/사용자 상태 관리 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 저장된 토큰이 있으면 사용자 정보 조회
    const token = localStorage.getItem('accessToken');
    if (token) {
      api
        .get('/api/users/me')
        .then((res) => setUser(res.data.data))
        .catch(() => {
          localStorage.removeItem('accessToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /** 로그인 */
  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { accessToken, user: userData } = res.data.data;
    localStorage.setItem('accessToken', accessToken);
    setUser(userData);
    return userData;
  };

  /** 로그아웃 */
  const logout = () => {
    localStorage.removeItem('accessToken');
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, login, logout, isAuthenticated: !!user };
}
