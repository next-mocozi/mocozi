'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type ProfileLink,
} from './_platforms';
import { PortfolioItemView } from '../portfolio/[id]/_PortfolioItemView';
import type { Draft } from '../portfolio/edit/_interview';
import type { ResearchDetail } from '../portfolio/edit/_research';
import type { StudyDetail } from '../portfolio/edit/_study';

const DETAILS_STORAGE_KEY = 'mock_portfolio_details';
const RESEARCH_DETAILS_KEY = 'mock_research_details';
const STUDY_DETAILS_KEY = 'mock_study_details';

const PROFILE_SECTIONS_KEY = 'mock_profile_portfolio_sections';
const PROFILE_PROJECTS_FEATURED_ONLY_KEY = 'mock_profile_projects_featured_only';

type Experience = {
  id: string;
  company: string;
  team: string;
  role: string;
  period: string;
  current: boolean;
};

type CareerItem = {
  id: string;
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
  id: string;
  type: PortfolioItemType;
  title: string;
  description: string;
  period: string;
  current: boolean;
  domain?: string;
  tags: string[];
  thumbnail?: string;
  /** 대표 프로젝트 — /portfolio 페이지의 별 토글로 지정 */
  featured?: boolean;
  /** 미완성 임시저장 — 프로필에는 노출하지 않음 */
  draft?: boolean;
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
  const { user, loading } = useAuth();
  const [links, setLinks] = useState<ProfileLink[]>([]);

  // 직군 — user.roles 첫번째가 메인, 나머지가 서브
  const userRoles = user?.roles ?? [];
  const mainRole = userRoles[0] ?? '';
  const subRoles = userRoles.slice(1);

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

  // 프로젝트 가져올 때 "대표 프로젝트만" 옵션
  const [projectsFeaturedOnly, setProjectsFeaturedOnly] = useState(false);
  const [draftProjectsFeaturedOnly, setDraftProjectsFeaturedOnly] =
    useState(false);

  // 카드 클릭 시 모달로 미리보기 — 디테일 데이터는 localStorage 에서 lazy 로 로드
  const [detailsMap, setDetailsMap] = useState<Record<string, Draft>>({});
  const [researchMap, setResearchMap] = useState<Record<string, ResearchDetail>>(
    {},
  );
  const [studyMap, setStudyMap] = useState<Record<string, StudyDetail>>({});
  const [previewItem, setPreviewItem] = useState<PortfolioItem | null>(null);

  // 세그먼트 컨트롤 — 현재 활성 탭
  const [activeTab, setActiveTab] = useState<SectionKey>(SECTION_ORDER[0]);

  // selected 가 바뀌었을 때 activeTab 이 더 이상 선택돼있지 않으면 첫 번째로 이동
  useEffect(() => {
    if (selected.length > 0 && !selected.includes(activeTab)) {
      setActiveTab(selected[0]);
    }
  }, [selected, activeTab]);

  // 포트폴리오 API에서 모든 데이터 로드
  useEffect(() => {
    if (!user) return;
    api.get('/api/portfolios/me').then((res) => {
      const p = res.data.data ?? res.data;
      setIntro(p.intro ?? '');
      setLinks(
        (p.links ?? []).map((l: { id: string; url: string; label?: string }) => ({
          id: l.id,
          url: l.url,
          label: l.label,
        })),
      );
      setExperiences(
        (p.experiences ?? []).map((e: { id: string; company: string; team?: string; role: string; period: string; current: boolean }) => ({
          id: e.id,
          company: e.company,
          team: e.team ?? '',
          role: e.role,
          period: e.period,
          current: e.current,
        })),
      );
      setCareers(
        (p.careerItems ?? []).map((c: { id: string; year: string; content: string }) => ({
          id: c.id,
          year: c.year,
          content: c.content,
        })),
      );
      setItems(
        (p.items ?? []).filter((it: { draft?: boolean }) => !it.draft).map(
          (it: { id: string; type: string; title: string; description: string; period?: string; current: boolean; domain?: string; tags?: string[]; thumbnail?: string }) => ({
            id: it.id,
            type: it.type.toLowerCase() as PortfolioItemType,
            title: it.title,
            description: it.description,
            period: it.period ?? '',
            current: it.current,
            domain: it.domain,
            tags: it.tags ?? [],
            thumbnail: it.thumbnail,
          }),
        ),
      );
    }).catch(() => { /* API 실패 시 빈 상태 유지 */ });

    // 가져오기 섹션 선택 상태는 localStorage 유지
    try {
      const raw = localStorage.getItem(PROFILE_SECTIONS_KEY);
      if (raw) {
        const savedSections = JSON.parse(raw) as SectionKey[];
        setSelected(savedSections);
        setDraftSelected(savedSections);
      }
    } catch { /* 무시 */ }
  }, [user]);

  // localStorage 기반 추가 상태 (대표 프로젝트만 옵션 + 카드 클릭 시 모달용 디테일 맵)
  useEffect(() => {
    const loadJson = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    const savedFeaturedOnly = loadJson<boolean | null>(
      PROFILE_PROJECTS_FEATURED_ONLY_KEY,
      null,
    );
    if (savedFeaturedOnly !== null) {
      setProjectsFeaturedOnly(savedFeaturedOnly);
      setDraftProjectsFeaturedOnly(savedFeaturedOnly);
    }
    setDetailsMap(loadJson(DETAILS_STORAGE_KEY, {} as Record<string, Draft>));
    setResearchMap(
      loadJson(RESEARCH_DETAILS_KEY, {} as Record<string, ResearchDetail>),
    );
    setStudyMap(
      loadJson(STUDY_DETAILS_KEY, {} as Record<string, StudyDetail>),
    );
  }, []);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        로딩 중...
      </div>
    );
  if (!user) return null;

  // 타입별로 분리 — 임시저장은 모두 제외
  const allProjects = items.filter((it) => it.type === 'project' && !it.draft);
  const projects = projectsFeaturedOnly
    ? allProjects.filter((it) => it.featured)
    : allProjects;
  const research = items.filter((it) => it.type === 'research' && !it.draft);
  const studies = items.filter((it) => it.type === 'study' && !it.draft);
  const sortedCareers = [...careers].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    return yb - ya;
  });

  // 가져오기 모달 핸들러
  const openImport = () => {
    setDraftSelected(selected);
    setDraftProjectsFeaturedOnly(projectsFeaturedOnly);
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
    setProjectsFeaturedOnly(draftProjectsFeaturedOnly);
    try {
      localStorage.setItem(PROFILE_SECTIONS_KEY, JSON.stringify(ordered));
      localStorage.setItem(
        PROFILE_PROJECTS_FEATURED_ONLY_KEY,
        JSON.stringify(draftProjectsFeaturedOnly),
      );
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
        return allProjects.length;
      case 'research':
        return research.length;
      case 'studies':
        return studies.length;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* 프로필 요약 */}
        <div className="mb-6 flex items-start gap-6">
          <div className="flex h-31 w-31 items-center justify-center rounded-full bg-primary-100 text-4xl text-primary-600">
            👤
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{user.name}</h1>
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
                  <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1 text-xs leading-none text-white">
                    {mainRole}
                  </span>
                )}
                {subRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center justify-center rounded-full border border-blue-200 px-3 py-1 text-xs leading-none text-blue-600"
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
            <Link
              href="/portfolio"
              className="text-xs text-gray-500 hover:text-blue-600"
            >
              포트폴리오 편집 →
            </Link>
            <button
              type="button"
              onClick={openImport}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700"
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
              className="inline-flex flex-wrap gap-1 rounded-full bg-gray-100 p-1"
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
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
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
                        className="flex items-start gap-3 rounded-xl border border-gray-100 p-4"
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
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
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
                onSelect={setPreviewItem}
              />
            )}

            {selected.includes(activeTab) && activeTab === 'research' && (
              <SectionCardList
                emptyText="포트폴리오에 등록된 연구가 없습니다."
                items={research}
                onSelect={setPreviewItem}
              />
            )}

            {selected.includes(activeTab) && activeTab === 'studies' && (
              <SectionCardList
                emptyText="포트폴리오에 등록된 스터디가 없습니다."
                items={studies}
                onSelect={setPreviewItem}
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
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
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
                  const featuredProjectCount =
                    k === 'projects'
                      ? allProjects.filter((it) => it.featured).length
                      : 0;
                  const showProjectsSub = k === 'projects' && checked;
                  const featuredOnlyDisabled =
                    k === 'projects' && featuredProjectCount === 0;
                  return (
                    <div key={k}>
                      <label
                        className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
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
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed"
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

                      {showProjectsSub && (
                        <label
                          className={`mt-1 ml-7 flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
                            featuredOnlyDisabled
                              ? 'cursor-not-allowed text-gray-400 opacity-60'
                              : 'cursor-pointer text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              !featuredOnlyDisabled && draftProjectsFeaturedOnly
                            }
                            disabled={featuredOnlyDisabled}
                            onChange={(e) =>
                              setDraftProjectsFeaturedOnly(e.target.checked)
                            }
                            className="h-3.5 w-3.5 rounded border-gray-300 disabled:cursor-not-allowed"
                          />
                          <span>대표 프로젝트만 가져오기</span>
                          <span className="text-gray-400">
                            ({featuredProjectCount}건)
                          </span>
                          {featuredOnlyDisabled && (
                            <span className="text-gray-400">
                              · 대표로 지정된 프로젝트가 없어요
                            </span>
                          )}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveImport}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── 포트폴리오 항목 미리보기 모달 ─────── */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl"
            style={{ maxHeight: 'calc(100vh - 4rem)' }}
          >
            {/* 헤더: 닫기 버튼 — 스크롤 영역 밖에 두어 스크롤바를 가리지 않도록 함 */}
            <div className="flex shrink-0 items-center justify-end border-b border-gray-100 px-3 py-2">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="닫기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto">
              <PortfolioItemView
                item={previewItem}
                details={detailsMap[String(previewItem.id)] ?? null}
                research={researchMap[String(previewItem.id)] ?? null}
                study={studyMap[String(previewItem.id)] ?? null}
                wrapper="plain"
              />
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
  onSelect,
}: {
  emptyText: string;
  items: PortfolioItem[];
  onSelect?: (item: PortfolioItem) => void;
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
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect?.(item)}
                className="block w-full text-left rounded-xl border border-gray-100 p-3 transition-all hover:border-blue-200 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                      {item.domain && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
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
                            className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.thumbnail && (
                    <div
                      className="shrink-0 overflow-hidden rounded-lg border border-gray-200"
                      style={{ width: '4rem', height: '4rem' }}
                      aria-hidden
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
