'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChatNotifications } from '@/providers/SocketProvider';

/** 공통 헤더 - 네비게이션 바 */
export default function Header() {
  const { isAuthenticated, loading, logout } = useAuth();
  const { totalUnread } = useChatNotifications();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);  // 사이드바 열림/닫힘 상태 (true = 열림)

  // (A) ESC 키로 사이드바 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // (B) 사이드바 열렸을 때 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  // (C) 화면이 md(768px) 이상으로 커지면 자동 닫기
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* 로고 */}
        <Link href="/" className="text-xl font-bold text-primary-600">
          모코지
        </Link>

        {/* 네비게이션 */}
        <nav className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-8 md:flex">
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
            href="/portfolio"
            className="text-gray-600 transition-colors hover:text-primary-600"
          >
            포트폴리오
          </Link>
          <Link
            href="/chat"
            className="relative text-gray-600 transition-colors hover:text-primary-600"
            aria-label={
              totalUnread > 0
                ? `채팅 (안 읽은 메시지 ${totalUnread}개)`
                : '채팅'
            }
          >
            채팅
            {totalUnread > 0 && (
              <span
                className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-red-500"
                aria-hidden
              />
            )}
          </Link>
        </nav>

        {/* 인증 버튼 — loading 끝난 뒤에만 렌더 (서버/클라 mismatch 방지) */}
        <div className="flex items-center gap-3">
          {!loading && isAuthenticated && (
            // 로그인 상태: 프로필/로그아웃은 데스크톱에만 (모바일은 사이드바에 있음)
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/profile" className="btn-secondary text-sm">
                프로필
              </Link>
              <button onClick={logout} className="btn-secondary text-sm">
                로그아웃
              </button>
            </div>
          )}
          {!loading && !isAuthenticated && (
            // 비로그인 상태: 로그인/회원가입은 데스크톱에만 (모바일은 사이드바에 있음)
            <div className="hidden items-center gap-3 md:flex">
              <Link href="/login" className="btn-secondary text-sm">
                로그인
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                회원가입
              </Link>
            </div>
          )}

          {/* 햄버거 버튼 — md 미만에서만 표시 */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-primary-600 md:hidden"
            aria-label="메뉴 열기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 오버레이 — 사이드바 밖 클릭 시 닫기 */}
      <div
        onClick={() => setIsSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* 사이드바 — md 미만에서만 의미 있음 (햄버거가 md 이상에선 안 보이므로 열릴 일 없음) */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-72 bg-white shadow-xl transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isSidebarOpen}
      >
        {/* 사이드바 헤더 — 닫기 버튼 */}
        <div className="flex h-16 items-center justify-end border-b border-gray-200 px-4">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-primary-600"
            aria-label="메뉴 닫기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 사이드바 본체 */}
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/recruit"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
          >
            구인
          </Link>
          <Link
            href="/team"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
          >
            팀
          </Link>
          <Link
            href="/portfolio"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
          >
            포트폴리오
          </Link>
          <Link
            href="/chat"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
          >
            채팅
          </Link>

          {/* 인증 영역 — 로그인/비로그인 상태에 따라 다른 항목 표시 */}
          {!loading && (
            <>
              <div className="my-2 border-t border-gray-200" />
              {isAuthenticated ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
                  >
                    프로필
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsSidebarOpen(false);
                    }}
                    className="rounded-md px-3 py-3 text-left text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
                  >
                    로그아웃
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
                  >
                    로그인
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-md px-3 py-3 text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
                  >
                    회원가입
                  </Link>
                </>
              )}
            </>
          )}
        </nav>
      </aside>
    </header>
  );
}
