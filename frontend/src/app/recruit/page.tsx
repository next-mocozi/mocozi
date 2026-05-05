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

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [appliedRoles, setAppliedRoles] = useState<string[]>([]);
  const [appliedSkills, setAppliedSkills] = useState<string[]>([]);
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

  useEffect(() => { setPage(1); }, [appliedKeyword, appliedRoles, appliedSkills, appliedSameSchool]);

  const openScoutModal = async (target: UserProfile) => {
    setScoutError(null);
    setScoutSuccess(false);
    try {
      const res = await api.get('/api/teams/my');
      const teams: MyTeam[] = res.data?.data ?? res.data ?? [];
      setScoutModal({ targetUser: target, teams, selectedTeamId: teams[0]?.id ?? '', message: '', loading: false });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? '팀 목록 로딩 실패');
    }
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

  return (
    <div className="flex gap-2 w-full items-center">
      <div className="w-full px-30 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">팀원 찾기</h1>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          {isAuthenticated && (
            <button
              onClick={() => setAppliedSameSchool(!appliedSameSchool)}
              className={`inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                appliedSameSchool
                  ? 'border-blue-600 bg-blue-600 text-white shadow'
                  : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              🏫 같은 학교
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 px-6 py-3 shadow-md">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
              placeholder="키워드로 검색"
              className="flex-1 bg-transparent outline-none min-w-[120px]"
            />
            <button type="button" onClick={applySearch} className="text-blue-600 hover:text-blue-800 transition-all">
              🔍
            </button>
          </div>
          <button
            onClick={() => { setSelectedRoles(appliedRoles); setSelectedSkills(appliedSkills); setIsFilterOpen(true); }}
            className="rounded-full border border-blue-200 bg-white px-6 py-3 text-blue-600 shadow-md transition-all hover:bg-blue-600 hover:text-white hover:shadow-lg"
          >
            ➕ 검색 필터
          </button>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {appliedKeyword && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">키워드:</span>
                <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                  <button onClick={() => { setAppliedKeyword(''); setKeyword(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
                  {appliedKeyword}
                </span>
              </div>
            )}
            {appliedRoles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">직군:</span>
                {appliedRoles.map((role) => (
                  <span key={role} className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-600">
                    <button onClick={() => setAppliedRoles(appliedRoles.filter((r) => r !== role))} className="text-blue-400 hover:text-blue-700">✕</button>
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
                    <button onClick={() => setAppliedSkills(appliedSkills.filter((s) => s !== skill))} className="text-gray-400 hover:text-gray-700">✕</button>
                    {skill}
                  </span>
                ))}
              </div>
            )}
            {appliedSameSchool && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">학교:</span>
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-600">
                  <button onClick={() => setAppliedSameSchool(false)} className="text-blue-400 hover:text-blue-700">✕</button>
                  🏫 같은 학교
                </span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          검색 결과 <span className="font-semibold text-blue-600">{filteredProfiles.length}</span>명
        </div>

        {fetchLoading ? (
          <div className="mt-6 flex h-[420px] items-center justify-center text-gray-400">불러오는 중...</div>
        ) : fetchError ? (
          <div className="mt-6 flex h-[420px] items-center justify-center text-red-400">{fetchError}</div>
        ) : filteredProfiles.length === 0 ? (
          <div className="mt-6 flex h-[420px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-gray-100 bg-white text-center shadow-sm">
            <p className="text-2xl">🔍</p>
            <p className="text-base font-semibold">검색 결과가 없습니다</p>
            <p className="text-sm text-gray-400">키워드나 필터를 변경해 보세요.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((person) => {
              const roles = person.roles ?? [];
              const mainRole = roles[0] ?? null;
              const subRoles = roles.slice(1);
              const schoolColor = getSchoolColor(person.university);
              return (
                <div key={person.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md">
                  <div className="h-20" style={{ backgroundColor: schoolColor }} aria-hidden="true" />
                  <div className="-mt-10 flex items-end justify-between px-5">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-gray-200 text-2xl shadow">
                      {person.profileImage ? (
                        <img src={person.profileImage} alt={person.name} className="rounded-full" />
                      ) : (
                        person.name[0]
                      )}
                    </div>
                    <div className="flex translate-y-[2px] gap-2">
                      {isAuthenticated && (
                        <button
                          onClick={() => openScoutModal(person)}
                          className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-700 hover:text-white hover:border-gray-700"
                        >
                          스카우트
                        </button>
                      )}
                      <Link
                        href={`/profile/${person.id}`}
                        className="rounded-full border border-blue-200 px-4 py-1.5 text-sm font-medium text-blue-600 transition-all hover:bg-blue-600 hover:text-white"
                      >
                        프로필 보기
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
                    <p className="text-lg font-bold">{person.name}</p>
                    <p className="mb-3 text-sm text-gray-500">{person.university} · {person.department}</p>
                    {(mainRole || subRoles.length > 0) && (
                      <div className="mb-3 flex flex-wrap items-center gap-1">
                        {mainRole && (
                          <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                            {mainRole}
                          </span>
                        )}
                        {subRoles.slice(0, 2).map((role) => (
                          <span key={role} className="inline-flex items-center justify-center rounded-full border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600">
                            {role}
                          </span>
                        ))}
                        {subRoles.length > 2 && (
                          <span className="inline-flex items-center justify-center rounded-full border border-blue-100 px-3 py-1 text-xs leading-none text-blue-400">
                            +{subRoles.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mb-3 flex flex-wrap gap-1">
                      {person.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{skill}</span>
                      ))}
                      {person.skills.length > 3 && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400">+{person.skills.length - 3}</span>
                      )}
                    </div>
                    <p className="min-h-15 text-sm text-gray-500 line-clamp-3">{person.bio ?? '소개가 없습니다.'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredProfiles.length > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
        )}
      </div>

      {/* 검색 필터 모달 */}
      {isFilterOpen && (
        <div onClick={() => setIsFilterOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div onClick={(e) => e.stopPropagation()} className="w-[500px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">검색 필터</h2>
              <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="mb-2 font-semibold">직군</p>
            <div className="flex flex-wrap justify-center gap-2 border border-gray-100 rounded-xl p-3">
              {['전체', '프론트엔드', '백엔드', '풀스택', '모바일', 'DevOps/인프라', 'AI/ML', '데이터', '보안', 'QA', '게임', '임베디드', 'UI/UX 디자이너', 'PM/PO'].map((role) => (
                <button
                  key={role}
                  onClick={() => toggleItem(role, selectedRoles, setSelectedRoles)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                    selectedRoles.includes(role) ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-200 text-blue-600 hover:bg-blue-50'
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
              <div className="flex flex-col gap-3 max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-3">
                {[
                  { label: '프론트엔드', skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Redux', 'Vite'] },
                  { label: '백엔드', skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go', 'Kotlin', 'PHP', 'Rust'] },
                  { label: '모바일', skills: ['React Native', 'Flutter', 'Swift', 'iOS', 'Android'] },
                  { label: '데이터베이스', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'GraphQL'] },
                  { label: 'DevOps', skills: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Linux'] },
                  { label: 'AI/데이터', skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain', 'OpenAI API'] },
                  { label: '툴/기타', skills: ['Git', 'GitHub', 'Figma', 'Jest', 'Jira'] },
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
                              selectedSkills.includes(skill) ? 'bg-gray-700 text-white border-gray-700' : 'border-gray-200 hover:bg-gray-100'
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
              onClick={() => { setAppliedRoles(selectedRoles); setAppliedSkills(selectedSkills); setIsFilterOpen(false); }}
              className="mt-4 w-full rounded-full bg-blue-600 py-3 text-white shadow-md hover:bg-blue-700"
            >
              검색 적용
            </button>
          </div>
        </div>
      )}

      {/* 스카우트 모달 */}
      {scoutModal && (
        <div onClick={() => setScoutModal(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div onClick={(e) => e.stopPropagation()} className="w-[440px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">스카우트 제안</h2>
              <button onClick={() => setScoutModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{scoutModal.targetUser.name}</span>님에게 팀 합류를 제안합니다.
            </p>
            {scoutModal.teams.length === 0 ? (
              <p className="text-sm text-gray-400">팀장으로 등록된 팀이 없습니다. 먼저 팀을 만들어주세요.</p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-semibold">팀 선택</label>
                  <select
                    value={scoutModal.selectedTeamId}
                    onChange={(e) => setScoutModal((prev) => prev && { ...prev, selectedTeamId: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    {scoutModal.teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-semibold">메시지</label>
                  <textarea
                    value={scoutModal.message}
                    onChange={(e) => setScoutModal((prev) => prev && { ...prev, message: e.target.value })}
                    placeholder="합류 제안 메시지를 작성해주세요."
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                  />
                </div>
                {scoutError && <p className="mb-2 text-sm text-red-500">{scoutError}</p>}
                {scoutSuccess ? (
                  <p className="text-center text-sm font-semibold text-green-600">스카우트 제안을 보냈습니다!</p>
                ) : (
                  <button
                    onClick={submitScout}
                    disabled={scoutModal.loading}
                    className="w-full rounded-full bg-blue-600 py-3 text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
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
