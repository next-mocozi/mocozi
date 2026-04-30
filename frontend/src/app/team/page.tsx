'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  MOCK_TEAMS,
  TEAM_CATEGORIES,
  type TeamCategory,
  type TeamStatus,
} from './_data';

const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
  if (list.includes(item)) {
    setList(list.filter((i) => i !== item));
  } else {
    setList([...list, item]);
  }
};

/** 팀 목록 페이지 */
export default function TeamListPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  // 모집 상태 토글: 'recruiting' | 'closed'
  const [statusFilter, setStatusFilter] = useState<TeamStatus>('recruiting');
  // 팀 형태 필터 (null = 전체)
  const [categoryFilter, setCategoryFilter] = useState<TeamCategory | null>(null);

  const applySearch = () => setAppliedKeyword(keyword.trim());

  const filteredTeams = useMemo(() => {
    return MOCK_TEAMS.filter((t) => {
      // 0) 모집 상태
      if (t.status !== statusFilter) return false;

      // 0-1) 팀 형태
      if (categoryFilter && t.category !== categoryFilter) return false;

      // 1) 키워드: 팀명·한줄소개·팀장·모집직군·스킬 부분일치
      if (appliedKeyword) {
        const q = appliedKeyword.toLowerCase();
        const haystack = [
          t.name,
          t.intro,
          t.leader,
          ...t.recruitingRoles,
          ...t.skills,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // 2) 직군: 팀이 모집하는 직군과 교집합
      const roleFilters = appliedRoles.filter((r) => r !== '전체');
      if (roleFilters.length > 0) {
        const hit = roleFilters.some((r) => t.recruitingRoles.includes(r));
        if (!hit) return false;
      }

      // 3) 스킬: OR 조건
      if (appliedSkills.length > 0) {
        const hit = appliedSkills.some((s) => t.skills.includes(s));
        if (!hit) return false;
      }

      return true;
    });
  }, [appliedKeyword, appliedRoles, appliedSkills, statusFilter, categoryFilter]);

  const hasActiveFilters =
    appliedKeyword !== '' || appliedRoles.length > 0 || appliedSkills.length > 0;

  return (
    <div className="flex w-full items-center gap-2">
      <div className="w-full px-30 py-10">
        {/* 상단 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">팀 목록</h1>
          <Link
            href="/team/create"
            className="rounded-full bg-blue-600 px-5 py-2 text-sm text-white shadow-md transition-all hover:bg-blue-700"
          >
            + 팀 만들기
          </Link>
        </div>

        {/* 모집 상태 토글 (모집 중 / 모집 완료) */}
        <div className="mb-4 inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 shadow-sm">
          <button
            onClick={() => setStatusFilter('recruiting')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              statusFilter === 'recruiting'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            팀원 모집 중
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              statusFilter === 'closed'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            팀원 모집 완료
          </button>
        </div>

        {/* 팀 형태 필터 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
              categoryFilter === null
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          {TEAM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                categoryFilter === cat
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {/* 검색창 */}
          <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 px-6 py-3 shadow-md">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              placeholder="팀 이름, 소개, 팀장, 직군으로 검색"
              className="min-w-[120px] flex-1 bg-transparent outline-none"
            />
            <button
              type="button"
              onClick={applySearch}
              aria-label="검색"
              className="text-blue-600 transition-all hover:text-blue-800"
            >
              🔍
            </button>
          </div>

          {/* 상세 검색 */}
          <button
            onClick={() => {
              setSelectedRoles(appliedRoles);
              setSelectedSkills(appliedSkills);
              setIsOpen(true);
            }}
            className="rounded-full border border-blue-200 bg-white px-6 py-3 text-blue-600 shadow-md transition-all hover:bg-blue-600 hover:text-white hover:shadow-lg"
          >
            ➕🔎
          </button>
        </div>

        {/* 적용된 필터 태그 라인 */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {appliedKeyword && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">키워드:</span>
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                  <button
                    onClick={() => {
                      setAppliedKeyword('');
                      setKeyword('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="키워드 제거"
                  >
                    ✕
                  </button>
                  {appliedKeyword}
                </span>
              </div>
            )}
            {appliedRoles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">모집 직군:</span>
                {appliedRoles.map((role) => (
                  <span
                    key={role}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-600"
                  >
                    <button
                      onClick={() =>
                        setAppliedRoles(appliedRoles.filter((r) => r !== role))
                      }
                      className="text-blue-400 hover:text-blue-700"
                      aria-label={`${role} 제거`}
                    >
                      ✕
                    </button>
                    {role}
                  </span>
                ))}
              </div>
            )}
            {appliedSkills.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">기술 스택:</span>
                {appliedSkills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-600"
                  >
                    <button
                      onClick={() =>
                        setAppliedSkills(appliedSkills.filter((s) => s !== skill))
                      }
                      className="text-gray-400 hover:text-gray-700"
                      aria-label={`${skill} 제거`}
                    >
                      ✕
                    </button>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          {statusFilter === 'recruiting' ? '모집 중' : '모집 완료'}
          {categoryFilter && ` · ${categoryFilter}`}{' '}
          <span className="font-semibold text-blue-600">{filteredTeams.length}</span>팀
        </div>

        {filteredTeams.length === 0 ? (
          <div className="mt-6 flex h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-gray-100 bg-white text-center shadow-sm transition-all hover:shadow-md">
            <p className="text-2xl">🔍</p>
            <p className="text-base font-semibold">검색 결과가 없습니다</p>
            <p className="text-sm text-gray-400">키워드나 필터를 변경해 보세요.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTeams.map((team) => {
              const isClosed = team.status === 'closed';
              return (
                <Link
                  key={team.id}
                  href={`/team/${team.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  {/* 상단 팀 이름 영역 */}
                  <div
                    className={`relative flex flex-col items-center justify-center px-4 py-8 ${
                      isClosed
                        ? 'bg-gradient-to-br from-gray-400 to-gray-600'
                        : 'bg-gradient-to-br from-blue-500 to-blue-700'
                    }`}
                  >
                    <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                      {team.category}
                    </span>
                    <p className="text-center text-2xl font-bold text-white">
                      {team.name}
                    </p>
                  </div>

                  {/* 카드 내용 */}
                  <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                    {/* 한줄 소개 */}
                    <p className="mb-4 text-center text-sm text-gray-600 line-clamp-2">
                      {team.intro}
                    </p>

                    {/* 메타 정보: 팀장 / 인원 / 기간 */}
                    <div className="mb-4 space-y-1.5 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-xs text-gray-400">팀장</span>
                        <span className="font-medium text-gray-700">{team.leader}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-xs text-gray-400">인원</span>
                        <span className="font-medium text-gray-700">
                          {team.currentMembers}/{team.totalMembers}명
                        </span>
                        {isClosed && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">
                            모집완료
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-xs text-gray-400">기간</span>
                        <span className="font-medium text-gray-700">{team.period}</span>
                      </div>
                    </div>

                    {/* 모집 직군 */}
                    <div className="mb-4">
                      <p className="mb-2 text-xs text-gray-400">모집 직군</p>
                      <div className="flex flex-wrap gap-1">
                        {team.recruitingRoles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 자세히 보기 버튼 */}
                    <button className="mt-auto rounded-full border border-blue-200 py-2 text-sm text-blue-600 transition-all hover:bg-blue-600 hover:text-white">
                      자세히 보기
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 검색 모달 */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div>
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-[500px] rounded-2xl bg-white p-6 shadow-xl"
            >
              {/* 헤더 */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold">상세 검색</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* 모집 직군 */}
              <p className="mb-2 font-semibold">모집 직군</p>
              <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-gray-100 p-3">
                {[
                  '전체',
                  '프론트엔드',
                  '백엔드',
                  '풀스택',
                  '모바일',
                  'DevOps/인프라',
                  'AI/ML',
                  '데이터',
                  '보안',
                  'QA',
                  '게임',
                  '임베디드',
                  'UI/UX 디자이너',
                  'PM/PO',
                ].map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleItem(role, selectedRoles, setSelectedRoles)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                      selectedRoles.includes(role)
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* 기술 스택 */}
              <div className="mb-4">
                <br />
                <p className="mb-2 font-semibold">기술 스택</p>

                <input
                  type="text"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="스킬 검색..."
                  className="mb-3 w-full rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />

                <div className="flex max-h-48 flex-col gap-3 overflow-y-auto rounded-xl border border-gray-100 p-3">
                  {[
                    {
                      label: '프론트엔드',
                      skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Redux', 'Vite'],
                    },
                    {
                      label: '백엔드',
                      skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go', 'Kotlin', 'PHP', 'Rust'],
                    },
                    {
                      label: '모바일',
                      skills: ['React Native', 'Flutter', 'Swift', 'iOS', 'Android'],
                    },
                    {
                      label: '데이터베이스',
                      skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'GraphQL'],
                    },
                    {
                      label: 'DevOps',
                      skills: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Linux'],
                    },
                    {
                      label: 'AI/데이터',
                      skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain', 'OpenAI API'],
                    },
                    {
                      label: '툴/기타',
                      skills: ['Git', 'GitHub', 'Figma', 'Jest', 'Jira', 'Unity'],
                    },
                  ].map(({ label, skills }) => {
                    const filtered = skills.filter((skill) =>
                      skill.toLowerCase().includes(skillSearch.toLowerCase())
                    );
                    if (filtered.length === 0) return null;
                    return (
                      <div key={label}>
                        <p className="mb-1 text-xs font-semibold text-gray-400">{label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {filtered.map((skill) => (
                            <button
                              key={skill}
                              onClick={() =>
                                toggleItem(skill, selectedSkills, setSelectedSkills)
                              }
                              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                                selectedSkills.includes(skill)
                                  ? 'border-gray-700 bg-gray-700 text-white'
                                  : 'border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 적용 버튼 */}
              <button
                onClick={() => {
                  setAppliedRoles(selectedRoles);
                  setAppliedSkills(selectedSkills);
                  setIsOpen(false);
                }}
                className="mt-4 w-full rounded-full bg-blue-600 py-3 text-white shadow-md hover:bg-blue-700"
              >
                검색 적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
