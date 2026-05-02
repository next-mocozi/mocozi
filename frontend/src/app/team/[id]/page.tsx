'use client';

import Link from 'next/link';
import { use } from 'react';

// ───────── 백엔드 enum 정렬 (Prisma `enum TeamType`) ─────────
type TeamType = 'STUDY' | 'COMPETITION' | 'HACKATHON' | 'PROJECT';
type TeamStatus = 'recruiting' | 'closed';

const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  STUDY: '스터디',
  COMPETITION: '공모전',
  HACKATHON: '해커톤',
  PROJECT: '개발',
};

// TODO: 백엔드 연동 시 `GET /api/teams/:id` 응답으로 교체
const MOCK_TEAMS: {
  id: number;
  name: string;
  leader: string;
  currentMembers: number;
  totalMembers: number;
  period: string;
  recruitingRoles: string[];
  skills: string[];
  intro: string;
  type: TeamType;
  status: TeamStatus;
}[] = [
  {
    id: 1,
    name: '모코지',
    leader: '홍길동',
    currentMembers: 3,
    totalMembers: 5,
    period: '2026.05 ~ 2026.08',
    recruitingRoles: ['프론트엔드', '백엔드'],
    skills: ['Next.js', 'NestJS', 'PostgreSQL'],
    intro: 'IT계열 대학생을 위한 구인/네트워킹 플랫폼을 만듭니다.',
    type: 'PROJECT',
    status: 'recruiting',
  },
  {
    id: 2,
    name: '캠퍼스픽',
    leader: '김민준',
    currentMembers: 2,
    totalMembers: 4,
    period: '2026.06 ~ 2026.09',
    recruitingRoles: ['프론트엔드', 'UI/UX 디자이너'],
    skills: ['React', 'TypeScript', 'Figma'],
    intro: '대학 행사 정보를 모아주는 큐레이션 서비스를 개발 중입니다.',
    type: 'PROJECT',
    status: 'recruiting',
  },
  {
    id: 3,
    name: '딥서치',
    leader: '이서연',
    currentMembers: 4,
    totalMembers: 6,
    period: '2026.04 ~ 2026.07',
    recruitingRoles: ['AI/ML', '데이터'],
    skills: ['Python', 'PyTorch', 'LangChain'],
    intro: 'LLM 기반 학술 검색 도구를 만드는 팀입니다.',
    type: 'COMPETITION',
    status: 'recruiting',
  },
  {
    id: 4,
    name: '핀트리',
    leader: '박지훈',
    currentMembers: 5,
    totalMembers: 5,
    period: '2026.05 ~ 2026.10',
    recruitingRoles: ['백엔드', 'DevOps/인프라'],
    skills: ['Spring Boot', 'AWS', 'Docker'],
    intro: '대학생 가계부 핀테크 서비스를 함께 개발할 팀원을 찾습니다.',
    type: 'PROJECT',
    status: 'closed',
  },
  {
    id: 5,
    name: '코드스터디',
    leader: '최유진',
    currentMembers: 5,
    totalMembers: 8,
    period: '2026.05 ~ 2026.06',
    recruitingRoles: ['프론트엔드', '백엔드', '풀스택'],
    skills: ['JavaScript', 'TypeScript'],
    intro: '알고리즘과 CS 스터디를 함께할 팀원을 모집합니다.',
    type: 'STUDY',
    status: 'recruiting',
  },
  {
    id: 6,
    name: '잇플',
    leader: '정하늘',
    currentMembers: 2,
    totalMembers: 5,
    period: '2026.07 ~ 2026.09',
    recruitingRoles: ['모바일', '백엔드'],
    skills: ['React Native', 'NestJS', 'PostgreSQL'],
    intro: '식단 추천 모바일 앱을 만드는 해커톤 팀입니다.',
    type: 'HACKATHON',
    status: 'recruiting',
  },
  {
    id: 7,
    name: '게임잼',
    leader: '강수빈',
    currentMembers: 4,
    totalMembers: 4,
    period: '2026.06 ~ 2026.06',
    recruitingRoles: ['게임', '프론트엔드'],
    skills: ['Unity', 'JavaScript'],
    intro: '주말 게임잼에 출전할 인디 게임 개발 팀입니다.',
    type: 'HACKATHON',
    status: 'closed',
  },
  {
    id: 8,
    name: '데이터로그',
    leader: '윤도현',
    currentMembers: 4,
    totalMembers: 6,
    period: '2026.05 ~ 2026.08',
    recruitingRoles: ['데이터', 'AI/ML'],
    skills: ['Python', 'Pandas', 'TensorFlow'],
    intro: '교내 학생 데이터를 분석해 인사이트를 만드는 팀입니다.',
    type: 'COMPETITION',
    status: 'recruiting',
  },
  {
    id: 9,
    name: '시큐브',
    leader: '한지원',
    currentMembers: 2,
    totalMembers: 4,
    period: '2026.05 ~ 2026.11',
    recruitingRoles: ['보안', '백엔드'],
    skills: ['Python', 'Linux', 'AWS'],
    intro: '오픈소스 보안 분석 도구 개발 팀입니다.',
    type: 'STUDY',
    status: 'recruiting',
  },
];

/** 팀 상세 페이지 */
// TODO: 백엔드 연동 시 `GET /api/teams/:id` 로 교체 (CLAUDE.md §11 TODO)
export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const team = MOCK_TEAMS.find((t) => t.id === Number(id));

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
            {TEAM_TYPE_LABEL[team.type]}
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
                <p className="text-gray-700">{TEAM_TYPE_LABEL[team.type]}</p>
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
