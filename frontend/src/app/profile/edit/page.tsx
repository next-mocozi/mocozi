'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type PlatformKey,
  type ProfileLink,
} from '../_platforms';

// TODO: 백엔드 연동
//   - GET  /api/users/me           로 초기값 로드 (현재는 하드코딩)
//   - PUT  /api/users/me           로 저장
//   - POST /api/users/me/links     로 링크 저장
// (CLAUDE.md §11 TODO)

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

// 링크 mock 영속화 — view 페이지와 같은 키 사용
const LINKS_STORAGE_KEY = 'mock_profile_links';

const DEFAULT_LINKS: ProfileLink[] = [
  { id: 1, url: 'https://github.com/honggildong' },
  { id: 2, url: 'https://linkedin.com/in/honggildong' },
  { id: 3, url: 'https://honggildong.notion.site' },
];

// 빠른 추가 (큰 버튼) — GitHub / LinkedIn
const QUICK_ADD: { key: PlatformKey; prefix: string }[] = [
  { key: 'github', prefix: 'https://github.com/' },
  { key: 'linkedin', prefix: 'https://linkedin.com/in/' },
];

// 기타 자동 인식 플랫폼 (작은 칩)
const OTHER_PLATFORMS: { key: PlatformKey; prefix: string }[] = [
  { key: 'googledrive', prefix: 'https://drive.google.com/' },
  { key: 'youtube', prefix: 'https://youtube.com/@' },
  { key: 'notion', prefix: 'https://www.notion.so/' },
  { key: 'twitter', prefix: 'https://x.com/' },
  { key: 'instagram', prefix: 'https://instagram.com/' },
  { key: 'velog', prefix: 'https://velog.io/@' },
  { key: 'medium', prefix: 'https://medium.com/@' },
  { key: 'figma', prefix: 'https://www.figma.com/@' },
];

/** 프로필 수정 페이지 */
export default function ProfileEditPage() {
  const router = useRouter();

  // 초기값은 일단 하드코딩 (백엔드 연동 시 GET /api/users/me 응답으로 교체)
  const [name, setName] = useState('홍길동');
  const [university, setUniversity] = useState('OO대학교');
  const [department, setDepartment] = useState('컴퓨터공학과');
  const [bio, setBio] = useState(
    '풀스택 개발에 관심이 많은 대학생입니다. 다양한 프로젝트 경험을 쌓고 싶습니다.'
  );
  const [mainRole, setMainRole] = useState('풀스택');
  const [subRoles, setSubRoles] = useState<string[]>(['프론트엔드', '백엔드']);
  const [skills, setSkills] = useState<string[]>([
    'React',
    'TypeScript',
    'Node.js',
    'Next.js',
  ]);
  const [skillInput, setSkillInput] = useState('');

  // ───────── 링크 ─────────
  const [links, setLinks] = useState<ProfileLink[]>(DEFAULT_LINKS);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [urlError, setUrlError] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  // 마운트 시 localStorage에서 기존 링크 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LINKS_STORAGE_KEY);
      if (raw) setLinks(JSON.parse(raw));
    } catch {
      // 파싱 실패 시 기본값 유지
    }
  }, []);

  const toggleSubRole = (role: string) => {
    if (role === mainRole) return;
    setSubRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, v]);
    setSkillInput('');
  };

  const removeSkill = (s: string) => {
    setSkills((prev) => prev.filter((x) => x !== s));
  };

  // 링크 핸들러
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
      const len = prefix.length;
      urlInputRef.current?.setSelectionRange(len, len);
    }, 0);
  };

  const previewKey: PlatformKey | null = (() => {
    if (!newUrl.trim()) return null;
    try {
      new URL(newUrl);
    } catch {
      return null;
    }
    return detectPlatform(newUrl);
  })();

  const handleAddLink = () => {
    const url = newUrl.trim();
    if (!url) {
      setUrlError('URL을 입력해주세요.');
      return;
    }
    try {
      new URL(url);
    } catch {
      setUrlError('올바른 URL 형식이 아닙니다. (예: https://example.com)');
      return;
    }
    if (links.some((l) => l.url === url)) {
      setUrlError('이미 추가된 URL입니다.');
      return;
    }
    const newKey = detectPlatform(url);
    if (
      newKey !== 'website' &&
      links.some((l) => detectPlatform(l.url) === newKey)
    ) {
      setUrlError(
        `이미 ${PLATFORM_META[newKey].label} 링크가 등록되어 있어요. 한 플랫폼당 하나만 추가할 수 있습니다.`
      );
      return;
    }
    setLinks((prev) => [
      ...prev,
      { id: Date.now(), url, label: newLabel.trim() || undefined },
    ]);
    resetLinkForm();
    setIsAddOpen(false);
  };

  const handleRemoveLink = (id: number) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = () => {
    // TODO: PUT /api/users/me 호출 (현재는 mock 저장 후 바로 이동)
    try {
      localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
    } catch {
      // 저장 실패해도 이동은 진행
    }
    router.push('/profile');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 헤더 */}
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
        {/* 이름 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* 학교 / 학과 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학교</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="예: 고려대학교"
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">학과</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="예: 컴퓨터공학과"
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* 한줄 소개 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            한줄 소개
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* 메인 직군 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            메인 직군
          </label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setMainRole(role);
                  setSubRoles((prev) => prev.filter((r) => r !== role));
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                  mainRole === role
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-blue-200 text-blue-600 hover:bg-blue-50'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* 서브 직군 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            서브 직군{' '}
            <span className="text-xs font-normal text-gray-400">
              (다중 선택 가능, 메인 직군 제외)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.filter((r) => r !== mainRole).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleSubRole(role)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
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

        {/* 기술 스택 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            기술 스택
          </label>
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="기술명 입력 후 Enter (예: React)"
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={addSkill}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              추가
            </button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSkill(s)}
                    className="text-blue-400 hover:text-blue-700"
                    aria-label={`${s} 제거`}
                  >
                    ✕
                  </button>
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
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
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
                  <div
                    key={link.id}
                    className={`group inline-flex items-center gap-2 rounded-full pl-3 pr-1 py-1 text-sm shadow-sm transition-all hover:shadow-md ${meta.bg} ${meta.text}`}
                  >
                    <span className="inline-flex items-center gap-2 py-1">
                      <PlatformIcon k={key} className="h-4 w-4" />
                      <span className="font-medium">{getDisplayLabel(link, key)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      aria-label="링크 삭제"
                      className="ml-1 flex h-6 w-6 items-center justify-center rounded-full transition-all hover:bg-black/20"
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
      <div className="mt-6 flex justify-end gap-2">
        <Link
          href="/profile"
          className="rounded-full border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          취소
        </Link>
        <button
          onClick={handleSave}
          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm text-white shadow-md hover:bg-blue-700"
        >
          저장
        </button>
      </div>

      {/* 링크 추가 모달 */}
      {isAddOpen && (
        <div
          onClick={() => setIsAddOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">링크 추가</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 빠른 추가 */}
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-gray-700">빠른 추가</p>
              <div className="flex gap-2">
                {QUICK_ADD.map((q) => {
                  const alreadyAdded = links.some(
                    (l) => detectPlatform(l.url) === q.key
                  );
                  const meta = PLATFORM_META[q.key];
                  return (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => handleQuickAdd(q.prefix)}
                      disabled={alreadyAdded}
                      title={
                        alreadyAdded ? '이미 추가됨' : `${meta.label} URL 자동 채우기`
                      }
                      className={`group flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                        alreadyAdded
                          ? 'cursor-not-allowed border-gray-100 opacity-40'
                          : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.bg} ${meta.text}`}
                      >
                        <PlatformIcon k={q.key} className="h-5 w-5" />
                      </span>
                      <span className="text-xs font-medium text-gray-700">
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 기타 자동 인식 플랫폼 */}
            <div className="mb-4 rounded-xl bg-gray-50 p-3">
              <p className="mb-2 text-xs text-gray-600">
                <span className="font-medium">기타 플랫폼</span> — 클릭하거나 URL을
                붙여넣으면 자동 인식돼요
              </p>
              <div className="flex flex-wrap gap-1.5">
                {OTHER_PLATFORMS.map((p) => {
                  const alreadyAdded = links.some(
                    (l) => detectPlatform(l.url) === p.key
                  );
                  const meta = PLATFORM_META[p.key];
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleQuickAdd(p.prefix)}
                      disabled={alreadyAdded}
                      title={
                        alreadyAdded ? '이미 추가됨' : `${meta.label} URL 자동 채우기`
                      }
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all ${
                        alreadyAdded
                          ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                          : 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 hover:scale-105 hover:shadow-md'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${
                          alreadyAdded ? '' : `${meta.bg} ${meta.text}`
                        }`}
                      >
                        <PlatformIcon k={p.key} className="h-2.5 w-2.5" />
                      </span>
                      <span className="font-medium">{meta.label}</span>
                    </button>
                  );
                })}
                <span
                  className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-gray-500 ring-1 ring-gray-200"
                  title="그 외 모든 웹사이트도 추가 가능"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white">
                    <PlatformIcon k="website" className="h-2.5 w-2.5" />
                  </span>
                  <span>그 외 일반 사이트</span>
                </span>
              </div>
            </div>

            {/* 구분선 */}
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              <span>또는 URL 직접 입력</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* URL */}
            <label className="mb-1 block text-sm font-medium text-gray-700">URL</label>
            <input
              ref={urlInputRef}
              type="url"
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLink();
              }}
              placeholder="https://github.com/your-id"
              className={`mb-1 w-full rounded-lg border px-4 py-2 text-sm outline-none focus:ring-2 ${
                urlError
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                  : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
              }`}
              autoFocus
            />
            {urlError && <p className="mb-2 text-xs text-red-500">{urlError}</p>}

            {/* 자동 감지 미리보기 */}
            {previewKey && (
              <div className="mb-4 mt-2 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span>자동 감지:</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${PLATFORM_META[previewKey].bg} ${PLATFORM_META[previewKey].text}`}
                >
                  <PlatformIcon k={previewKey} className="h-3.5 w-3.5" />
                  <span className="font-medium">{PLATFORM_META[previewKey].label}</span>
                </span>
              </div>
            )}

            {/* 라벨 */}
            <label className="mb-1 mt-2 block text-sm font-medium text-gray-700">
              라벨 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLink();
              }}
              placeholder="예: 개인 포트폴리오 사이트"
              className="mb-1 w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mb-4 text-xs text-gray-400">
              비우면 플랫폼 이름이 표시됩니다.
            </p>

            {/* 액션 */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddOpen(false)}
                className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleAddLink}
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm text-white shadow-md hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
