'use client';

import Link from 'next/link';

/** 구인 상세 페이지 */
export default function RecruitDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 게시글 헤더 */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
            모집 중
          </span>
          <span className="text-sm text-gray-500">마감일: 2024.03.15</span>
        </div>
        <h1 className="mb-4 text-2xl font-bold">
          프로젝트 팀원 모집합니다 #{params.id}
        </h1>
        <p className="text-gray-600">
          함께 웹 서비스를 만들 팀원을 찾고 있습니다. 열정 있는 분이라면 누구나
          환영합니다!
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 상세 내용 */}
        <div className="lg:col-span-2">
          <div className="card mb-6">
            <h2 className="mb-4 text-lg font-semibold">프로젝트 소개</h2>
            <p className="text-gray-600">
              IT 대학생을 위한 네트워킹 플랫폼을 개발하고 있습니다. 대학교 메일
              인증 기반으로 신뢰할 수 있는 팀 빌딩 서비스를 목표로 합니다.
            </p>
          </div>

          <div className="card">
            <h2 className="mb-4 text-lg font-semibold">모집 직군</h2>
            <div className="space-y-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="font-medium">프론트엔드 개발자</h3>
                <p className="mt-1 text-sm text-gray-600">
                  React, Next.js, TypeScript 경험자 우대
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="font-medium">백엔드 개발자</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Node.js, Nest.js 또는 Spring 경험자 우대
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사이드바: 팀 정보 + 지원 */}
        <div>
          <div className="card mb-4">
            <h2 className="mb-3 text-lg font-semibold">팀 정보</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500">팀명:</span> 모코지 팀
              </p>
              <p>
                <span className="text-gray-500">팀장:</span> 홍길동
              </p>
              <p>
                <span className="text-gray-500">소속:</span> OO대학교
              </p>
              <p>
                <span className="text-gray-500">인원:</span> 2/5명
              </p>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-semibold">요구 기술</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-600">
                React
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-600">
                TypeScript
              </span>
              <span className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-600">
                Node.js
              </span>
            </div>
            <button className="btn-primary w-full py-3">지원하기</button>
            <Link
              href="/chat/new"
              className="btn-secondary mt-2 block w-full py-3 text-center"
            >
              채팅으로 문의
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
