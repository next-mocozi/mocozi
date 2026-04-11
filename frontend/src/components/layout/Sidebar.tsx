'use client';

import Link from 'next/link';

/** 사이드바 컴포넌트 */
export default function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-gray-200 bg-white p-4 lg:block">
      <nav className="space-y-2">
        <Link
          href="/recruit"
          className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
        >
          구인 게시판
        </Link>
        <Link
          href="/team"
          className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
        >
          팀 목록
        </Link>
        <Link
          href="/profile"
          className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
        >
          내 프로필
        </Link>
        <Link
          href="/chat"
          className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100"
        >
          채팅
        </Link>
      </nav>
    </aside>
  );
}
