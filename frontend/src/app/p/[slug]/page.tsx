'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPublicPortfolioBySlug, type PublicPortfolio } from '@/lib/portfolio-api';

const TYPE_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  PROJECT:  { label: '프로젝트',  bg: 'bg-blue-50',   text: 'text-blue-700' },
  RESEARCH: { label: '연구',      bg: 'bg-purple-50', text: 'text-purple-700' },
  STUDY:    { label: '스터디',    bg: 'bg-green-50',  text: 'text-green-700' },
  ACTIVITY: { label: '대외활동',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  ETC:      { label: '기타',      bg: 'bg-gray-100',  text: 'text-gray-600' },
};

export default function PublicPortfolioPage() {
  const { slug } = useParams<{ slug: string }>();
  const [portfolio, setPortfolio] = useState<PublicPortfolio | null | 'loading'>('loading');

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
        <h1 className="text-xl font-bold text-stone-800">포트폴리오를 찾을 수 없습니다</h1>
        <p className="text-sm text-stone-500">비공개이거나 존재하지 않는 링크입니다.</p>
        <Link href="/" className="mt-2 bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          모코지 홈으로
        </Link>
      </div>
    );
  }

  const { user, items = [], workExperiences = [], activities = [], links = [], intro } = portfolio;
  const fullName = user.lastName + user.firstName;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 헤더 — 모코지 브랜딩 */}
      <header className="border-b border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
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

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* 프로필 헤더 */}
        <section className="mb-8 flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-indigo-100 text-xl font-bold text-indigo-700">
            {user.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
            ) : (
              user.lastName
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-stone-900">{fullName}</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {user.university} · {user.department}
              {user.grade ? ` · ${user.grade}학년` : ''}
            </p>
            {user.roles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <span key={r} className="border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {r}
                  </span>
                ))}
              </div>
            )}
            {user.skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {user.skills.slice(0, 8).map((s) => (
                  <span key={s} className="bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    {s}
                  </span>
                ))}
                {user.skills.length > 8 && (
                  <span className="bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                    +{user.skills.length - 8}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 자기소개 */}
        {intro && (
          <section className="mb-8">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">소개</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{intro}</p>
          </section>
        )}

        {/* 포트폴리오 아이템 */}
        {items.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">포트폴리오</h2>
            <div className="space-y-3">
              {items.map((item) => {
                const meta = TYPE_LABEL[item.type] ?? TYPE_LABEL.ETC;
                return (
                  <div key={item.id} className="border border-stone-200 bg-white p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                      {item.domain && (
                        <span className="bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{item.domain}</span>
                      )}
                      {item.period && <span className="text-xs text-stone-400">{item.period}</span>}
                      {item.current && (
                        <span className="inline-flex items-center gap-1 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <span className="h-1.5 w-1.5 bg-green-500" />
                          진행중
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-stone-900">{item.title}</h3>
                    {item.summary && (
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{item.summary}</p>
                    )}
                    {(item.tags ?? []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(item.tags ?? []).slice(0, 6).map((t) => (
                          <span key={t} className="bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 실무 경험 */}
        {workExperiences.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">실무 경험</h2>
            <div className="space-y-2">
              {workExperiences.map((exp) => (
                <div key={exp.id} className="border border-stone-200 bg-white px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900">
                        {exp.company}
                        {exp.team && <span className="ml-1.5 text-sm font-normal text-stone-500">· {exp.team}</span>}
                      </p>
                      <p className="mt-0.5 text-sm text-stone-600">{exp.role}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-stone-400">{exp.period}</p>
                      {exp.current && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <span className="h-1.5 w-1.5 bg-green-500" />
                          재직중
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 대외 활동 */}
        {activities.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">대외 활동</h2>
            <ul className="space-y-2">
              {activities.map((act) => (
                <li key={act.id} className="flex items-start gap-3 border border-stone-200 bg-white px-5 py-3">
                  <span className="shrink-0 text-xs font-semibold text-stone-400">
                    {act.year}{act.month ? `.${Number(act.month)}` : ''}
                  </span>
                  <span className="text-sm text-stone-700">{act.content}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 외부 링크 */}
        {links.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-400">링크</h2>
            <div className="flex flex-wrap gap-2">
              {links.map((lnk) => (
                <a
                  key={lnk.id}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-stone-200 bg-white px-3 py-1.5 text-sm text-indigo-600 hover:bg-stone-50 hover:underline"
                >
                  {lnk.label || lnk.url}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 하단 CTA */}
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
