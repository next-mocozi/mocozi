'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolio } from '@/hooks/useMyPortfolio';
import { UserIcon } from '@/components/icons/ChatIcons';
import api from '@/lib/api';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type ProfileLink,
} from './_platforms';

const PROFILE_SECTIONS_KEY = 'mock_profile_portfolio_sections';

const DEFAULT_LINKS: ProfileLink[] = [];

// 배너 색상 상수는 공유 파일에서 — 타인 프로필 페이지(/profile/[id]) 와 동일 사용.
import {
  BANNER_GRADIENTS,
  DEFAULT_BANNER_COLOR,
  type BannerColor,
} from './_banner';

// /portfolio 페이지와 같은 형태 — 단순 표시 용도라 import 없이 정의
type Experience = {
  id: number;
  company: string;
  team: string;
  role: string;
  period: string;
  current: boolean;
};

type CareerItem = {
  id: number;
  year: string;
  content: string;
};

type PortfolioItemType =
  | 'project'
  | 'research'
  | 'study'
  | 'activity'
  | 'etc';

type PortfolioItem = {
  id: number;
  type: PortfolioItemType;
  title: string;
  description: string;
  period: string;
  current: boolean;
  domain?: string;
  tags: string[];
  /** 미완성 임시저장 — 프로필에는 노출하지 않음 */
  draft?: boolean;
  /** 카드 우측 썸네일 (선택) — 포트폴리오 측에서 저장됨 */
  thumbnail?: string;
};

const TYPE_META: Record<
  PortfolioItemType,
  { label: string; bg: string; text: string }
> = {
  project: { label: '프로젝트', bg: 'bg-purple-100', text: 'text-purple-700' },
  research: { label: '연구', bg: 'bg-blue-100', text: 'text-blue-700' },
  study: { label: '스터디', bg: 'bg-amber-100', text: 'text-amber-700' },
  activity: { label: '활동', bg: 'bg-green-100', text: 'text-green-700' },
  etc: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-700' },
};

// 포트폴리오에서 가져올 수 있는 항목들
type SectionKey =
  | 'intro'
  | 'experiences'
  | 'careers'
  | 'projects'
  | 'research'
  | 'studies';

const SECTION_ORDER: SectionKey[] = [
  'intro',
  'experiences',
  'careers',
  'projects',
  'research',
  'studies',
];

const SECTION_META: Record<SectionKey, { label: string; hint: string }> = {
  intro: {
    label: '자기소개',
    hint: '포트폴리오에 작성한 자기소개를 표시합니다.',
  },
  experiences: {
    label: '실무 경험 & 이력',
    hint: '인턴·직장 등 실무 경험을 표시합니다.',
  },
  careers: {
    label: '경력 요약',
    hint: '수상·자격증·활동을 연도별로 표시합니다.',
  },
  projects: {
    label: '프로젝트',
    hint: '등록된 프로젝트 카드를 표시합니다.',
  },
  research: {
    label: '연구',
    hint: '등록된 연구 카드를 표시합니다.',
  },
  studies: {
    label: '스터디',
    hint: '등록된 스터디 카드를 표시합니다.',
  },
};

/** 내 프로필 페이지 (보기 전용 — 수정은 /profile/edit, /portfolio) */
export default function MyProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const { portfolio } = useMyPortfolio();
  const [links, setLinks] = useState<ProfileLink[]>(DEFAULT_LINKS);

  // 직군 (edit 페이지에서 localStorage에 저장)
  const [mainRole, setMainRole] = useState('');
  const [subRoles, setSubRoles] = useState<string[]>([]);

  // 포트폴리오에서 가져온 데이터
  const [intro, setIntro] = useState('');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [careers, setCareers] = useState<CareerItem[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);

  // 어떤 항목을 가져와 표시할지 (선택 상태)
  const [selected, setSelected] = useState<SectionKey[]>(SECTION_ORDER);

  // 가져오기 모달
  const [importOpen, setImportOpen] = useState(false);
  const [draftSelected, setDraftSelected] =
    useState<SectionKey[]>(SECTION_ORDER);

  // 세그먼트 컨트롤 — 현재 활성 탭
  const [activeTab, setActiveTab] = useState<SectionKey>(SECTION_ORDER[0]);

  // 배너 색상 — 서버(User.bannerColor)가 source of truth
  const [bannerColor, setBannerColor] = useState<BannerColor>(DEFAULT_BANNER_COLOR);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    const saved = user?.bannerColor;
    if (saved && BANNER_GRADIENTS.some((g) => g.key === saved)) {
      setBannerColor(saved as BannerColor);
    }
  }, [user?.bannerColor]);

  const changeBannerColor = async (color: BannerColor) => {
    const prev = bannerColor;
    setBannerColor(color); // optimistic
    setColorPickerOpen(false);
    try {
      await api.put('/api/users/me', { bannerColor: color });
      await refreshUser();
    } catch {
      setBannerColor(prev); // 롤백
    }
  };

  const currentGradient =
    BANNER_GRADIENTS.find((g) => g.key === bannerColor)?.class ??
    BANNER_GRADIENTS[0].class;

  // selected 가 바뀌었을 때 activeTab 이 더 이상 선택돼있지 않으면 첫 번째로 이동
  useEffect(() => {
    if (selected.length > 0 && !selected.includes(activeTab)) {
      setActiveTab(selected[0]);
    }
  }, [selected, activeTab]);

  // SWR 캐시에서 포트폴리오 데이터 반영 (캐시 히트 시 즉시 실행)
  useEffect(() => {
    if (!portfolio) return;

    setIntro(portfolio.intro ?? '');
    setExperiences(
      (portfolio.workExperiences ?? []).map((b) => ({
        id: new Date(b.createdAt).getTime(),
        company: b.company,
        team: b.team ?? '',
        role: b.role,
        period: b.period,
        current: b.current,
      })),
    );
    setCareers(
      (portfolio.activities ?? []).map((b) => ({
        id: new Date(b.createdAt).getTime(),
        year: b.year,
        month: b.month ?? undefined,
        content: b.content,
      })),
    );
    setItems(
      (portfolio.items ?? []).map((b) => ({
        id: new Date(b.createdAt).getTime(),
        type: (
          { PROJECT: 'project', RESEARCH: 'research', STUDY: 'study', ACTIVITY: 'activity', ETC: 'etc' } as Record<string, PortfolioItemType>
        )[b.type] ?? 'etc',
        title: b.title,
        description: b.description,
        period: b.period ?? b.duration ?? '',
        current: b.current ?? false,
        domain: b.domain || undefined,
        tags: b.tags ?? [],
        thumbnail: b.thumbnail ?? undefined,
      })),
    );
    setLinks(
      (portfolio.links ?? []).map((b) => ({
        id: new Date(b.createdAt).getTime(),
        url: b.url,
        label: b.label ?? undefined,
      })),
    );
  }, [portfolio]);

  // 직군·섹션 선택은 user/localStorage에서
  useEffect(() => {
    if (!user) return;
    if (user.roles && user.roles.length > 0) {
      setMainRole(user.roles[0]);
      setSubRoles(user.roles.slice(1));
    }
    try {
      const raw = localStorage.getItem(PROFILE_SECTIONS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SectionKey[];
        setSelected(saved);
        setDraftSelected(saved);
      }
    } catch {
      // 무시
    }
  }, [user]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        로딩 중...
      </div>
    );
  if (!user) return null;

  // 타입별로 분리 — 임시저장은 모두 제외
  const projects = items.filter((it) => it.type === 'project' && !it.draft);
  const research = items.filter((it) => it.type === 'research' && !it.draft);
  const studies = items.filter((it) => it.type === 'study' && !it.draft);
  const sortedCareers = [...careers].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (yb !== ya) return yb - ya;
    return b.id - a.id;
  });

  // 가져오기 모달 핸들러
  const openImport = () => {
    setDraftSelected(selected);
    setImportOpen(true);
  };

  const toggleDraft = (key: SectionKey) => {
    setDraftSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const saveImport = () => {
    const ordered = SECTION_ORDER.filter(
      (k) => draftSelected.includes(k) && sectionCount(k) > 0,
    );
    setSelected(ordered);
    try {
      localStorage.setItem(PROFILE_SECTIONS_KEY, JSON.stringify(ordered));
    } catch {
      // 저장 실패 시 무시
    }
    setImportOpen(false);
  };

  const sectionCount = (k: SectionKey) => {
    switch (k) {
      case 'intro':
        return intro.trim() ? 1 : 0;
      case 'experiences':
        return experiences.length;
      case 'careers':
        return careers.length;
      case 'projects':
        return projects.length;
      case 'research':
        return research.length;
      case 'studies':
        return studies.length;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 배너 — 사용자가 색상 선택 가능 */}
      <div className="relative mb-6 overflow-visible">
        <div
          className={`relative h-32 overflow-hidden bg-gradient-to-br ${currentGradient}`}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 bg-white/5" />
          <div className="pointer-events-none absolute -bottom-6 right-16 h-24 w-24 bg-white/5" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
        </div>

        <div className="absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            aria-label="배너 색상 변경"
            aria-expanded={colorPickerOpen}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            색상 변경
          </button>

          {colorPickerOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setColorPickerOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute right-0 top-full z-20 mt-2 w-60 border border-stone-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-stone-700">배너 색상</p>
                <div className="grid grid-cols-4 gap-2">
                  {BANNER_GRADIENTS.map((g) => {
                    const selected = bannerColor === g.key;
                    return (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => changeBannerColor(g.key)}
                        className={`relative aspect-square overflow-hidden bg-gradient-to-br ${g.class} transition-transform hover:scale-105 ${
                          selected ? 'ring-2 ring-offset-2 ring-stone-900' : ''
                        }`}
                        aria-label={g.label}
                        aria-pressed={selected}
                        title={g.label}
                      >
                        {selected && (
                          <span className="absolute inset-0 flex items-center justify-center text-white">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 프로필 요약 */}
        <div className="mb-6 flex items-start gap-6">
          <div className="flex h-31 w-31 items-center justify-center bg-primary-100 text-primary-600">
            <UserIcon className="h-14 w-14" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{user.lastName + user.firstName}</h1>
            </div>
            <p className="text-gray-600">
              {user.university} {user.department}
              {user.grade && (
                <span className="ml-1 text-sm text-gray-400">
                  · {/^\d+$/.test(user.grade) ? `${user.grade}학년` : user.grade}
                </span>
              )}
            </p>

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
            <div className="mt-2 flex flex-wrap gap-1">
              {(user.skills ?? []).map((skill) => (
                <span
                  key={skill}
                  className="bg-blue-50 px-2 py-1 text-xs text-blue-600"
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

      {/* 한 줄 소개 — 링크 블록과 동일한 구조 */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">한 줄 소개</h2>
        {user.bio ? (
          <p className="font-medium whitespace-pre-wrap break-words">{user.bio}</p>
        ) : (
          <p className="text-sm text-gray-500">
            아직 등록된 한 줄 소개가 없습니다.{' '}
            <Link
              href="/profile/edit"
              className="text-blue-600 hover:underline"
            >
              프로필 수정
            </Link>
            에서 추가할 수 있어요.
          </p>
        )}
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
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm shadow-sm transition-all hover:shadow-md ${meta.bg} ${meta.text}`}
                >
                  <PlatformIcon k={key} className="h-4 w-4" />
                  <span className="font-medium">{getDisplayLabel(link, key)}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 포트폴리오 (큰 카테고리) — /portfolio 의 항목들을 가져와서 표시 ─────── */}
      <section className="mb-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
            <p className="mt-1 text-sm text-gray-500">
              포트폴리오에서 항목을 가져와 프로필에 표시할 수 있어요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openImport}
              className="btn-secondary bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700"
            >
              + 가져오기
            </button>
          </div>
        </div>

        {selected.length === 0 ? (
          <button
            type="button"
            onClick={openImport}
            className="card flex w-full flex-col items-center justify-center border-dashed py-12 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
          >
            <span className="mb-2 text-3xl">+</span>
            <p className="text-sm">포트폴리오에서 항목 가져오기</p>
          </button>
        ) : (
          <div className="space-y-4">
            {/* 세그먼트 컨트롤 */}
            <div
              role="tablist"
              aria-label="포트폴리오 섹션"
              className="inline-flex flex-wrap gap-1 bg-gray-100 p-1"
            >
              {SECTION_ORDER.filter((k) => selected.includes(k)).map((k) => {
                const isActive = activeTab === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(k)}
                    className={`px-4 py-1.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {SECTION_META[k].label}
                  </button>
                );
              })}
            </div>

            {/* 활성 탭 컨텐츠 */}
            {selected.includes(activeTab) && activeTab === 'intro' && (
              <div className="card">
                {intro.trim() ? (
                  <p className="font-medium whitespace-pre-wrap break-words">
                    {intro}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">
                    포트폴리오에서 자기소개를 작성해주세요.
                  </p>
                )}
              </div>
            )}

            {selected.includes(activeTab) && activeTab === 'experiences' && (
              <div className="card">
                {experiences.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    포트폴리오에 등록된 실무 경험이 없습니다.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {experiences.map((exp, i) => (
                      <li
                        key={exp.id}
                        className="flex items-start gap-3 border border-gray-100 p-4"
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
                          <p className="mt-0.5 text-sm text-gray-600">
                            {exp.role}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {exp.period}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {selected.includes(activeTab) && activeTab === 'careers' && (
              <div className="card">
                {sortedCareers.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    포트폴리오에 등록된 경력이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {sortedCareers.map((c) => (
                      <li key={c.id} className="flex items-start gap-2">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 bg-blue-500"
                          aria-hidden
                        />
                        <p className="flex-1 text-sm leading-relaxed text-gray-700">
                          <span className="font-semibold text-gray-900">
                            {c.year}년
                          </span>{' '}
                          {c.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selected.includes(activeTab) && activeTab === 'projects' && (
              <SectionCardList
                emptyText="포트폴리오에 등록된 프로젝트가 없습니다."
                items={projects}
              />
            )}

            {selected.includes(activeTab) && activeTab === 'research' && (
              <SectionCardList
                emptyText="포트폴리오에 등록된 연구가 없습니다."
                items={research}
              />
            )}

            {selected.includes(activeTab) && activeTab === 'studies' && (
              <SectionCardList
                emptyText="포트폴리오에 등록된 스터디가 없습니다."
                items={studies}
              />
            )}
          </div>
        )}
      </section>

      {/* ─────── 가져오기 모달 ─────── */}
      {importOpen && (
        <div
          onClick={() => setImportOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-900">
                포트폴리오에서 가져오기
              </h2>
              <button
                onClick={() => setImportOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="mb-4 text-sm text-gray-600">
                프로필에 표시할 항목을 선택해주세요.
              </p>
              <div className="space-y-2">
                {SECTION_ORDER.map((k) => {
                  const meta = SECTION_META[k];
                  const count = sectionCount(k);
                  const disabled = count === 0;
                  const checked = !disabled && draftSelected.includes(k);
                  const countLabel =
                    k === 'intro'
                      ? count
                        ? '작성됨'
                        : '미작성'
                      : `${count}건`;
                  return (
                    <label
                      key={k}
                      className={`flex items-start gap-3 border p-4 transition-all ${
                        disabled
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50/60 opacity-60'
                          : checked
                            ? 'cursor-pointer border-blue-300 bg-blue-50/40'
                            : 'cursor-pointer border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => {
                          if (!disabled) toggleDraft(k);
                        }}
                        className="mt-0.5 h-4 w-4 border-gray-300 disabled:cursor-not-allowed"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {meta.label}
                          </p>
                          <span className="text-xs text-gray-400">
                            {countLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {disabled
                            ? '작성된 항목이 없어 선택할 수 없습니다.'
                            : meta.hint}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveImport}
                className="bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 프로필에 표시되는 프로젝트/연구/스터디 카드 목록 — 동일 레이아웃 재사용 */
function SectionCardList({
  emptyText,
  items,
}: {
  emptyText: string;
  items: PortfolioItem[];
}) {
  return (
    <div className="card">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              <Link
                key={item.id}
                href="/portfolio"
                className="block border border-gray-100 p-3 transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      {item.domain && (
                        <span className="bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                          {item.domain}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {item.period}
                      </span>
                    </div>
                    <h4 className="mb-1 text-sm font-semibold text-gray-900">
                      {item.title}
                    </h4>
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="bg-gray-100 px-2 py-0.5 text-3xs text-gray-600"
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
                    style={{ width: '4rem', height: '4rem' }}
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
