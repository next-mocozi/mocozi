'use client';

import Link from 'next/link';

/** 팀 목록 페이지 */
export default function TeamListPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">팀 목록</h1>
        <Link href="/team/create" className="btn-primary">
          팀 만들기
        </Link>
      </div>

      {/* 팀 카드 그리드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Link key={i} href={`/team/${i}`} className="card transition-shadow hover:shadow-md">
            <h3 className="mb-2 text-lg font-semibold">프로젝트 팀 #{i}</h3>
            <p className="mb-3 text-sm text-gray-600">
              함께 멋진 서비스를 만들어가는 팀입니다.
            </p>
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
              <span>팀장: 홍길동</span>
              <span>·</span>
              <span>3/5명</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                웹 개발
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                프로젝트
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
