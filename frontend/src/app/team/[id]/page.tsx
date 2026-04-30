'use client';

import Link from 'next/link';
import { use } from 'react';
import { getTeamById } from '../_data';

/** 팀 상세 페이지 */
// TODO: 백엔드 연동 시 `GET /api/teams/:id` 로 교체 (CLAUDE.md §11 TODO)
export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const team = getTeamById(Number(id));

  if (!team) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <p className="text-2xl">🔍</p>
        <p className="text-lg font-semibold">존재하지 않는 팀입니다</p>
        <p className="text-sm text-gray-500">
          삭제되었거나 잘못된 주소일 수 있어요.
        </p>
        <Link
          href="/team"
          className="mt-2 rounded-full border border-blue-200 px-5 py-2 text-sm text-blue-600 transition-all hover:bg-blue-600 hover:text-white"
        >
          팀 목록으로
        </Link>
      </div>
    );
  }

  const isClosed = team.status === 'closed';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/team"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 팀 목록
      </Link>

      {/* 팀 헤더 */}
      <div
        className={`relative overflow-hidden rounded-2xl px-8 py-10 text-white shadow-md ${
          isClosed
            ? 'bg-gradient-to-br from-gray-400 to-gray-600'
            : 'bg-gradient-to-br from-blue-500 to-blue-700'
        }`}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            {team.category}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isClosed
                ? 'bg-gray-200 text-gray-600'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {isClosed ? '모집 완료' : '모집 중'}
          </span>
        </div>
        <h1 className="text-3xl font-bold">{team.name}</h1>
        <p className="mt-2 text-white/90">{team.intro}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* 좌측: 기획서 + 모집 정보 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 기획서 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">기획서</h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-500">
                  프로젝트 개요
                </h3>
                <p className="text-gray-700">{team.intro}</p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-500">
                  진행 일정
                </h3>
                <p className="text-gray-700">{team.period}</p>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-500">
                  팀 형태
                </h3>
                <p className="text-gray-700">{team.category}</p>
              </div>
            </div>
          </div>

          {/* 모집 직군 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">모집 직군</h2>
            <div className="flex flex-wrap gap-2">
              {team.recruitingRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-sm leading-none text-white"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>

          {/* 기술 스택 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">기술 스택</h2>
            <div className="flex flex-wrap gap-2">
              {team.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 우측: 팀원 + 지원 버튼 */}
        <div className="space-y-6">
          {/* 인원 정보 */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              팀원 ({team.currentMembers}/{team.totalMembers}명)
            </h2>
            <div className="space-y-3">
              {/* 팀장 */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                  {team.leader[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{team.leader}</p>
                  <p className="text-xs text-blue-600">팀장</p>
                </div>
              </div>

              {/* 나머지 자리 (mock: 이름 미정) */}
              {/* TODO: 백엔드 연동 시 실제 멤버 목록(`TeamMember`)으로 교체 */}
              {Array.from({ length: team.currentMembers - 1 }).map((_, i) => (
                <div key={`member-${i}`} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500">
                    👤
                  </div>
                  <div>
                    <p className="text-sm font-medium">팀원</p>
                    <p className="text-xs text-gray-500">합류 완료</p>
                  </div>
                </div>
              ))}

              {/* 빈 자리 */}
              {Array.from({ length: team.totalMembers - team.currentMembers }).map(
                (_, i) => (
                  <div key={`empty-${i}`} className="flex items-center gap-3 opacity-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-sm text-gray-400">
                      +
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-400">빈 자리</p>
                      <p className="text-xs text-gray-400">모집 중</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 지원 버튼 */}
          <button
            disabled={isClosed}
            className={`w-full rounded-full py-3 text-sm font-medium shadow-md transition-all ${
              isClosed
                ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isClosed ? '모집 완료된 팀입니다' : '지원하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
