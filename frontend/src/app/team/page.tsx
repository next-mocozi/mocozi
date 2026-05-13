'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
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

/** 카테고리 아이콘 — Lucide 스타일 line-icon. 부모 색(text-*) 따라감. */
const TEAM_TYPE_ICON: Record<TeamType, ReactNode> = {
  STUDY: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  COMPETITION: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  HACKATHON: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  PROJECT: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
};

/** 카드 좌상 폴더 탭의 카테고리별 배경 — Verified Teal 시스템 내 색만 사용.
 *  PROJECT=primary, STUDY=dark sage(책), COMPETITION=dark amber(트로피), HACKATHON=bright teal(번개).
 *  모집 상태 탭은 teal-500(살아있음) / stone-400(가라앉음, sage 매핑)으로 분리. */
const CATEGORY_TAB_BG: Record<TeamType, string> = {
  PROJECT: 'bg-teal-700',
  STUDY: 'bg-stone-700',
  COMPETITION: 'bg-amber-700',
  HACKATHON: 'bg-teal-500',
};

const ROLE_OPTIONS = ['전체', '프론트엔드', '백엔드', '풀스택', '모바일', 'DevOps/인프라', 'AI/ML', '데이터', '보안', 'QA', '게임', '임베디드', 'UI/UX 디자이너', 'PM/PO'];

const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  { label: '프론트엔드', skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Redux', 'Vite'] },
  { label: '백엔드', skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go', 'Kotlin', 'PHP', 'Rust'] },
  { label: '모바일', skills: ['React Native', 'Flutter', 'Swift', 'iOS', 'Android'] },
  { label: '데이터베이스', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'GraphQL'] },
  { label: 'DevOps', skills: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Linux'] },
  { label: 'AI/데이터', skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain', 'OpenAI API'] },
  { label: '툴/기타', skills: ['Git', 'GitHub', 'Figma', 'Jest', 'Jira', 'Unity'] },
];

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

export default function TeamListPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [recruitingFilter, setRecruitingFilter] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TeamType | null>(null);

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // 바텀시트 열린 동안 body 스크롤 잠금
  useEffect(() => {
    if (!mobileFilterOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileFilterOpen]);

  useEffect(() => {
    api
      .get('/api/teams')
      .then((res) => setTeams(res.data.data))
      .catch(() => {})
      .finally(() => setLoadingTeams(false));
  }, []);

  const applySearch = () => {
    setAppliedKeyword(keyword.trim());
    setMobileFilterOpen(false);
  };

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
        ]
          .join(' ')
          .toLowerCase();
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

  const hasActiveFilters =
    appliedKeyword !== '' ||
    appliedRoles.length > 0 ||
    appliedSkills.length > 0 ||
    typeFilter !== null;

  const activeFilterCount =
    (appliedKeyword ? 1 : 0) +
    appliedRoles.length +
    appliedSkills.length +
    (typeFilter ? 1 : 0);

  const intro = (t: Team) => t.description ?? t.proposal?.overview ?? '';

  const { currentPage, setPage, totalPages, startIndex, endIndex } = usePagination({
    totalItems: filteredTeams.length,
    pageSize: PAGE_SIZE,
  });

  const pageItems = useMemo(
    () => filteredTeams.slice(startIndex, endIndex),
    [filteredTeams, startIndex, endIndex],
  );

  const initialFilterMount = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
    if (initialFilterMount.current) {
      initialFilterMount.current = false;
      return;
    }
    if (typeof window !== 'undefined' && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [appliedKeyword, appliedRoles, appliedSkills, recruitingFilter, typeFilter]);

  const clearAll = () => {
    setAppliedKeyword('');
    setKeyword('');
    setAppliedRoles([]);
    setAppliedSkills([]);
    setTypeFilter(null);
  };

  // 사이드바·바텀시트 공유 콘텐츠
  const filterControls = (
    <>
      {/* 검색 */}
      <p className="mb-2 text-sm font-semibold text-stone-700">검색</p>
      <div className="flex items-center gap-2 border border-stone-200 bg-white px-3 py-2 transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <svg className="h-4 w-4 flex-shrink-0 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
          placeholder="팀 이름, 소개, 팀장"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
        />
        {keyword && (
          <button
            type="button"
            onClick={() => { setKeyword(''); setAppliedKeyword(''); }}
            className="text-stone-300 hover:text-stone-500"
            aria-label="검색어 지우기"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={applySearch}
        className="mt-2 w-full bg-indigo-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
      >
        검색
      </button>

      {/* 모집 상태 */}
      <p className="mb-2 mt-5 text-sm font-semibold text-stone-700">모집 상태</p>
      <div className="inline-flex w-full border border-stone-200 bg-stone-50 p-1">
        <button
          onClick={() => setRecruitingFilter(true)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium transition-all ${
            recruitingFilter ? 'bg-white text-indigo-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          모집 중
        </button>
        <button
          onClick={() => setRecruitingFilter(false)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium transition-all ${
            !recruitingFilter ? 'bg-white text-indigo-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          모집 완료
        </button>
      </div>

      {/* 팀 형태 */}
      <p className="mb-2 mt-5 text-sm font-semibold text-stone-700">팀 형태</p>
      <div className="flex flex-wrap gap-1.5 border border-stone-100 bg-stone-50/50 p-2.5">
        <button
          onClick={() => setTypeFilter(null)}
          className={`border px-2.5 py-1 text-xs font-medium transition-all ${
            typeFilter === null
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          전체
        </button>
        {TEAM_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`border px-2.5 py-1 text-xs font-medium transition-all ${
              typeFilter === t
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            {TEAM_TYPE_ICON[t]} {TEAM_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* 모집 직군 */}
      <p className="mb-2 mt-5 text-sm font-semibold text-stone-700">모집 직군</p>
      <div className="flex flex-wrap gap-1.5 border border-stone-100 bg-stone-50/50 p-2.5">
        {ROLE_OPTIONS.map((role) => (
          <button
            key={role}
            onClick={() => toggleItem(role, appliedRoles, setAppliedRoles)}
            className={`border px-2.5 py-1 text-xs font-medium transition-all ${
              appliedRoles.includes(role)
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* 기술 스택 */}
      <p className="mb-2 mt-5 text-sm font-semibold text-stone-700">기술 스택</p>
      <input
        type="text"
        value={skillSearch}
        onChange={(e) => setSkillSearch(e.target.value)}
        placeholder="스킬 검색..."
        className="mb-2 w-full border border-stone-200 bg-white px-3 py-1.5 text-sm transition-all placeholder:text-stone-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto border border-stone-100 p-2.5">
        {SKILL_GROUPS.map(({ label, skills }) => {
          const filtered = skills.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()));
          if (filtered.length === 0) return null;
          return (
            <div key={label}>
              <p className="mb-1 text-3xs font-semibold uppercase tracking-widest text-stone-400">{label}</p>
              <div className="flex flex-wrap gap-1">
                {filtered.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleItem(skill, appliedSkills, setAppliedSkills)}
                    className={`border px-2.5 py-1 text-xs transition-all ${
                      appliedSkills.includes(skill)
                        ? 'border-stone-700 bg-stone-700 text-white'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-100'
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
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:pb-8">
      {/* 상단 헤더 */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl md:text-4xl">팀 목록</h1>
          <p className="mt-0.5 text-sm text-stone-400">함께할 팀을 찾아보세요</p>
        </div>
        <Link
          href="/team/create"
          className="flex flex-shrink-0 items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-300 sm:px-5"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">팀 만들기</span>
          <span className="sm:hidden">만들기</span>
        </Link>
      </div>

      <div className="lg:flex lg:gap-6">
        {/* 좌 사이드바 — lg 이상에서만 인라인 노출 (모바일은 바텀시트로) */}
        <aside className="hidden w-[280px] flex-shrink-0 lg:block">
          <div className="border border-stone-200 bg-white p-4 shadow-sm">
            {filterControls}
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="mt-4 w-full border border-stone-200 bg-white py-1.5 text-xs font-medium text-stone-500 transition-all hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700"
              >
                전체 초기화
              </button>
            )}
          </div>
        </aside>

        {/* 우 메인 */}
        <main className="min-w-0 flex-1">
          {/* 결과 수 + 활성 필터 */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-stone-500">
              {recruitingFilter ? '모집 중' : '모집 완료'} 팀{' '}
              <span className="font-semibold text-indigo-600">{filteredTeams.length}</span>개
            </span>
            {hasActiveFilters && (
              <>
                <span className="text-stone-300">·</span>
                {/* 모바일: 카운트 + 탭 시 바텀시트 */}
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(true)}
                  className="inline-flex items-center gap-1 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 lg:hidden"
                >
                  필터 {activeFilterCount}개
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* lg+: 개별 칩 (즉시 제거 가능) */}
                <div className="hidden flex-wrap items-center gap-2 lg:flex">
                  {appliedKeyword && (
                    <span className="flex items-center gap-1.5 border border-stone-200 bg-white px-3 py-1 text-stone-600">
                      <span className="text-xs text-stone-400">키워드</span>
                      {appliedKeyword}
                      <button onClick={() => { setAppliedKeyword(''); setKeyword(''); }} className="text-stone-300 hover:text-stone-600" aria-label="키워드 제거">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {typeFilter && (
                    <span className="flex items-center gap-1.5 border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
                      {TEAM_TYPE_ICON[typeFilter]} {TEAM_TYPE_LABEL[typeFilter]}
                      <button onClick={() => setTypeFilter(null)} className="text-indigo-300 hover:text-indigo-600" aria-label="팀 형태 필터 제거">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {appliedRoles.map((role) => (
                    <span key={role} className="flex items-center gap-1.5 border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
                      {role}
                      <button onClick={() => setAppliedRoles(appliedRoles.filter((r) => r !== role))} className="text-indigo-300 hover:text-indigo-600" aria-label={`${role} 필터 제거`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  {appliedSkills.map((skill) => (
                    <span key={skill} className="flex items-center gap-1.5 border border-stone-200 bg-stone-50 px-3 py-1 text-stone-600">
                      {skill}
                      <button onClick={() => setAppliedSkills(appliedSkills.filter((s) => s !== skill))} className="text-stone-300 hover:text-stone-600" aria-label={`${skill} 필터 제거`}>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 팀 목록 */}
          {loadingTeams ? (
            <div className="flex h-[420px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-stone-400">불러오는 중...</p>
              </div>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="card flex h-[320px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center bg-stone-100 text-2xl">
                🔍
              </div>
              <p className="text-base font-semibold text-stone-700">
                {teams.length === 0 ? '아직 등록된 팀이 없습니다' : '검색 결과가 없습니다'}
              </p>
              <p className="text-sm text-stone-400">
                {teams.length === 0
                  ? '첫 번째 팀을 만들어보세요!'
                  : '키워드나 필터를 변경해 보세요.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
              {pageItems.map((team) => {
                const recruitingRoles = team.proposal?.recruitingRoles ?? [];
                return (
                  <Link
                    key={team.id}
                    href={`/team/${team.id}`}
                    className="group block transition-transform hover:-translate-y-0.5"
                  >
                    {/* 폴더 탭 두 개 — 카드 상단에 직접 부착 (normal flow stack) */}
                    <div className="flex gap-1.5 pl-3 lg:gap-2 lg:pl-4">
                      <span
                        className={`relative inline-flex items-center gap-1 px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.08em] text-white after:absolute after:-right-[6px] after:bottom-0 after:top-0 after:w-[9px] after:origin-bottom-left after:skew-x-[20deg] after:bg-inherit after:[clip-path:polygon(0_0,100%_100%,0_100%)] sm:px-2.5 lg:px-3 lg:tracking-[0.1em] lg:after:-right-2 lg:after:w-3 ${CATEGORY_TAB_BG[team.teamType]}`}
                      >
                        {TEAM_TYPE_ICON[team.teamType]} {TEAM_TYPE_LABEL[team.teamType]}
                      </span>
                      <span
                        className={`relative inline-flex items-center px-2 py-0.5 text-3xs font-bold uppercase tracking-[0.08em] text-white after:absolute after:-right-[6px] after:bottom-0 after:top-0 after:w-[9px] after:origin-bottom-left after:skew-x-[20deg] after:bg-inherit after:[clip-path:polygon(0_0,100%_100%,0_100%)] sm:px-2.5 lg:px-3 lg:tracking-[0.1em] lg:after:-right-2 lg:after:w-3 ${team.isRecruiting ? 'bg-teal-500' : 'bg-stone-400'}`}
                      >
                        {team.isRecruiting ? '모집중' : '모집완료'}
                      </span>
                    </div>

                    {/* 카드 본체 — 탭 바로 아래, gap 없이 부착 */}
                    <div className="relative flex aspect-[3/5] flex-col border border-stone-200 bg-[#f1f2ea] px-3 pb-3 pt-3 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-shadow group-hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.12)] sm:px-4 sm:pb-4 sm:pt-3.5 lg:aspect-[17/20] lg:px-5 lg:pb-4 lg:pt-4">
                      <span className="text-3xs font-bold uppercase tracking-[0.2em] text-stone-400">
                        Proposal
                      </span>

                      <p className="mt-1 line-clamp-2 text-sm font-bold leading-tight tracking-tight text-stone-900 sm:text-base lg:mt-1.5 lg:text-lg">
                        {team.name}
                      </p>

                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-600 sm:text-sm lg:mt-2 lg:line-clamp-3">
                        {intro(team) || '소개가 없습니다.'}
                      </p>

                      {recruitingRoles.length > 0 && (
                        <div className="mt-auto pt-2 sm:pt-2.5">
                          <p className="text-3xs font-bold uppercase tracking-[0.16em] text-stone-400">
                            모집 직군
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {recruitingRoles.slice(0, 3).map((role) => (
                              <span
                                key={role}
                                className="border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-3xs font-semibold text-stone-700 sm:px-2 sm:text-2xs"
                              >
                                {role}
                              </span>
                            ))}
                            {recruitingRoles.length > 3 && (
                              <span className="border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-3xs text-stone-500 sm:px-2 sm:text-2xs">
                                +{recruitingRoles.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-3xs text-stone-500 sm:mt-2.5 sm:pt-2.5 sm:text-2xs">
                        <span>
                          팀장 <span className="font-semibold text-stone-800">{team.leader.name}</span>
                        </span>
                        <span>
                          인원{' '}
                          <span className="font-semibold text-stone-800">
                            {team._count.members}
                            {team.maxMembers ? `/${team.maxMembers}` : ''}
                          </span>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
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
        </main>
      </div>

      {/* 모바일 필터 — 플로팅 버튼 + 백드롭 + 바텀시트 */}
      <button
        type="button"
        onClick={() => setMobileFilterOpen(true)}
        className="fixed bottom-6 right-4 z-30 flex items-center gap-2 bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-95 lg:hidden"
        aria-label="필터 열기"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        필터
        {activeFilterCount > 0 && (
          <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center bg-white/20 px-1.5 text-2xs font-bold">
            {activeFilterCount}
          </span>
        )}
      </button>

      <div
        onClick={() => setMobileFilterOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileFilterOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="필터"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileFilterOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 핸들 + 헤더 */}
        <div className="flex flex-col items-center border-b border-stone-100 pb-3 pt-3">
          <span className="h-1.5 w-10 bg-stone-200" aria-hidden="true" />
          <div className="mt-3 flex w-full items-center justify-between px-5">
            <h2 className="text-base font-bold text-stone-900">필터</h2>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              aria-label="필터 닫기"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 시트 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{filterControls}</div>

        {/* 시트 하단 액션 */}
        <div className="flex gap-2 border-t border-stone-100 bg-white px-5 py-3">
          <button
            type="button"
            onClick={clearAll}
            disabled={!hasActiveFilters}
            className="flex-1 border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={() => setMobileFilterOpen(false)}
            className="flex-[2] bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            결과 보기 ({filteredTeams.length}개)
          </button>
        </div>
      </div>
    </div>
  );
}
