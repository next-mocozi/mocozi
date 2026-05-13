'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MailIcon } from '@/components/icons/CommonIcons';
import api from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('유효하지 않거나 만료된 링크입니다.');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const called = useRef(false);

  useEffect(() => {
    if (!token || called.current) return;
    called.current = true;
    api.get(`/api/auth/verify-email?token=${token}`)
      .then(() => {
        setStatus('success');
        setTimeout(() => router.push('/login'), 2000);
      })
      .catch((err: any) => {
        setErrorMessage(err.response?.data?.message || '유효하지 않거나 만료된 링크입니다.');
        setStatus('error');
      });
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await api.post('/api/auth/resend-verification', { email: resendEmail });
      setResendDone(true);
    } catch {
      alert('재발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
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
          <div className="mb-4 flex justify-center text-primary-500">
            <MailIcon className="h-12 w-12" />
          </div>
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
          <p className="mb-6 text-gray-600">{errorMessage}</p>
          {resendDone ? (
            <p className="text-sm text-green-600">인증 메일을 재발송했습니다. 메일함을 확인해주세요.</p>
          ) : (
            <div className="mt-2 text-left">
              <p className="mb-2 text-sm text-gray-500">인증 메일을 다시 받으시겠어요?</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="가입한 이메일 주소"
                  className="input-field flex-1"
                />
                <button
                  onClick={handleResend}
                  disabled={resendLoading || !resendEmail}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  {resendLoading ? '발송 중...' : '재발송'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <Suspense fallback={
        <div className="card w-full max-w-md text-center">
          <div className="mb-4 flex justify-center text-primary-500">
            <MailIcon className="h-12 w-12" />
          </div>
          <h1 className="mb-4 text-2xl font-bold">이메일 인증 중...</h1>
          <p className="text-gray-600">잠시만 기다려주세요.</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
