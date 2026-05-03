'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const called = useRef(false);

  useEffect(() => {
    if (!token || called.current) return;
    called.current = true;
    api.get(`/api/auth/verify-email?token=${token}`)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push('/login'), 2000);
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="card w-full max-w-md text-center">
        {!token && (
          <>
            <div className="mb-4 text-5xl">📬</div>
            <h1 className="mb-4 text-2xl font-bold">이메일을 확인해주세요</h1>
            <p className="text-gray-600">
              가입하신 대학교 메일로 인증 링크를 보내드렸습니다.
            </p>
            <Link href="/login" className="btn-primary mt-6 inline-block">
              로그인으로 이동
            </Link>
          </>
        )}
        {token && status === 'loading' && (
          <>
            <div className="mb-4 text-5xl">✉️</div>
            <h1 className="mb-4 text-2xl font-bold">이메일 인증 중...</h1>
            <p className="text-gray-600">잠시만 기다려주세요.</p>
          </>
        )}
        {token && status === 'success' && (
          <>
            <div className="mb-4 text-5xl">✅</div>
            <h1 className="mb-4 text-2xl font-bold">인증 완료!</h1>
            <p className="text-gray-600">잠시 후 로그인 페이지로 이동합니다.</p>
          </>
        )}
        {token && status === 'error' && (
          <>
            <div className="mb-4 text-5xl">❌</div>
            <h1 className="mb-4 text-2xl font-bold">인증 실패</h1>
            <p className="text-gray-600">유효하지 않거나 만료된 링크입니다.</p>
            <Link href="/register" className="btn-primary mt-6 inline-block">
              다시 회원가입
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
