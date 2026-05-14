'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPublicPortfolioBySlug, type PublicPortfolio } from '@/lib/portfolio-api';
import { getBannerGradientClass } from '@/app/profile/_banner';
import { UserIcon } from '@/components/icons/ChatIcons';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
} from '@/app/profile/_platforms';

/** 포트폴리오 항목 타입별 배지 메타 — /portfolio/[userId] 의 TYPE_META 와 동일 톤. */
const TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  PROJECT: { label: '프로젝트', bg: 'bg-purple-100', text: 'text-purple-700' },
  RESEARCH: { label: '연구', bg: 'bg-blue-100', text: 'text-blue-700' },
  STUDY: { label: '스터디', bg: 'bg-amber-100', text: 'text-amber-700' },
  ACTIVITY: { label: '활동', bg: 'bg-green-100', text: 'text-green-700' },
  ETC: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-700' },
};

type PublicItem = PublicPortfolio['items'][number];

/** 항목 카드 — /portfolio/[userId] 뷰어 카드와 동일 레이아웃 (단, 상세 링크는 비로그인이라 생략). */
function ItemCard({ item }: { item: PublicItem }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.ETC;
  return (
    <div className="card relative block">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}>
              {meta.label}
            </span>
            {item.domain && (
              <span className="bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                {item.domain}
              </span>
            )}
            {item.period && (
              <span className="text-xs text-gray-500">{item.period}</span>
            )}
            {item.current && (
              <span className="inline-flex items-center gap-1 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 bg-green-500" />
                진행중
              </span>
            )}
          </div>
          <h3 className="mb-2 font-semibold">{item.title}</h3>
          {(item.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(item.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          className={`shrink-0 overflow-hidden border ${
            item.thumbnail
              ? 'border-gray-200'
              : 'border-dashed border-gray-200 bg-gray-50'
          }`}
          style={{ width: '5rem', height: '5rem' }}
          aria-hidden
        >
          {item.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 프로젝트/연구/스터디 섹션 — /portfolio/[userId] 와 동일 구조. */
function ItemSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: PublicItem[];
  emptyText: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="card text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PublicPortfolioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null | 'loading'>(
    'loading',
  );

  useEffect(() => {
    if (!slug) return;
    getPublicPortfolioBySlug(slug).then((data) => setPortfolio(data));
  }, [slug]);

  if (portfolio === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="text-xl font-bold text-stone-800">
          포트폴리오를 찾을 수 없습니다
        </h1>
        <p className="text-sm text-stone-500">
          비공개이거나 존재하지 않는 링크입니다.
        </p>
        <Link
          href="/"
          className="mt-2 bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          모코지 홈으로
        </Link>
      </div>
    );
  }

  const {
    user,
    items = [],
    workExperiences = [],
    activities = [],
    links = [],
    intro,
  } = portfolio;
  const fullName = user.lastName + user.firstName;
  const gradeLabel = user.grade
    ? /^\d+$/.test(user.grade)
      ? `${user.grade}학년`
      : user.grade
    : null;
  const mainRole = user.roles[0];
  const subRoles = user.roles.slice(1);

  // /portfolio/[userId] 와 동일하게 타입별로 분리.
  const projects = items.filter((it) => it.type === 'PROJECT');
  const research = items.filter((it) => it.type === 'RESEARCH');
  const studies = items.filter((it) => it.type === 'STUDY');

  // 실무 경험: 재직중 먼저. 대외 활동: 연도 내림차순.
  const sortedExperiences = [...workExperiences].sort((a, b) =>
    a.current === b.current ? 0 : a.current ? -1 : 1,
  );
  const sortedActivities = [...activities].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (yb !== ya) return yb - ya;
    return (b.month ?? '').localeCompare(a.month ?? '');
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 — 모코지 브랜딩 (비로그인 공개 페이지 전용 chrome) */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-base font-bold text-indigo-600">
            모코지
          </Link>
          <Link
            href="/register"
            className="bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            가입하기
          </Link>
        </div>
      </header>

      {/* 본문 — /portfolio/[userId] 뷰어 레이아웃과 동일 */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* 배너 — 공개 데이터엔 bannerColor 가 없어 기본 그라데이션 */}
        <div
          className={`mb-6 h-32 w-full bg-gradient-to-br ${getBannerGradientClass(null)}`}
          aria-hidden
        />

        {/* 기본 정보 카드 */}
        <div className="card mb-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-start md:gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-primary-100 text-primary-600 md:h-24 md:w-24">
              {user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profileImage}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-10 w-10 md:h-12 md:w-12" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="break-keep text-2xl font-bold">{fullName}</h1>
              <p className="break-keep text-gray-600">
                {user.university} {user.department}
                {gradeLabel && (
                  <span className="ml-1 text-sm text-gray-400">
                    · {gradeLabel}
                  </span>
                )}
              </p>
              {user.bio && (
                <p className="mt-2 break-keep text-sm text-gray-500">
                  {user.bio}
                </p>
              )}

              {/* 직군 */}
              {(mainRole || subRoles.length > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {mainRole && (
                    <span className="inline-flex items-center justify-center bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                      {mainRole}
                    </span>
                  )}
                  {subRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center justify-center border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              )}

              {/* 기술 스택 */}
              {user.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {user.skills.map((skill) => (
                    <span
                      key={skill}
                      className="bg-blue-50 px-2 py-1 text-xs text-blue-600"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 링크 */}
        <div className="card mb-6">
          <h2 className="mb-4 text-lg font-semibold">링크</h2>
          {links.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 링크가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {links.map((lnk) => {
                const link = { id: lnk.id, url: lnk.url, label: lnk.label ?? undefined };
                const key = detectPlatform(link.url);
                const meta = PLATFORM_META[key];
                return (
                  <a
                    key={lnk.id}
                    href={lnk.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm shadow-sm transition-all hover:shadow-md ${meta.bg} ${meta.text}`}
                  >
                    <PlatformIcon k={key} className="h-4 w-4" />
                    <span className="font-medium">
                      {getDisplayLabel(link, key)}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* 자기소개 */}
        <div className="card mb-6">
          <div className="px-1 py-3">
            <h2 className="text-lg font-semibold">자기소개</h2>
          </div>
          <p className="whitespace-pre-wrap border border-gray-100 bg-gray-50/40 px-4 py-3 text-sm leading-relaxed text-gray-700">
            {intro || '등록된 자기소개가 없습니다.'}
          </p>
        </div>

        {/* 실무 경험 ↔ 대외 경험 */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">실무 경험 & 이력</h2>
            </div>
            {sortedExperiences.length === 0 ? (
              <p className="text-sm text-gray-500">
                아직 등록된 실무 경험이 없습니다.
              </p>
            ) : (
              <ol className="space-y-3">
                {sortedExperiences.map((exp, i) => (
                  <li
                    key={exp.id}
                    className="flex items-start gap-3 border border-gray-100 p-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-blue-50 text-xs font-semibold text-blue-600">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-800">
                          {exp.company} {exp.team}
                        </p>
                        {exp.current && (
                          <span className="inline-flex items-center gap-1 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 bg-green-500" />
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

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">대외 경험</h2>
            </div>
            {sortedActivities.length === 0 ? (
              <p className="text-sm text-gray-500">
                아직 등록된 경력이 없습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedActivities.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 px-2 py-1.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 bg-blue-500"
                      aria-hidden
                    />
                    <p className="flex-1 text-sm leading-relaxed text-gray-700">
                      <span className="font-semibold text-gray-900">
                        {c.year}년{c.month ? ` ${Number(c.month)}월` : ''}
                      </span>{' '}
                      {c.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 프로젝트 / 연구 / 스터디 */}
        <ItemSection
          title="프로젝트"
          items={projects}
          emptyText="등록된 프로젝트가 없습니다."
        />
        <ItemSection
          title="연구"
          items={research}
          emptyText="등록된 연구 항목이 없습니다."
        />
        <ItemSection
          title="스터디"
          items={studies}
          emptyText="등록된 스터디가 없습니다."
        />

        {/* 하단 CTA — 미가입 사용자 전환 유도 (요청에 따라 유지) */}
        <div className="mt-10 border border-indigo-100 bg-indigo-50 px-6 py-6 text-center">
          <p className="text-sm font-semibold text-indigo-900">
            {fullName}님과 함께하고 싶다면?
          </p>
          <p className="mt-1 text-xs text-indigo-700">
            모코지에서 프로젝트·해커톤·스터디 팀을 구해보세요.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            모코지 시작하기
          </Link>
        </div>
      </main>
    </div>
  );
}
