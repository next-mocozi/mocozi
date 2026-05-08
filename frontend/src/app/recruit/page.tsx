'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/ui/Pagination';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

const PAGE_SIZE = 12;

const SCHOOL_COLORS = ['#8B0000', '#003876', '#00205B', '#000080', '#004B23', '#004A99', '#7B1A1A', '#b6001f'];
function getSchoolColor(university: string): string {
  const hash = [...university].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return SCHOOL_COLORS[hash % SCHOOL_COLORS.length];
}

const toggleItem = (item: string, list: string[], setList: (v: string[]) => void) => {
  setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
};

const ROLE_OPTIONS = ['전체', '프론트엔드', '백엔드', '풀스택', '모바일', 'DevOps/인프라', 'AI/ML', '데이터', '보안', 'QA', '게임', '임베디드', 'UI/UX 디자이너', 'PM/PO'];

const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  { label: '프론트엔드', skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Redux', 'Vite'] },
  { label: '백엔드', skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go', 'Kotlin', 'PHP', 'Rust'] },
  { label: '모바일', skills: ['React Native', 'Flutter', 'Swift', 'iOS', 'Android'] },
  { label: '데이터베이스', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'GraphQL'] },
  { label: 'DevOps', skills: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Linux'] },
  { label: 'AI/데이터', skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain', 'OpenAI API'] },
  { label: '툴/기타', skills: ['Git', 'GitHub', 'Figma', 'Jest', 'Jira'] },
];

interface UserProfile {
  id: string;
  name: string;
  university: string;
  department: string;
  skills: string[];
  roles: string[];
  profileImage: string | null;
  bio: string | null;
}

interface MyTeam {
  id: string;
  name: string;
  teamType: string;
}

interface ScoutModalState {
  targetUser: UserProfile;
  teams: MyTeam[];
  selectedTeamId: string;
  message: string;
  loading: boolean;
}

export default function RecruitListPage() {
  const { user, isAuthenticated } = useAuth();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [appliedSameSchool, setAppliedSameSchool] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');

  const [scoutModal, setScoutModal] = useState<ScoutModalState | null>(null);
  const [scoutError, setScoutError] = useState<string | null>(null);
  const [scoutSuccess, setScoutSuccess] = useState(false);

  useEffect(() => {
    setFetchLoading(true);
    api
      .get('/api/search/users')
      .then((res) => {
        const data: UserProfile[] = res.data?.data ?? res.data ?? [];
        setProfiles(data.filter((p) => p.id !== user?.id));
      })
      .catch(() => setFetchError('유저 목록을 불러오지 못했습니다.'))
      .finally(() => setFetchLoading(false));
  }, [user?.id]);

  const applySearch = () => setAppliedKeyword(keyword.trim());

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (appliedKeyword) {
        const q = appliedKeyword.toLowerCase();
        const haystack = [p.name, p.department, p.bio ?? '', ...p.roles, ...p.skills].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      const roleFilters = appliedRoles.filter((r) => r !== '전체');
      if (roleFilters.length > 0) {
        if (!roleFilters.some((r) => p.roles.includes(r))) return false;
      }

      if (appliedSkills.length > 0) {
        if (!appliedSkills.some((s) => p.skills.includes(s))) return false;
      }

      if (appliedSameSchool && p.university !== user?.university) return false;

      return true;
    });
  }, [profiles, appliedKeyword, appliedRoles, appliedSkills, appliedSameSchool, user?.university]);

  const hasActiveFilters =
    appliedKeyword !== '' || appliedRoles.length > 0 || appliedSkills.length > 0 || appliedSameSchool;

  const { currentPage, setPage, totalPages, startIndex, endIndex } = usePagination({
    totalItems: filteredProfiles.length,
    pageSize: PAGE_SIZE,
  });

  const pageItems = useMemo(
    () => filteredProfiles.slice(startIndex, endIndex),
    [filteredProfiles, startIndex, endIndex],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1); }, [appliedKeyword, appliedRoles, appliedSkills, appliedSameSchool]);

  const openScoutModal = async (target: UserProfile) => {
    setScoutError(null);
    setScoutSuccess(false);
    const res = await api.get('/api/teams/my');
    const teams: MyTeam[] = res.data?.data ?? res.data ?? [];
    setScoutModal({ targetUser: target, teams, selectedTeamId: teams[0]?.id ?? '', message: '', loading: false });
  };

  const submitScout = async () => {
    if (!scoutModal) return;
    if (!scoutModal.selectedTeamId) { setScoutError('팀을 선택해주세요.'); return; }
    if (!scoutModal.message.trim()) { setScoutError('메시지를 입력해주세요.'); return; }

    setScoutModal((prev) => prev && { ...prev, loading: true });
    setScoutError(null);
    try {
      await api.post(`/api/scout/${scoutModal.targetUser.id}`, {
        teamId: scoutModal.selectedTeamId,
        message: scoutModal.message,
      });
      setScoutSuccess(true);
      setTimeout(() => setScoutModal(null), 1500);
    } catch (e: any) {
      setScoutError(e?.response?.data?.message ?? '스카우트 제안에 실패했습니다.');
      setScoutModal((prev) => prev && { ...prev, loading: false });
    }
  };

  const clearAll = () => {
    setAppliedKeyword('');
    setKeyword('');
    setAppliedRoles([]);
    setAppliedSkills([]);
    setAppliedSameSchool(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* 상단 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">팀원 찾기</h1>
        <p className="mt-0.5 text-sm text-slate-400">함께할 팀원을 찾아보세요</p>
      </div>

      <div className="flex gap-6">
        {/* 좌 사이드바 */}
        <aside className="w-[280px] flex-shrink-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {/* 검색 */}
            <p className="mb-2 text-sm font-semibold text-slate-700">검색</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
              <svg className="h-4 w-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
                placeholder="이름, 학과, 스킬"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => { setKeyword(''); setAppliedKeyword(''); }}
                  className="text-slate-300 hover:text-slate-500"
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
              className="mt-2 w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              검색
            </button>

            {/* 같은 학교 */}
            {isAuthenticated && (
              <button
                onClick={() => setAppliedSameSchool(!appliedSameSchool)}
                className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-1.5 text-sm font-medium transition-all ${
                  appliedSameSchool
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                🏫 같은 학교만 보기
              </button>
            )}

            {/* 직군 */}
            <p className="mb-2 mt-5 text-sm font-semibold text-slate-700">직군</p>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role}
                  onClick={() => toggleItem(role, appliedRoles, setAppliedRoles)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
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
            <p className="mb-2 mt-5 text-sm font-semibold text-slate-700">기술 스택</p>
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              placeholder="스킬 검색..."
              className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-100 p-2.5">
              {SKILL_GROUPS.map(({ label, skills }) => {
                const filtered = skills.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase()));
                if (filtered.length === 0) return null;
                return (
                  <div key={label}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                    <div className="flex flex-wrap gap-1">
                      {filtered.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => toggleItem(skill, appliedSkills, setAppliedSkills)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-all ${
                            appliedSkills.includes(skill)
                              ? 'border-slate-700 bg-slate-700 text-white'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
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

            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="mt-4 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              >
                전체 초기화
              </button>
            )}
          </div>
        </aside>

        {/* 우 메인 */}
        <main className="min-w-0 flex-1">
          {/* 결과 수 + 활성 필터 칩 */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">
              검색 결과 <span className="font-semibold text-indigo-600">{filteredProfiles.length}</span>명
            </span>
            {hasActiveFilters && (
              <>
                <span className="text-slate-300">·</span>
                {appliedKeyword && (
                  <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                    <span className="text-xs text-slate-400">키워드</span>
                    {appliedKeyword}
                    <button onClick={() => { setAppliedKeyword(''); setKeyword(''); }} className="text-slate-300 hover:text-slate-600" aria-label="키워드 제거">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {appliedSameSchool && (
                  <span className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
                    🏫 같은 학교
                    <button onClick={() => setAppliedSameSchool(false)} className="text-indigo-300 hover:text-indigo-600" aria-label="같은 학교 필터 제거">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {appliedRoles.map((role) => (
                  <span key={role} className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700">
                    {role}
                    <button onClick={() => setAppliedRoles(appliedRoles.filter((r) => r !== role))} className="text-indigo-300 hover:text-indigo-600" aria-label={`${role} 필터 제거`}>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                {appliedSkills.map((skill) => (
                  <span key={skill} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                    {skill}
                    <button onClick={() => setAppliedSkills(appliedSkills.filter((s) => s !== skill))} className="text-slate-300 hover:text-slate-600" aria-label={`${skill} 필터 제거`}>
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </>
            )}
          </div>

          {/* 프로필 목록 */}
          {fetchLoading ? (
            <div className="flex h-[420px] items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                <p className="text-sm text-slate-400">불러오는 중...</p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="card flex h-[320px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
              <p className="text-sm font-semibold text-slate-700">{fetchError}</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="card flex h-[320px] flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">🔍</div>
              <p className="text-base font-semibold text-slate-700">검색 결과가 없습니다</p>
              <p className="text-sm text-slate-400">키워드나 필터를 변경해 보세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((person) => {
                const roles = person.roles ?? [];
                const mainRole = roles[0] ?? null;
                const subRoles = roles.slice(1);
                const schoolColor = getSchoolColor(person.university);
                return (
                  <div
                    key={person.id}
                    className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_12px_-2px_rgba(0,0,0,0.07)] transition-all hover:shadow-[0_8px_24px_-4px_rgba(99,102,241,0.12)] hover:-translate-y-0.5"
                  >
                    {/* 학교 컬러 헤더 */}
                    <div
                      className="relative h-16 overflow-hidden z-10"
                      style={{
                        background: `linear-gradient(135deg, ${schoolColor} 0%, color-mix(in oklch, ${schoolColor} 75%, #000) 100%)`,
                      }}
                      aria-hidden="true"
                    >
                      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
                    </div>

                    {/* 아바타 + 버튼 */}
                    <div className="-mt-8 flex items-end justify-between px-4 z-20">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-slate-100 text-xl font-bold text-slate-500 shadow-md">
                        {person.profileImage ? (
                          <img src={person.profileImage} alt={person.name} className="h-full w-full rounded-full object-cover z-30" />
                        ) : (
                          person.name[0]
                        )}
                      </div>
                      <div className="flex translate-y-[2px] gap-1.5">
                        {isAuthenticated && (
                          <button
                            onClick={() => openScoutModal(person)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-all hover:border-slate-700 hover:bg-slate-700 hover:text-white"
                          >
                            스카우트
                          </button>
                        )}
                        <Link
                          href={`/profile/${person.id}`}
                          className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-600 transition-all hover:bg-indigo-600 hover:text-white"
                        >
                          프로필
                        </Link>
                      </div>
                    </div>

                    {/* 카드 바디 */}
                    <div className="flex flex-1 flex-col px-4 pb-4 pt-2.5">
                      <p className="text-base font-bold text-slate-900">{person.name}</p>
                      <p className="mb-1 text-xs text-slate-400">{person.university} · {person.department}</p>

                      <div className="mb-2 flex min-h-[1.75rem] flex-wrap items-center gap-1">
                        {mainRole ? (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                              {mainRole}
                            </span>
                            {subRoles.slice(0, 2).map((role) => (
                              <span key={role} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500">
                                {role}
                              </span>
                            ))}
                            {subRoles.length > 2 && (
                              <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-400">
                                +{subRoles.length - 2}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="rounded-full border border-dotted border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                            직군 미등록
                          </span>
                        )}
                      </div>

                      <div className="mb-2 flex min-h-[1.25rem] flex-wrap gap-1">
                        {(person.skills ?? []).length > 0 ? (
                          <>
                            {(person.skills ?? []).slice(0, 4).map((skill) => (
                              <span key={skill} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{skill}</span>
                            ))}
                            {(person.skills ?? []).length > 4 && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">+{person.skills.length - 4}</span>
                            )}
                          </>
                        ) : (
                          <span className="rounded-md border border-dotted border-slate-200 px-2 py-0.5 text-[11px] text-slate-300">스킬 미등록</span>
                        )}
                      </div>

                      <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-relaxed text-slate-500">{person.bio?.trim() || '소개가 없습니다.'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProfiles.length > 0 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
          )}
        </main>
      </div>

      {/* 스카우트 모달 */}
      {scoutModal && (
        <div onClick={() => setScoutModal(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-3xl bg-white p-7 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">스카우트 제안</h2>
              <button onClick={() => setScoutModal(null)} className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-5 text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{scoutModal.targetUser.name}</span>님에게 팀 합류를 제안합니다.
            </p>
            {scoutModal.teams.length === 0 ? (
              <p className="text-sm text-slate-400">팀장으로 등록된 팀이 없습니다. 먼저 팀을 만들어주세요.</p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">팀 선택</label>
                  <select
                    value={scoutModal.selectedTeamId}
                    onChange={(e) => setScoutModal((prev) => prev && { ...prev, selectedTeamId: e.target.value })}
                    className="input-field"
                  >
                    {scoutModal.teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">메시지</label>
                  <textarea
                    value={scoutModal.message}
                    onChange={(e) => setScoutModal((prev) => prev && { ...prev, message: e.target.value })}
                    placeholder="합류 제안 메시지를 작성해주세요."
                    rows={4}
                    className="input-field resize-none"
                  />
                </div>
                {scoutError && <p className="mb-3 text-xs text-red-500">{scoutError}</p>}
                {scoutSuccess ? (
                  <p className="text-center text-sm font-semibold text-emerald-600">스카우트 제안을 보냈습니다!</p>
                ) : (
                  <button
                    onClick={submitScout}
                    disabled={scoutModal.loading}
                    className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg disabled:opacity-60"
                  >
                    {scoutModal.loading ? '전송 중...' : '제안 보내기'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
