'use client';

import Link from 'next/link';

/** 공통 헤더 - 네비게이션 바 */
export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* 로고 */}
        <Link href="/" className="text-xl font-bold text-primary-600">
          모코지
        </Link>

        {/* 네비게이션 */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/recruit"
            className="text-gray-600 transition-colors hover:text-primary-600"
          >
            구인
          </Link>
          <Link
            href="/team"
            className="text-gray-600 transition-colors hover:text-primary-600"
          >
            팀
          </Link>
          <Link
            href="/profile"
            className="text-gray-600 transition-colors hover:text-primary-600"
          >
            프로필
          </Link>
          <Link
            href="/chat"
            className="text-gray-600 transition-colors hover:text-primary-600"
          >
            채팅
          </Link>
        </nav>

        {/* 인증 버튼 */}
        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-sm">
            로그인
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            회원가입
          </Link>
        </div>
      </div>
    </header>
  );
}
