'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/** 이메일 인증 페이지 */
export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // TODO: token이 있으면 자동으로 인증 API 호출

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="card w-full max-w-md text-center">
        {token ? (
          <>
            <div className="mb-4 text-5xl">✉️</div>
            <h1 className="mb-4 text-2xl font-bold">이메일 인증 중...</h1>
            <p className="text-gray-600">잠시만 기다려주세요.</p>
          </>
        ) : (
          <>
            <div className="mb-4 text-5xl">📬</div>
            <h1 className="mb-4 text-2xl font-bold">이메일을 확인해주세요</h1>
            <p className="text-gray-600">
              가입하신 대학교 메일로 인증 링크를 보내드렸습니다.
              <br />
              메일함을 확인해주세요.
            </p>
            <Link href="/login" className="btn-primary mt-6 inline-block">
              로그인으로 이동
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
