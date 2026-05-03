import api from './api';
import { AuthUser } from '@/contexts/AuthContext';

export async function loginApi(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
  const res = await api.post('/api/auth/login', { email, password });
  return res.data.data;
}

export async function logoutApi(): Promise<void> {
  await api.post('/api/auth/logout');
}
