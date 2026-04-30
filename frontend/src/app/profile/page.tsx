'use client';

import Link from 'next/link';
import { useState } from 'react';

// TODO: 백엔드 연동 — `GET /api/users/me`, `POST /api/users/me/links` 로 교체 (CLAUDE.md §11 TODO)
//       타입은 shared/types/user.ts 의 UserProfile 사용 예정

type ProfileLink = { id: number; url: string; label?: string };

const INITIAL_LINKS: ProfileLink[] = [
  { id: 1, url: 'https://github.com/honggildong' },
  { id: 2, url: 'https://linkedin.com/in/honggildong' },
  { id: 3, url: 'https://honggildong.notion.site' },
];

const MOCK_PROFILE = {
  name: '홍길동',
  school: 'OO대학교',
  department: '컴퓨터공학과',
  intro:
    '풀스택 개발에 관심이 많은 대학생입니다. 다양한 프로젝트 경험을 쌓고 싶습니다.',
  mainRole: '풀스택',
  subRoles: ['프론트엔드', '백엔드'],
  skills: ['React', 'TypeScript', 'Node.js', 'Next.js'],
  experiences: [
    {
      id: 1,
      company: 'OpenAI Korea',
      team: '연구팀',
      role: '리서치 인턴',
      period: '2026.03 - 현재',
      current: true,
    },
    {
      id: 2,
      company: '삼성 SDI',
      team: '기획부서',
      role: '인턴',
      period: '2025.07 - 2025.08',
      current: false,
    },
  ],
};

// ───────────────────── 플랫폼 아이콘 (브랜드 SVG) ─────────────────────

type PlatformKey =
  | 'youtube'
  | 'github'
  | 'linkedin'
  | 'notion'
  | 'twitter'
  | 'instagram'
  | 'velog'
  | 'tistory'
  | 'medium'
  | 'figma'
  | 'website';

const PlatformIcon = ({ k, className }: { k: PlatformKey; className?: string }) => {
  switch (k) {
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M21.6 7.2c-.2-1-.9-1.7-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3c-1 .2-1.7.9-1.9 1.9C2 9 2 12 2 12s0 3 .4 4.8c.2 1 .9 1.7 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3c1-.2 1.7-.9 1.9-1.9.4-1.8.4-4.8.4-4.8s0-3-.4-4.8zM10 15V9l5.2 3L10 15z" />
        </svg>
      );
    case 'github':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.7.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 6 .5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M19 0H5a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h14a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5zM7 19H4V8h3v11zM5.5 6.5a1.8 1.8 0 1 1 0-3.5 1.8 1.8 0 0 1 0 3.5zM20 19h-3v-5.6c0-1.4-.5-2.4-1.8-2.4-1 0-1.6.7-1.9 1.4-.1.2-.1.6-.1.9V19h-3V8h3v1.3a3 3 0 0 1 2.7-1.5c2 0 3.5 1.3 3.5 4V19z" />
        </svg>
      );
    case 'notion':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M4.5 4.4c.7.6 1 .5 2.3.4l12.4-.7c.3 0 0-.3-.1-.3l-2-1.5c-.4-.3-1-.7-2-.6L3.4 2.7c-.4 0-.5.2-.4.4l1.5 1.3zm.7 2.8v13c0 .7.4 1 1.2 1l13.7-.8c.8 0 .9-.5.9-1.1V6.4c0-.6-.2-.9-.7-.9l-14.3.8c-.6 0-.8.3-.8.9zm12.7.7c.1.4 0 .7-.4.8l-.7.1v9.6c-.6.3-1.1.5-1.5.5-.7 0-.9-.2-1.4-.8L9.5 11v6.9l1.4.3s0 .8-1.1.8l-3.1.2c-.1-.2 0-.7.3-.8l.8-.2V8.6l-1.1-.1c-.1-.5.1-1 .7-1l3.4-.2 4.7 7.2V8l-1.2-.1c-.1-.5.3-.9.8-1l3.1-.2z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4 1 .5.4.8.8 1 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.7s0 3.5-.1 4.7c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.4-.4.5-.8.8-1.4 1-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-1-.5-.4-.8-.8-1-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.4.4-.5.8-.8 1.4-1 .4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.5-1.3.9-.4.4-.7.8-.9 1.3-.2.4-.3 1-.4 2.1C2.5 9.5 2.5 9.9 2.5 12s0 2.5.1 3.7c.1 1.1.2 1.7.4 2.1.2.5.5.9.9 1.3.4.4.8.7 1.3.9.4.2 1 .3 2.1.4 1.2.1 1.6.1 3.7.1s2.5 0 3.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.5 1.3-.9.4-.4.7-.8.9-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-3.7s0-2.5-.1-3.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.5-.9-.9-1.3-.4-.4-.8-.7-1.3-.9-.4-.2-1-.3-2.1-.4C14.5 4 14.1 4 12 4zm0 3.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2zm0 7.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm5.8-7.8a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z" />
        </svg>
      );
    case 'velog':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M3 3h18v18H3V3zm6.4 5.5h2.5l1.4 6.4 1.6-6.4h2.4l-2.7 9h-2.7l-2.5-9z" />
        </svg>
      );
    case 'tistory':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="12" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <circle cx="18" cy="12" r="2.5" />
        </svg>
      );
    case 'medium':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M2.4 5.5l1.4 1.4v10.2l-1.4 1.4v.5h4.5v-.5L5.5 17.1V8l5.7 11h.7L17 8.4v9.3l-1 1v.3h6v-.3l-1-1V6.5l1-1V5h-5l-3.6 8.7L9.4 5H2.4v.5z" />
        </svg>
      );
    case 'figma':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M8.5 2h3.5v6H8.5a3 3 0 0 1 0-6zm0 8h3.5v6H8.5a3 3 0 0 1 0-6zm3.5 8v3a3 3 0 1 1-3-3h3zM12 2h3.5a3 3 0 0 1 0 6H12V2zm0 8h3.5a3 3 0 1 1 0 6H12v-6z" />
        </svg>
      );
    case 'website':
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
};

// 플랫폼별 라벨 + 칩 색상 (배경, 텍스트)
const PLATFORM_META: Record<PlatformKey, { label: string; bg: string; text: string }> = {
  youtube: { label: 'YouTube', bg: 'bg-red-600', text: 'text-white' },
  github: { label: 'GitHub', bg: 'bg-gray-900', text: 'text-white' },
  linkedin: { label: 'LinkedIn', bg: 'bg-blue-600', text: 'text-white' },
  notion: { label: 'Notion', bg: 'bg-white border border-gray-200', text: 'text-gray-900' },
  twitter: { label: 'X', bg: 'bg-black', text: 'text-white' },
  instagram: {
    label: 'Instagram',
    bg: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600',
    text: 'text-white',
  },
  velog: { label: 'Velog', bg: 'bg-emerald-500', text: 'text-white' },
  tistory: { label: 'Tistory', bg: 'bg-orange-500', text: 'text-white' },
  medium: { label: 'Medium', bg: 'bg-black', text: 'text-white' },
  figma: { label: 'Figma', bg: 'bg-gray-800', text: 'text-white' },
  website: { label: 'Website', bg: 'bg-blue-500', text: 'text-white' },
};

// URL → 플랫폼 자동 감지
function detectPlatform(url: string): PlatformKey {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'website';
  }
  if (/youtube\.com$|youtu\.be$/.test(host)) return 'youtube';
  if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
  if (host.endsWith('notion.so') || host.endsWith('notion.site')) return 'notion';
  if (host === 'twitter.com' || host === 'x.com') return 'twitter';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'velog.io' || host.endsWith('.velog.io')) return 'velog';
  if (host.endsWith('tistory.com')) return 'tistory';
  if (host === 'medium.com' || host.endsWith('.medium.com')) return 'medium';
  if (host === 'figma.com' || host.endsWith('.figma.com')) return 'figma';
  return 'website';
}

// 표시할 라벨: 사용자 지정 라벨 우선, 없으면 플랫폼 기본 라벨
function getDisplayLabel(link: ProfileLink, key: PlatformKey): string {
  if (link.label && link.label.trim()) return link.label.trim();
  return PLATFORM_META[key].label;
}

/** 내 프로필 페이지 */
export default function MyProfilePage() {
  const profile = MOCK_PROFILE;

  // 링크 추가/삭제 (TODO: 백엔드 연동 시 서버 상태로 대체)
  const [links, setLinks] = useState<ProfileLink[]>(INITIAL_LINKS);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [urlError, setUrlError] = useState('');

  // URL 미리보기용 — 입력 즉시 감지
  const previewKey: PlatformKey | null = (() => {
    if (!newUrl.trim()) return null;
    try {
      new URL(newUrl);
    } catch {
      return null;
    }
    return detectPlatform(newUrl);
  })();

  const resetForm = () => {
    setNewUrl('');
    setNewLabel('');
    setUrlError('');
  };

  const handleAdd = () => {
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
    setLinks((prev) => [
      ...prev,
      { id: Date.now(), url, label: newLabel.trim() || undefined },
    ]);
    resetForm();
    setIsAddOpen(false);
  };

  const handleRemove = (id: number) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 요약 */}
      <div className="card mb-6">
        <div className="flex items-start gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-600">
            👤
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
            </div>
            <p className="text-gray-600">
              {profile.school} {profile.department}
            </p>
            <p className="mt-2 text-sm text-gray-500">{profile.intro}</p>

            {/* 직군 */}
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                {profile.mainRole}
              </span>
              {profile.subRoles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
                >
                  {role}
                </span>
              ))}
            </div>

            {/* 기술 스택 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          <Link href="/profile/edit" className="btn-secondary text-sm">
            프로필 수정
          </Link>
        </div>
      </div>

      {/* 외부 링크 */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">링크</h2>
          <button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
          >
            + 링크 추가
          </button>
        </div>
        {links.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 등록된 링크가 없습니다. GitHub, LinkedIn, Notion, YouTube 등을
            추가해보세요.
          </p>
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
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 py-1"
                  >
                    <PlatformIcon k={key} className="h-4 w-4" />
                    <span className="font-medium">{getDisplayLabel(link, key)}</span>
                  </a>
                  <button
                    onClick={() => handleRemove(link.id)}
                    aria-label="링크 삭제"
                    className="ml-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition-all hover:bg-black/20 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 실무 경험 / 인턴 */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">실무 경험 / 인턴</h2>
          <button className="text-xs text-blue-600 hover:underline">
            + 경력 추가
          </button>
        </div>
        {profile.experiences.length === 0 ? (
          <p className="text-sm text-gray-500">아직 등록된 실무 경험이 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {profile.experiences.map((exp, i) => (
              <li
                key={exp.id}
                className="flex items-start gap-3 rounded-xl border border-gray-100 p-4 transition-all hover:bg-gray-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-800">
                      {exp.company} {exp.team}
                    </p>
                    {exp.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        재직중
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{exp.role}</p>
                  <p className="mt-1 text-xs text-gray-400">{exp.period}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 경력 요약 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">경력 요약</h2>
        <p className="text-gray-600">
          아직 등록된 경력 요약이 없습니다. 프로필을 수정하여 추가해보세요.
        </p>
      </div>

      {/* 포트폴리오 카드 리스트 */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">포트폴리오</h2>
          <button className="btn-primary text-sm">새 항목 추가</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                프로젝트
              </span>
              <span className="text-xs text-gray-500">2024.01 - 2024.03</span>
            </div>
            <h3 className="mb-1 font-semibold">웹 포트폴리오 사이트</h3>
            <p className="mb-2 text-sm text-gray-600">
              개인 포트폴리오 웹사이트를 제작했습니다.
            </p>
            <div className="flex flex-wrap gap-1">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Next.js
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Tailwind
              </span>
            </div>
          </div>

          <div className="card flex items-center justify-center border-dashed text-center text-gray-400">
            <div>
              <div className="mb-2 text-3xl">+</div>
              <p className="text-sm">새 포트폴리오 항목 추가</p>
            </div>
          </div>
        </div>
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

            {/* URL */}
            <label className="mb-1 block text-sm font-medium text-gray-700">
              URL
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => {
                setNewUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
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

            {/* 라벨 (선택) */}
            <label className="mb-1 mt-2 block text-sm font-medium text-gray-700">
              라벨 <span className="text-xs font-normal text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
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
                onClick={handleAdd}
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
