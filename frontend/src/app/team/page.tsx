'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import api from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 12;

type TeamType = 'STUDY' | 'COMPETITION' | 'HACKATHON' | 'PROJECT';

const TEAM_TYPES: TeamType[] = ['STUDY', 'COMPETITION', 'HACKATHON', 'PROJECT'];

const TEAM_TYPE_LABEL: Record<TeamType, string> = {
  STUDY: '스터디',
  COMPETITION: '공모전',
  HACKATHON: '해커톤',
  PROJECT: '개발',
};

interface Team {
  id: string;
  name: string;
  teamType: TeamType;
  description: string | null;
  maxMembers: number | null;
  isRecruiting: boolean;
  leader: { id: string; name: string };
  proposal: {
    projectName: string;
    overview: string;
    recruitingRoles: string[];
    requiredSkills: string[];
  } | null;
  _count: { members: number };
}

const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
  setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
};

/** 팀 목록 페이지 */
export default function TeamListPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [recruitingFilter, setRecruitingFilter] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TeamType | null>(null);

  useEffect(() => {
    api
      .get('/api/teams')
      .then((res) => setTeams(res.data.data))
      .catch(() => {})
      .finally(() => setLoadingTeams(false));
  }, []);

  const applySearch = () => setAppliedKeyword(keyword.trim());

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (t.isRecruiting !== recruitingFilter) return false;
      if (typeFilter && t.teamType !== typeFilter) return false;

      if (appliedKeyword) {
        const q = appliedKeyword.toLowerCase();
        const haystack = [
          t.name,
          t.description ?? '',
          t.proposal?.overview ?? '',
          t.leader.name,
          ...(t.proposal?.recruitingRoles ?? []),
          ...(t.proposal?.requiredSkills ?? []),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      const roleFilters = appliedRoles.filter((r) => r !== '전체');
      if (roleFilters.length > 0) {
        const hit = roleFilters.some((r) => t.proposal?.recruitingRoles.includes(r));
        if (!hit) return false;
      }

      if (appliedSkills.length > 0) {
        const hit = appliedSkills.some((s) => t.proposal?.requiredSkills.includes(s));
        if (!hit) return false;
      }

      return true;
    });
  }, [teams, appliedKeyword, appliedRoles, appliedSkills, recruitingFilter, typeFilter]);

  const hasActiveFilters = appliedKeyword !== '' || appliedRoles.length > 0 || appliedSkills.length > 0;

  const intro = (t: Team) => t.description ?? t.proposal?.overview ?? '';

  const { currentPage, setPage, totalPages, startIndex, endIndex } =
    usePagination({ totalItems: filteredTeams.length, pageSize: PAGE_SIZE });

  const pageItems = useMemo(
    () => filteredTeams.slice(startIndex, endIndex),
    [filteredTeams, startIndex, endIndex],
  );

  // 필터/검색이 바뀌면 1페이지로 리셋
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
  }, [appliedKeyword, appliedRoles, appliedSkills, recruitingFilter, typeFilter]);

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

        {/* 필터: 모집 상태 토글 + 팀 형태 */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 shadow-sm">
            <button
              onClick={() => setRecruitingFilter(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                recruitingFilter ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              팀원 모집 중
            </button>
            <button
              onClick={() => setRecruitingFilter(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                !recruitingFilter ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              팀원 모집 완료
            </button>
          </div>

          <div className="h-6 w-px bg-gray-200" />

          <button
            onClick={() => setTypeFilter(null)}
            className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
              typeFilter === null ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            전체
          </button>
          {TEAM_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                typeFilter === t ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {TEAM_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 px-6 py-3 shadow-md">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
              placeholder="팀 이름, 소개, 팀장, 직군으로 검색"
              className="min-w-[120px] flex-1 bg-transparent outline-none"
            />
            <button type="button" onClick={applySearch} aria-label="검색" className="text-blue-600 transition-all hover:text-blue-800">
              🔍
            </button>
          </div>
          <button
            onClick={() => { setSelectedRoles(appliedRoles); setSelectedSkills(appliedSkills); setIsOpen(true); }}
            className="rounded-full border border-blue-200 bg-white px-6 py-3 text-blue-600 shadow-md transition-all hover:bg-blue-600 hover:text-white hover:shadow-lg"
          >
            ➕🔎
          </button>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {appliedKeyword && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">키워드:</span>
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                  <button onClick={() => { setAppliedKeyword(''); setKeyword(''); }} className="text-gray-400 hover:text-gray-600" aria-label="키워드 제거">✕</button>
                  {appliedKeyword}
                </span>
              </div>
            )}
            {appliedRoles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">모집 직군:</span>
                {appliedRoles.map((role) => (
                  <span key={role} className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-600">
                    <button onClick={() => setAppliedRoles(appliedRoles.filter((r) => r !== role))} className="text-blue-400 hover:text-blue-700" aria-label={`${role} 제거`}>✕</button>
                    {role}
                  </span>
                ))}
              </div>
            )}
            {appliedSkills.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">기술 스택:</span>
                {appliedSkills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-600">
                    <button onClick={() => setAppliedSkills(appliedSkills.filter((s) => s !== skill))} className="text-gray-400 hover:text-gray-700" aria-label={`${skill} 제거`}>✕</button>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          {recruitingFilter ? '모집 중' : '모집 완료'}
          {typeFilter && ` · ${TEAM_TYPE_LABEL[typeFilter]}`}{' '}
          <span className="font-semibold text-blue-600">{filteredTeams.length}</span>팀
        </div>

        {loadingTeams ? (
          <div className="mt-6 flex h-[420px] items-center justify-center text-gray-400">불러오는 중...</div>
        ) : filteredTeams.length === 0 ? (
          <div className="mt-6 flex h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-gray-100 bg-white text-center shadow-sm">
            <p className="text-2xl">🔍</p>
            <p className="text-base font-semibold">
              {teams.length === 0 ? '아직 등록된 팀이 없습니다' : '검색 결과가 없습니다'}
            </p>
            <p className="text-sm text-gray-400">
              {teams.length === 0 ? '첫 번째 팀을 만들어보세요!' : '키워드나 필터를 변경해 보세요.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((team) => (
              <Link
                key={team.id}
                href={`/team/${team.id}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
              >
                <div className={`relative flex flex-col items-center justify-center px-4 py-8 ${
                  !team.isRecruiting ? 'bg-gradient-to-br from-gray-400 to-gray-600' : 'bg-gradient-to-br from-blue-500 to-blue-700'
                }`}>
                  <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                    {TEAM_TYPE_LABEL[team.teamType]}
                  </span>
                  <p className="text-center text-2xl font-bold text-white">{team.name}</p>
                </div>

                <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                  <p className="mb-4 line-clamp-2 text-center text-sm text-gray-600">
                    {intro(team) || '소개가 없습니다.'}
                  </p>

                  <div className="mb-4 space-y-1.5 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-xs text-gray-400">팀장</span>
                      <span className="font-medium text-gray-700">{team.leader.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-12 text-xs text-gray-400">인원</span>
                      <span className="font-medium text-gray-700">
                        {team._count.members}{team.maxMembers ? `/${team.maxMembers}명` : '명'}
                      </span>
                      {!team.isRecruiting && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">모집완료</span>
                      )}
                    </div>
                  </div>

                  {team.proposal?.recruitingRoles && team.proposal.recruitingRoles.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-xs text-gray-400">모집 직군</p>
                      <div className="flex flex-wrap gap-1">
                        {team.proposal.recruitingRoles.map((role) => (
                          <span key={role} className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="mt-auto rounded-full border border-blue-200 py-2 text-sm text-blue-600 transition-all hover:bg-blue-600 hover:text-white">
                    자세히 보기
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!loadingTeams && filteredTeams.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            className="mt-8"
          />
        )}
      </div>

      {/* 상세 검색 모달 */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div>
            <div onClick={(e) => e.stopPropagation()} className="w-[500px] rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-bold">상세 검색</h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <p className="mb-2 font-semibold">모집 직군</p>
              <div className="flex flex-wrap justify-center gap-2 rounded-xl border border-gray-100 p-3">
                {['전체','프론트엔드','백엔드','풀스택','모바일','DevOps/인프라','AI/ML','데이터','보안','QA','게임','임베디드','UI/UX 디자이너','PM/PO'].map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleItem(role, selectedRoles, setSelectedRoles)}
                    className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                      selectedRoles.includes(role) ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

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
                    { label: '프론트엔드', skills: ['React','Next.js','Vue.js','TypeScript','JavaScript','Tailwind CSS','Redux','Vite'] },
                    { label: '백엔드', skills: ['Node.js','NestJS','Spring Boot','Java','Python','FastAPI','Go','Kotlin','PHP','Rust'] },
                    { label: '모바일', skills: ['React Native','Flutter','Swift','iOS','Android'] },
                    { label: '데이터베이스', skills: ['MySQL','PostgreSQL','MongoDB','Redis','Firebase','GraphQL'] },
                    { label: 'DevOps', skills: ['AWS','GCP','Azure','Docker','Kubernetes','Linux'] },
                    { label: 'AI/데이터', skills: ['TensorFlow','PyTorch','Pandas','LangChain','OpenAI API'] },
                    { label: '툴/기타', skills: ['Git','GitHub','Figma','Jest','Jira','Unity'] },
                  ].map(({ label, skills }) => {
                    const filtered = skills.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()));
                    if (filtered.length === 0) return null;
                    return (
                      <div key={label}>
                        <p className="mb-1 text-xs font-semibold text-gray-400">{label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {filtered.map((skill) => (
                            <button
                              key={skill}
                              onClick={() => toggleItem(skill, selectedSkills, setSelectedSkills)}
                              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                                selectedSkills.includes(skill) ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-200 hover:bg-gray-100'
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

              <button
                onClick={() => { setAppliedRoles(selectedRoles); setAppliedSkills(selectedSkills); setIsOpen(false); }}
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
