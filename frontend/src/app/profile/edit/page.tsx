'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolio, invalidateMyPortfolio } from '@/hooks/useMyPortfolio';
import api from '@/lib/api';
import { syncLinksToBackend } from '@/lib/portfolio-mapper';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type PlatformKey,
  type ProfileLink,
} from '../_platforms';

/** 아직 직군을 정하지 않은 사용자를 위한 특수 옵션. 메인으로 선택 시 서브 직군은 숨김. */
const EXPLORING_ROLE = '탐색 중';

const ROLE_OPTIONS = [
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
];

/** 메인 직군 선택지 — 일반 옵션 + "탐색 중" */
const MAIN_ROLE_OPTIONS = [...ROLE_OPTIONS, EXPLORING_ROLE];

const ROLES_STORAGE_KEY = 'mock_profile_roles';

/** 구인 페이지와 동일한 기술 스택 카테고리 — 사용자가 클릭으로 추가/제거 */
const SKILL_GROUPS: { label: string; skills: string[] }[] = [
  { label: '프론트엔드', skills: ['React', 'Next.js', 'Vue.js', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'Redux', 'Vite'] },
  { label: '백엔드', skills: ['Node.js', 'NestJS', 'Spring Boot', 'Java', 'Python', 'FastAPI', 'Go', 'Kotlin', 'PHP', 'Rust'] },
  { label: '모바일', skills: ['React Native', 'Flutter', 'Swift', 'iOS', 'Android'] },
  { label: '데이터베이스', skills: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'GraphQL'] },
  { label: 'DevOps', skills: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Linux'] },
  { label: 'AI/데이터', skills: ['TensorFlow', 'PyTorch', 'Pandas', 'LangChain', 'OpenAI API'] },
  { label: '툴/기타', skills: ['Git', 'GitHub', 'Figma', 'Jest', 'Jira'] },
];

const QUICK_ADD: { key: PlatformKey; prefix: string }[] = [
  { key: 'github', prefix: 'https://github.com/' },
  { key: 'linkedin', prefix: 'https://linkedin.com/in/' },
];

const OTHER_PLATFORMS: { key: PlatformKey; prefix: string }[] = [
  { key: 'googledrive', prefix: 'https://drive.google.com/' },
  { key: 'youtube', prefix: 'https://youtube.com/@' },
  { key: 'notion', prefix: 'https://www.notion.so/' },
  { key: 'twitter', prefix: 'https://x.com/' },
  { key: 'threads', prefix: 'https://www.threads.com/@' },
  { key: 'instagram', prefix: 'https://instagram.com/' },
  { key: 'velog', prefix: 'https://velog.io/@' },
  { key: 'medium', prefix: 'https://medium.com/@' },
  { key: 'figma', prefix: 'https://www.figma.com/@' },
];

/** 프로필 수정 페이지 */
export default function ProfileEditPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const { portfolio } = useMyPortfolio();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState('');
  const [bio, setBio] = useState('');
  const [mainRole, setMainRole] = useState('');
  const [subRoles, setSubRoles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [skillSearch, setSkillSearch] = useState('');

  const [links, setLinks] = useState<ProfileLink[]>([]);
  /** 저장 시 백엔드에서 삭제할 기존 링크들의 serverId */
  const [removedLinkServerIds, setRemovedLinkServerIds] = useState<string[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [urlError, setUrlError] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // API에서 초기값 로드
  useEffect(() => {
    if (!user) return;
    setLastName(user.lastName ?? '');
    setFirstName(user.firstName ?? '');
    setUniversity(user.university ?? '');
    setDepartment(user.department ?? '');
    setGrade(user.grade ?? '');
    setBio(user.bio ?? '');
    setSkills(user.skills ?? []);
  }, [user]);

  // 링크는 백엔드(portfolio.links)가 source of truth — serverId 를 함께 보관해야
  // 저장 시 신규는 create, 기존은 update 로 처리돼 중복이 쌓이지 않는다.
  useEffect(() => {
    if (!portfolio) return;
    setLinks(
      (portfolio.links ?? []).map((b, i) => ({
        // id 는 React key + 로컬 식별용 — 신규 링크(Date.now())와 겹치지 않게 index 사용
        id: i,
        serverId: b.id,
        url: b.url,
        label: b.label ?? undefined,
      })),
    );
    setRemovedLinkServerIds([]);
  }, [portfolio]);

  // localStorage에서 roles 로드
  useEffect(() => {
    const loadJson = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    // 직군 — backend(user.roles[]) 우선, localStorage 는 캐시 fallback.
    // backend 정책: roles[0] = mainRole, roles[1..] = subRoles.
    const userRoles = user?.roles ?? [];
    if (userRoles.length > 0) {
      setMainRole(userRoles[0] ?? '');
      setSubRoles(userRoles.slice(1));
    } else {
      const cached = loadJson<{ mainRole: string; subRoles: string[] } | null>(
        ROLES_STORAGE_KEY,
        null,
      );
      if (cached) {
        setMainRole(cached.mainRole);
        setSubRoles(cached.subRoles);
      }
    }
  }, [user]);

  const toggleSubRole = (role: string) => {
    if (role === mainRole) return;
    setSubRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || skills.includes(v)) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, v]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => setSkills((prev) => prev.filter((x) => x !== s));

  const toggleSkill = (s: string) =>
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const resetLinkForm = () => {
    setNewUrl('');
    setNewLabel('');
    setUrlError('');
  };

  const openAddModal = () => {
    resetLinkForm();
    setIsAddOpen(true);
  };

  const handleQuickAdd = (prefix: string) => {
    setNewUrl(prefix);
    setUrlError('');
    setTimeout(() => {
      urlInputRef.current?.focus();
      urlInputRef.current?.setSelectionRange(prefix.length, prefix.length);
    }, 0);
  };

  const previewKey: PlatformKey | null = (() => {
    if (!newUrl.trim()) return null;
    try { new URL(newUrl); } catch { return null; }
    return detectPlatform(newUrl);
  })();

  const handleAddLink = () => {
    const url = newUrl.trim();
    if (!url) { setUrlError('URL을 입력해주세요.'); return; }
    try { new URL(url); } catch {
      setUrlError('올바른 URL 형식이 아닙니다. (예: https://example.com)');
      return;
    }
    if (links.some((l) => l.url === url)) { setUrlError('이미 추가된 URL입니다.'); return; }
    const newKey = detectPlatform(url);
    if (newKey !== 'website' && links.some((l) => detectPlatform(l.url) === newKey)) {
      setUrlError(`이미 ${PLATFORM_META[newKey].label} 링크가 등록되어 있어요.`);
      return;
    }
    setLinks((prev) => [...prev, { id: Date.now(), url, label: newLabel.trim() || undefined }]);
    resetLinkForm();
    setIsAddOpen(false);
  };

  const handleRemoveLink = (id: string | number) => {
    setLinks((prev) => {
      const target = prev.find((l) => l.id === id);
      // 기존(백엔드에 존재하는) 링크면 저장 시 삭제하도록 기록
      if (target?.serverId) {
        setRemovedLinkServerIds((ids) => [...ids, target.serverId!]);
      }
      return prev.filter((l) => l.id !== id);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // 직군 — backend는 단일 배열로 저장: roles[0] = mainRole, roles[1..] = subRoles.
      // mainRole 미설정이면 빈 배열로 보내 backend도 초기화.
      const roles = mainRole ? [mainRole, ...subRoles] : [];
      await api.put('/api/users/me', {
        lastName,
        firstName,
        university,
        department,
        grade,
        bio,
        skills,
        roles,
      });
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify({ mainRole, subRoles }));
      // 백엔드 링크 동기화 — 신규 create / 기존 update / 삭제 delete.
      // 완료를 기다린 뒤 캐시를 무효화해야 다음 진입 시 serverId 가 반영된다.
      await syncLinksToBackend(links, removedLinkServerIds);
      await invalidateMyPortfolio();
      await refreshUser();
      router.push('/profile');
    } catch {
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">로딩 중...</div>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/profile"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 프로필로
          </Link>
          <h1 className="text-2xl font-bold">프로필 수정</h1>
        </div>
      </div>

      <div className="card space-y-6">
        {/* 성 / 이름 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">성</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="홍"
              className="w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="길동"
              className="w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* 학교 / 학과 / 학년 */}
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학교</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="예: 고려대학교"
              className="w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학과</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="예: 컴퓨터공학과"
              className="w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학년</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">선택</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
              <option value="4">4학년</option>
              <option value="대학원">대학원</option>
            </select>
          </div>
        </div>

        {/* 한줄 소개 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">한줄 소개</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 100))}
            maxLength={100}
            rows={3}
            className="w-full resize-none border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{bio.length}/100</p>
        </div>

        {/* 메인 직군 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            메인 직군{' '}
            <span className="text-xs font-normal text-gray-400">
              (아직 정하지 않았다면 "탐색 중"을 선택하세요)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {MAIN_ROLE_OPTIONS.map((role) => {
              const isExploring = role === EXPLORING_ROLE;
              const isActive = mainRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setMainRole(role);
                    if (isExploring) {
                      // 탐색 중 → 서브 직군은 의미 없음, 비움
                      setSubRoles([]);
                    } else {
                      setSubRoles((prev) => prev.filter((r) => r !== role));
                    }
                  }}
                  className={`border px-3 py-1.5 text-xs transition-all ${
                    isActive
                      ? isExploring
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-blue-600 bg-blue-600 text-white'
                      : isExploring
                        ? 'border-dashed border-amber-300 text-amber-600 hover:bg-amber-50'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </div>

        {/* 서브 직군 — 메인이 "탐색 중"이면 통째로 숨김 */}
        {mainRole !== EXPLORING_ROLE && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              서브 직군{' '}
              <span className="text-xs font-normal text-gray-400">(다중 선택 가능, 메인 직군 제외)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.filter((r) => r !== mainRole).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleSubRole(role)}
                  className={`border px-3 py-1.5 text-xs transition-all ${
                    subRoles.includes(role)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 기술 스택 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">기술 스택</label>

          {/* 카테고리별 선택 — 클릭으로 토글 */}
          <input
            type="text"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder="스킬 검색..."
            className="mb-2 w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <div className="mb-3 flex max-h-56 flex-col gap-3 overflow-y-auto border border-gray-100 p-3">
            {SKILL_GROUPS.map(({ label, skills: groupSkills }) => {
              const filtered = groupSkills.filter((s) =>
                s.toLowerCase().includes(skillSearch.toLowerCase()),
              );
              if (filtered.length === 0) return null;
              return (
                <div key={label}>
                  <p className="mb-1.5 text-3xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {filtered.map((s) => {
                      const active = skills.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSkill(s)}
                          className={`border px-3 py-1 text-xs transition-all ${
                            active
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 직접 입력 (목록에 없는 커스텀 스킬용) */}
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="목록에 없으면 직접 입력 후 Enter"
              className="flex-1 border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={addSkill}
              className="bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              추가
            </button>
          </div>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 bg-blue-50 px-2 py-1 text-xs text-blue-600">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="text-blue-400 hover:text-blue-700" aria-label={`${s} 제거`}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 링크 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">링크</label>
            <button
              type="button"
              onClick={openAddModal}
              className="bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
            >
              + 링크 추가
            </button>
          </div>
          {links.length === 0 ? (
            <p className="text-xs text-gray-500">아직 등록된 링크가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {links.map((link) => {
                const key = detectPlatform(link.url);
                const meta = PLATFORM_META[key];
                return (
                  <div key={link.id} className={`group inline-flex items-center gap-2 pl-3 pr-1 py-1 text-sm shadow-sm ${meta.bg} ${meta.text}`}>
                    <span className="inline-flex items-center gap-2 py-1">
                      <PlatformIcon k={key} className="h-4 w-4" />
                      <span className="font-medium">{getDisplayLabel(link, key)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      aria-label="링크 삭제"
                      className="ml-1 flex h-6 w-6 items-center justify-center transition-all hover:bg-black/20"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="mt-6 flex flex-col items-end gap-2">
        {saveError && <p className="text-sm text-red-500">{saveError}</p>}
        <div className="flex gap-2">
          <Link
            href="/profile"
            className="border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 px-6 py-2.5 text-sm text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 링크 추가 모달 */}
      {isAddOpen && (
        <div onClick={() => setIsAddOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">링크 추가</h2>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="닫기">✕</button>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-gray-700">빠른 추가</p>
              <div className="flex gap-2">
                {QUICK_ADD.map((q) => {
                  const alreadyAdded = links.some((l) => detectPlatform(l.url) === q.key);
                  const meta = PLATFORM_META[q.key];
                  return (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => handleQuickAdd(q.prefix)}
                      disabled={alreadyAdded}
                      className={`group flex flex-1 flex-col items-center gap-1.5 border p-3 transition-all ${alreadyAdded ? 'cursor-not-allowed border-gray-100 opacity-40' : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'}`}
                    >
                      <span className={`flex h-10 w-10 items-center justify-center ${meta.bg} ${meta.text}`}>
                        <PlatformIcon k={q.key} className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium text-gray-700">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4 bg-gray-50 p-3">
              <p className="mb-2 text-xs text-gray-600"><span className="font-medium">기타 플랫폼</span> — 클릭하거나 URL을 붙여넣으면 자동 인식돼요</p>
              <div className="flex flex-wrap gap-1.5">
                {OTHER_PLATFORMS.map((p) => {
                  const alreadyAdded = links.some((l) => detectPlatform(l.url) === p.key);
                  const meta = PLATFORM_META[p.key];
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleQuickAdd(p.prefix)}
                      disabled={alreadyAdded}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all ${alreadyAdded ? 'cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 hover:scale-105 hover:shadow-md'}`}
                    >
                      <span className={`flex h-4 w-4 items-center justify-center ${alreadyAdded ? '' : `${meta.bg} ${meta.text}`}`}>
                        <PlatformIcon k={p.key} className="h-2.5 w-2.5" />
                      </span>
                      <span className="font-medium">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              <span>또는 URL 직접 입력</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <label className="mb-1 block text-sm font-medium text-gray-700">URL</label>
            <input
              ref={urlInputRef}
              type="url"
              value={newUrl}
              onChange={(e) => { setNewUrl(e.target.value); if (urlError) setUrlError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddLink(); }}
              placeholder="https://github.com/your-id"
              className={`mb-1 w-full border px-4 py-2 text-sm outline-none focus:ring-2 ${urlError ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'}`}
              autoFocus
            />
            {urlError && <p className="mb-2 text-xs text-red-500">{urlError}</p>}

            {previewKey && (
              <div className="mb-4 mt-2 flex items-center gap-2 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span>자동 감지:</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${PLATFORM_META[previewKey].bg} ${PLATFORM_META[previewKey].text}`}>
                  <PlatformIcon k={previewKey} className="h-3.5 w-3.5" />
                  <span className="font-medium">{PLATFORM_META[previewKey].label}</span>
                </span>
              </div>
            )}

            <label className="mb-1 mt-2 block text-sm font-medium text-gray-700">
              라벨 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddLink(); }}
              placeholder="예: 개인 포트폴리오 사이트"
              className="mb-1 w-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mb-4 text-xs text-gray-400">비우면 플랫폼 이름이 표시됩니다.</p>

            <div className="flex gap-2">
              <button onClick={() => setIsAddOpen(false)} className="flex-1 border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleAddLink} className="flex-1 bg-blue-600 py-2.5 text-sm text-white shadow-md hover:bg-blue-700">추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
