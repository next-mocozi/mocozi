'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/** 로그인 페이지 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/profile');
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="card w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold">로그인</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="university@example.ac.kr"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="input-field"
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full py-3">
            로그인
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className="text-primary-600 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
