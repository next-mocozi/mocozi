'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type ProfileLink,
} from './_platforms';

// TODO: 백엔드 연동 — `GET /api/users/me`, `GET /api/users/me/links` 로 교체
//       (CLAUDE.md §11). 현재는 mock — localStorage로 edit 페이지와 동기화.

const LINKS_STORAGE_KEY = 'mock_profile_links';

const DEFAULT_LINKS: ProfileLink[] = [
  { id: 1, url: 'https://github.com/honggildong' },
  { id: 2, url: 'https://linkedin.com/in/honggildong' },
  { id: 3, url: 'https://honggildong.notion.site' },
];

const MOCK_PROFILE = {
  name: '홍길동',
  university: 'OO대학교',
  department: '컴퓨터공학과',
  bio:
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

/** 내 프로필 페이지 (보기 전용 — 수정은 /profile/edit) */
export default function MyProfilePage() {
  const { user, loading } = useAuth();
  const [links, setLinks] = useState<ProfileLink[]>(DEFAULT_LINKS);

  // edit 페이지에서 저장한 링크가 있으면 그걸로 표시
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LINKS_STORAGE_KEY);
      if (raw) setLinks(JSON.parse(raw));
    } catch {
      // 파싱 실패 시 기본값 유지
    }
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center">로딩 중...</div>;
  if (!user) return null;

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
              <h1 className="text-2xl font-bold">{user.name}</h1>
            </div>
            <p className="text-gray-600">
              {user.university} {user.department}
            </p>
            <p className="mt-2 text-sm text-gray-500">{user.bio}</p>

            {/* 직군 */}
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                {MOCK_PROFILE.mainRole}
              </span>
              {MOCK_PROFILE.subRoles.map((role) => (
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
              {user.skills.map((skill) => (
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

      {/* 외부 링크 — 보기 전용 (수정은 프로필 수정에서) */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">링크</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 등록된 링크가 없습니다. <Link href="/profile/edit" className="text-blue-600 hover:underline">프로필 수정</Link>에서 추가할 수 있어요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              const key = detectPlatform(link.url);
              const meta = PLATFORM_META[key];
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-sm transition-all hover:shadow-md ${meta.bg} ${meta.text}`}
                >
                  <PlatformIcon k={key} className="h-4 w-4" />
                  <span className="font-medium">{getDisplayLabel(link, key)}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* 실무 경험 / 인턴 / 이력 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">실무 경험 & 이력</h2>
        {MOCK_PROFILE.experiences.length === 0 ? (
          <p className="text-sm text-gray-500">아직 등록된 실무 경험이 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {MOCK_PROFILE.experiences.map((exp, i) => (
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
    </div>
  );
}
