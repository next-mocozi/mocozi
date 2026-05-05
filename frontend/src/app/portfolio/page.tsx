'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  PlatformIcon,
  PLATFORM_META,
  detectPlatform,
  getDisplayLabel,
  type ProfileLink,
} from './_platforms';

// TODO: 백엔드 연동 — `GET /api/users/me`, `GET /api/users/me/links`,
//       `GET /api/portfolios/me` 로 교체 (CLAUDE.md §11).
//       기본 정보(이름/학교/학과/링크)는 프로필 데이터를 그대로 표시(이 탭에선 수정 X).
//       자기소개/실무 경험/경력/포트폴리오는 이 탭에서 직접 편집 (각 섹션 "+ 추가"
//       모달 내부에서 추가/수정/삭제 모두 처리).

const LINKS_STORAGE_KEY = 'mock_profile_links'; // profile 페이지와 공유
const ROLES_STORAGE_KEY = 'mock_profile_roles'; // profile 페이지와 공유 (mainRole + subRoles)
const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const INTRO_STORAGE_KEY = 'mock_portfolio_intro';
const CAREERS_STORAGE_KEY = 'mock_portfolio_career_items';
const EXPS_STORAGE_KEY = 'mock_portfolio_experiences';
const INTRO_MAX = 500;
const CAREER_CONTENT_MAX = 200;

export type PortfolioItemType =
  | 'project'
  | 'research'
  | 'study'
  | 'activity'
  | 'etc';

export type PortfolioItem = {
  id: number;
  type: PortfolioItemType;
  title: string;
  description: string;
  period: string;
  current: boolean;
  domain?: string;
  tags: string[];
  /** 대표 프로젝트 (최대 4개). 정렬 시 맨 앞으로. */
  featured?: boolean;
  /** 카드/미리보기 우측에 표시할 대표 이미지 (data URL) */
  thumbnail?: string;
  /** 미완성 임시저장 — true 면 메인 목록 대신 "임시저장" 탭에 노출 */
  draft?: boolean;
  /** 연구 항목용 — 논문 URL (카드에서 바로 이동) */
  paperUrl?: string;
};

/** 대표 프로젝트 최대 개수 */
export const MAX_FEATURED = 4;

/** "2024.03 - 2024.06" / "2024.03.15 - 현재" 같은 문자열에서 시작일을
 *  YYYYMMDD 정수로 변환 (정렬용). 일이 없으면 1일로 보정. 파싱 실패 시 0. */
export function parseStartDateNum(period: string): number {
  const m = period.match(/^\s*(\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?/);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] ? Number(m[3]) : 1;
  return y * 10000 + mo * 100 + d;
}

/** 대표 프로젝트 → 그 외, 각 그룹 내부에선 시작일 내림차순(최신이 위) */
export function sortPortfolioItems(items: PortfolioItem[]): PortfolioItem[] {
  const byStartDesc = (a: PortfolioItem, b: PortfolioItem) =>
    parseStartDateNum(b.period) - parseStartDateNum(a.period) || b.id - a.id;
  const featured = items.filter((it) => it.featured).sort(byStartDesc);
  const others = items.filter((it) => !it.featured).sort(byStartDesc);
  return [...featured, ...others];
}

export const TYPE_META: Record<
  PortfolioItemType,
  { label: string; bg: string; text: string }
> = {
  project: { label: '프로젝트', bg: 'bg-purple-100', text: 'text-purple-700' },
  research: { label: '연구', bg: 'bg-blue-100', text: 'text-blue-700' },
  study: { label: '스터디', bg: 'bg-amber-100', text: 'text-amber-700' },
  activity: { label: '활동', bg: 'bg-green-100', text: 'text-green-700' },
  etc: { label: '기타', bg: 'bg-gray-100', text: 'text-gray-700' },
};

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

// ──────── Mock 데이터 (백엔드 연동 시 교체) ────────

const MOCK_PROFILE = {
  name: '홍길동',
  university: 'OO대학교',
  department: '컴퓨터공학과',
};

const DEFAULT_INTRO =
  '풀스택 개발에 관심이 많은 대학생입니다. 0→1 단계의 제품을 직접 설계·구현하는 걸 좋아하고, 사용자 가까이에서 빠르게 학습하며 성장하는 환경을 선호합니다.';

const DEFAULT_CAREERS: CareerItem[] = [
  { id: 1, year: '2024', content: 'xxxx 해커톤 은상 수상' },
  { id: 2, year: '2023', content: '0000 부트캠프 참여' },
];

const DEFAULT_LINKS: ProfileLink[] = [
  { id: 1, url: 'https://github.com/honggildong' },
  { id: 2, url: 'https://linkedin.com/in/honggildong' },
  { id: 3, url: 'https://honggildong.notion.site' },
];

const DEFAULT_EXPS: Experience[] = [
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
];

const DEFAULT_ITEMS: PortfolioItem[] = [
  {
    id: 1,
    type: 'project',
    title: '웹 포트폴리오 사이트',
    description: '개인 포트폴리오 웹사이트를 제작했습니다.',
    period: '2024.01 - 2024.03',
    current: false,
    domain: '웹',
    tags: ['Next.js', 'Tailwind'],
  },
  {
    id: 2,
    type: 'study',
    title: '알고리즘 스터디',
    description: '주 1회 모각코, 백준 골드 문제 풀이.',
    period: '2024.05 - 현재',
    current: true,
    domain: 'CS',
    tags: ['Python', 'Algorithm'],
  },
];

type ExpFormState = {
  company: string;
  team: string;
  role: string;
  startDate: string; // YYYY-MM (HTML <input type="month">)
  endDate: string; // YYYY-MM
  current: boolean;
};

const EMPTY_EXP_FORM: ExpFormState = {
  company: '',
  team: '',
  role: '',
  startDate: '',
  endDate: '',
  current: false,
};

// "2026.03 - 현재" / "2025.07 - 2025.08" 같은 문자열을 month-input 값으로 분해
function parsePeriod(period: string): {
  startDate: string;
  endDate: string;
  current: boolean;
} {
  const m = period.match(
    /^\s*(\d{4})\.(\d{1,2})\s*-\s*(현재|(\d{4})\.(\d{1,2}))\s*$/,
  );
  if (!m) return { startDate: '', endDate: '', current: false };
  const startDate = `${m[1]}-${m[2].padStart(2, '0')}`;
  if (m[3] === '현재') return { startDate, endDate: '', current: true };
  const endDate = `${m[4]}-${m[5]!.padStart(2, '0')}`;
  return { startDate, endDate, current: false };
}

function formatPeriod(
  startDate: string,
  endDate: string,
  current: boolean,
): string {
  if (!startDate) return '';
  const [sy, sm] = startDate.split('-');
  const start = `${sy}.${sm}`;
  if (current) return `${start} - 현재`;
  if (!endDate) return start;
  const [ey, em] = endDate.split('-');
  return `${start} - ${ey}.${em}`;
}

const EMPTY_CAREER_FORM: Omit<CareerItem, 'id'> = {
  year: '',
  content: '',
};

// 실무 경험 기간 — 년/월 드롭다운 옵션
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: 32 },
  (_, i) => CURRENT_YEAR + 1 - i, // 최신 연도가 위
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** YYYY-MM 값을 년/월 두 개의 select 로 입력받는 컴포넌트 */
function YearMonthPicker({
  value,
  onChange,
  disabled,
}: {
  value: string; // 'YYYY-MM' 또는 ''
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [year, setYear] = useState(value ? value.split('-')[0] : '');
  const [month, setMonth] = useState(value ? value.split('-')[1] : '');

  // 외부에서 value 가 바뀌면 (예: 항목 수정으로 폼 로드) 내부 선택 동기화
  useEffect(() => {
    setYear(value ? value.split('-')[0] : '');
    setMonth(value ? value.split('-')[1] : '');
  }, [value]);

  const emit = (y: string, m: string) => onChange(y && m ? `${y}-${m}` : '');

  const selectClass =
    'rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';

  return (
    <div className="inline-flex gap-1.5">
      <select
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          emit(e.target.value, month);
        }}
        disabled={disabled}
        aria-label="년"
        className={selectClass}
      >
        <option value="">년</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={String(y)}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => {
          setMonth(e.target.value);
          emit(year, e.target.value);
        }}
        disabled={disabled}
        aria-label="월"
        className={selectClass}
      >
        <option value="">월</option>
        {MONTH_OPTIONS.map((m) => (
          <option key={m} value={String(m).padStart(2, '0')}>
            {m}월
          </option>
        ))}
      </select>
    </div>
  );
}

/** 내 포트폴리오 — 이력서형 페이지 (각 섹션 "+ 추가" 모달에서 통합 관리) */
export default function MyPortfolioPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [links, setLinks] = useState<ProfileLink[]>(DEFAULT_LINKS);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  const [items, setItems] = useState<PortfolioItem[]>(DEFAULT_ITEMS);
  const [experiences, setExperiences] = useState<Experience[]>(DEFAULT_EXPS);
  const [careers, setCareers] = useState<CareerItem[]>(DEFAULT_CAREERS);

  // 직군 (profile/edit 에서 localStorage 에 저장)
  const [mainRole, setMainRole] = useState('');
  const [subRoles, setSubRoles] = useState<string[]>([]);

  // 자기소개 — draft / saved 분리 (저장 버튼 패턴)
  const [introSaved, setIntroSaved] = useState(DEFAULT_INTRO);
  const [introDraft, setIntroDraft] = useState(DEFAULT_INTRO);
  const [introJustSaved, setIntroJustSaved] = useState(false);
  const introRef = useRef<HTMLTextAreaElement>(null);

  // 자기소개 textarea — 내용에 따라 세로로 자동 확장
  useEffect(() => {
    const el = introRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [introDraft]);

  // 실무 경험 모달 (폼 + 리스트 통합)
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expEditId, setExpEditId] = useState<number | null>(null);
  const [expForm, setExpForm] = useState<ExpFormState>(EMPTY_EXP_FORM);
  const [expError, setExpError] = useState('');

  // 경력 모달 (폼 + 리스트 통합)
  const [careerModalOpen, setCareerModalOpen] = useState(false);
  const [careerEditId, setCareerEditId] = useState<number | null>(null);
  const [careerForm, setCareerForm] =
    useState<Omit<CareerItem, 'id'>>(EMPTY_CAREER_FORM);
  const [careerError, setCareerError] = useState('');

  // 포트폴리오 / 연구 / 스터디 관리 모달
  const [portfolioMgrOpen, setPortfolioMgrOpen] = useState(false);
  const [researchMgrOpen, setResearchMgrOpen] = useState(false);
  const [studyMgrOpen, setStudyMgrOpen] = useState(false);

  useEffect(() => {
    const load = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    setLinks(load(LINKS_STORAGE_KEY, DEFAULT_LINKS));
    setItems(load(ITEMS_STORAGE_KEY, DEFAULT_ITEMS));
    setExperiences(load(EXPS_STORAGE_KEY, DEFAULT_EXPS));
    setCareers(load(CAREERS_STORAGE_KEY, DEFAULT_CAREERS));
    const roles = load<{ mainRole: string; subRoles: string[] } | null>(
      ROLES_STORAGE_KEY,
      null,
    );
    if (roles) {
      setMainRole(roles.mainRole);
      setSubRoles(roles.subRoles);
    }
    try {
      const i = localStorage.getItem(INTRO_STORAGE_KEY);
      if (i !== null) {
        setIntroSaved(i);
        setIntroDraft(i);
      }
    } catch {
      // 기본값 유지
    }
  }, []);

  // 로그인 가드 — 모든 훅 호출 이후에 위치
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        로딩 중...
      </div>
    );
  if (!user) return null;

  const persist = (key: string, value: unknown) => {
    try {
      localStorage.setItem(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    } catch {
      // 저장 실패 시 무시
    }
  };

  // ───────── 자기소개 ─────────
  const introDirty = introDraft !== introSaved;

  const handleIntroChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value.slice(0, INTRO_MAX);
    setIntroDraft(v);
    if (introJustSaved) setIntroJustSaved(false);
  };

  const saveIntro = () => {
    if (!introDirty) return;
    setIntroSaved(introDraft);
    persist(INTRO_STORAGE_KEY, introDraft);
    setIntroJustSaved(true);
    setTimeout(() => setIntroJustSaved(false), 2000);
  };

  const resetIntro = () => setIntroDraft(introSaved);

  // ───────── 실무 경험 ─────────
  const openExpModal = () => {
    setExpEditId(null);
    setExpForm(EMPTY_EXP_FORM);
    setExpError('');
    setExpModalOpen(true);
  };

  const loadExpToForm = (exp: Experience) => {
    setExpEditId(exp.id);
    const parsed = parsePeriod(exp.period);
    setExpForm({
      company: exp.company,
      team: exp.team,
      role: exp.role,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      current: exp.current || parsed.current,
    });
    setExpError('');
  };

  const resetExpForm = () => {
    setExpEditId(null);
    setExpForm(EMPTY_EXP_FORM);
    setExpError('');
  };

  const saveExp = () => {
    if (!expForm.company.trim()) {
      setExpError('회사명을 입력해주세요.');
      return;
    }
    if (!expForm.startDate) {
      setExpError('시작 월을 선택해주세요.');
      return;
    }
    if (!expForm.current && !expForm.endDate) {
      setExpError('종료 월을 선택하거나 "재직중"을 체크해주세요.');
      return;
    }
    if (
      !expForm.current &&
      expForm.endDate &&
      expForm.endDate < expForm.startDate
    ) {
      setExpError('종료 월은 시작 월 이후여야 합니다.');
      return;
    }
    const period = formatPeriod(
      expForm.startDate,
      expForm.endDate,
      expForm.current,
    );
    const payload: Omit<Experience, 'id'> = {
      company: expForm.company,
      team: expForm.team,
      role: expForm.role,
      period,
      current: expForm.current,
    };
    const next: Experience[] =
      expEditId === null
        ? [...experiences, { id: Date.now(), ...payload }]
        : experiences.map((e) =>
            e.id === expEditId ? { id: e.id, ...payload } : e,
          );
    setExperiences(next);
    persist(EXPS_STORAGE_KEY, next);
    resetExpForm(); // 모달은 열린 상태 유지 → 리스트에서 결과 확인
  };

  const deleteExp = (id: number) => {
    if (!confirm('이 항목을 삭제하시겠어요?')) return;
    const next = experiences.filter((e) => e.id !== id);
    setExperiences(next);
    persist(EXPS_STORAGE_KEY, next);
    if (expEditId === id) resetExpForm();
  };

  // ───────── 경력 ─────────
  const openCareerModal = () => {
    setCareerEditId(null);
    setCareerForm(EMPTY_CAREER_FORM);
    setCareerError('');
    setCareerModalOpen(true);
  };

  const loadCareerToForm = (c: CareerItem) => {
    setCareerEditId(c.id);
    setCareerForm({ year: c.year, content: c.content });
    setCareerError('');
  };

  const resetCareerForm = () => {
    setCareerEditId(null);
    setCareerForm(EMPTY_CAREER_FORM);
    setCareerError('');
  };

  const saveCareer = () => {
    const year = careerForm.year.trim();
    const content = careerForm.content.trim();
    if (!year) {
      setCareerError('연도를 입력해주세요.');
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      setCareerError('연도는 4자리 숫자여야 합니다. (예: 2024)');
      return;
    }
    if (!content) {
      setCareerError('내용을 입력해주세요.');
      return;
    }
    const next: CareerItem[] =
      careerEditId === null
        ? [...careers, { id: Date.now(), year, content }]
        : careers.map((c) =>
            c.id === careerEditId ? { id: c.id, year, content } : c,
          );
    setCareers(next);
    persist(CAREERS_STORAGE_KEY, next);
    resetCareerForm();
  };

  const deleteCareer = (id: number) => {
    if (!confirm('이 항목을 삭제하시겠어요?')) return;
    const next = careers.filter((c) => c.id !== id);
    setCareers(next);
    persist(CAREERS_STORAGE_KEY, next);
    if (careerEditId === id) resetCareerForm();
  };

  // ───────── 포트폴리오/스터디 항목 (편집은 /portfolio/edit 페이지) ─────────
  const deleteItem = (id: number) => {
    if (!confirm('이 항목을 삭제하시겠어요?')) return;
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    persist(ITEMS_STORAGE_KEY, next);
  };

  // 연도 내림차순 정렬 (최신이 위)
  const sortedCareers = [...careers].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (yb !== ya) return yb - ya;
    return b.id - a.id;
  });

  // 임시저장(draft) 항목은 포트폴리오 탭에 노출하지 않음
  // (인터뷰 페이지의 "임시저장 목록" 버튼/팝업에서만 접근)
  const portfolioItems = sortPortfolioItems(
    items.filter(
      (it) => it.type !== 'study' && it.type !== 'research' && !it.draft,
    ),
  );
  const researchItems = items.filter(
    (it) => it.type === 'research' && !it.draft,
  );
  const studyItems = items.filter((it) => it.type === 'study' && !it.draft);
  const featuredCount = portfolioItems.filter((it) => it.featured).length;

  /** 대표 프로젝트 토글 — 최대 MAX_FEATURED 개 제한 */
  const toggleFeatured = (id: number) => {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    const willBeFeatured = !target.featured;
    if (willBeFeatured && featuredCount >= MAX_FEATURED) {
      alert(
        `대표 프로젝트는 최대 ${MAX_FEATURED}개까지만 지정할 수 있어요.`,
      );
      return;
    }
    const next = items.map((it) =>
      it.id === id ? { ...it, featured: willBeFeatured } : it,
    );
    setItems(next);
    persist(ITEMS_STORAGE_KEY, next);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* ─────── 기본 정보 — /profile 페이지와 동일 (수정 버튼 없음) ─────── */}
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
              {user.grade && (
                <span className="ml-1 text-sm text-gray-400">
                  · {/^\d+$/.test(user.grade) ? `${user.grade}학년` : user.grade}
                </span>
              )}
            </p>
            {user.bio && (
              <p className="mt-2 text-sm text-gray-500">{user.bio}</p>
            )}

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
        </div>
      </div>

      {/* ─────── 링크 — /profile 페이지와 동일 ─────── */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">링크</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 등록된 링크가 없습니다.{' '}
            <Link href="/profile/edit" className="text-blue-600 hover:underline">
              프로필 수정
            </Link>
            에서 추가할 수 있어요.
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
                  <span className="font-medium">
                    {getDisplayLabel(link, key)}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 자기소개 (저장 버튼 패턴) ─────── */}
      <div className="card mb-6">
        <div className="px-1 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">자기소개</h2>
            <span
              className={`text-xs ${
                introDraft.length >= INTRO_MAX
                  ? 'text-red-500'
                  : introDraft.length >= INTRO_MAX * 0.9
                    ? 'text-amber-500'
                    : 'text-gray-400'
              }`}
            >
              {introDraft.length} / {INTRO_MAX}
            </span>
          </div>
          <button
            type="button"
            onClick={saveIntro}
            disabled={!introDirty}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            저장
          </button>
        </div>
        <textarea
          ref={introRef}
          value={introDraft}
          onChange={handleIntroChange}
          maxLength={INTRO_MAX}
          rows={2}
          placeholder="포트폴리오 상단에 노출될 자기소개를 작성해주세요. (최대 500자)"
          className="block w-full resize-none overflow-hidden rounded-lg border border-gray-200 px-4 py-3 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          {introJustSaved && !introDirty && (
            <span className="text-xs text-green-600">저장되었습니다.</span>
          )}
          {introDirty && (
            <span className="text-xs text-amber-500">
              저장되지 않은 변경사항이 있어요.
            </span>
          )}
        </div>
      </div>

      {/* ─────── 실무 경험(왼쪽) ↔ 경력(오른쪽) ─────── */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* 실무 경험 & 이력 — 보기 전용, 편집은 모달 */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">실무 경험 & 이력</h2>
            <button
              type="button"
              onClick={openExpModal}
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
            >
              + 추가
            </button>
          </div>
          {experiences.length === 0 ? (
            <p className="text-sm text-gray-500">
              아직 등록된 실무 경험이 없습니다.
            </p>
          ) : (
            <ol className="space-y-3">
              {experiences.map((exp, i) => (
                <li
                  key={exp.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
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

        {/* 경력 — 보기 전용 불렛 리스트, 편집은 모달 */}
        <div className="card">
          <div className=" mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">대외 경험</h2>
            <button
              type="button"
              onClick={openCareerModal}
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700"
            >
              + 추가
            </button>
          </div>
          {sortedCareers.length === 0 ? (
            <p className="text-sm text-gray-500">
              아직 등록된 경력이 없습니다. 수상·자격증·활동 등을 추가해보세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedCareers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                >
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
      </div>

      {/* ─────── 포트폴리오 — 보기 전용 카드, 편집은 관리 모달 ─────── */}
      <div className="mb-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">프로젝트</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              <span className="mr-0.5 text-amber-400">★</span>
              표시로 대표 프로젝트를 최대 {MAX_FEATURED}개까지 지정할 수
              있어요. 대표 프로젝트는 목록 맨 앞에 노출됩니다.{' '}
              <span className="font-medium text-gray-700">
                ({featuredCount}/{MAX_FEATURED})
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPortfolioMgrOpen(true)}
            className="btn-primary shrink-0 text-sm"
          >
            + 추가 / 관리
          </button>
        </div>

        {portfolioItems.length === 0 ? (
          <button
            type="button"
            onClick={() => setPortfolioMgrOpen(true)}
            className="card flex w-full items-center justify-center border-dashed py-8 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
          >
            <div>
              <div className="mb-2 text-3xl">+</div>
              <p className="text-sm">새 프로젝트 항목 추가</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {portfolioItems.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/portfolio/${item.id}`}
                  className="card relative block transition-all hover:shadow-md"
                >
                  {/* 대표 프로젝트 즐겨찾기 (별) — Link 안이므로 navigate 방지 */}
                  <FeaturedStar
                    featured={!!item.featured}
                    onToggle={() => toggleFeatured(item.id)}
                  />
                  <div className="flex gap-3">
                    {/* 좌측: 카드 콘텐츠 */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2 pr-8">
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
                        <span className="text-xs text-gray-500">{item.period}</span>
                        {item.current && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            진행중
                          </span>
                        )}
                      </div>
                      <h3 className="mb-2 font-semibold">{item.title}</h3>
                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 우측: 썸네일 (없으면 백지) */}
                    <div
                      className={`shrink-0 overflow-hidden rounded-lg border ${
                        item.thumbnail ? 'border-gray-200' : 'border-dashed border-gray-200 bg-gray-50'
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
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 연구 — 프로젝트와 동일한 직사각형 카드 ─────── */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">연구</h2>
          <button
            type="button"
            onClick={() => setResearchMgrOpen(true)}
            className="btn-primary shrink-0 text-sm"
          >
            + 추가 / 관리
          </button>
        </div>
        {researchItems.length === 0 ? (
          <button
            type="button"
            onClick={() => setResearchMgrOpen(true)}
            className="card flex w-full items-center justify-center border-dashed py-8 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
          >
            <div>
              <div className="mb-2 text-3xl">+</div>
              <p className="text-sm">새 연구 항목 추가</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {researchItems.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/portfolio/${item.id}`}
                  className="card relative block transition-all hover:shadow-md"
                >
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
                    <span className="text-xs text-gray-500">{item.period}</span>
                    {item.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        진행중
                      </span>
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  {item.paperUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(
                          item.paperUrl,
                          '_blank',
                          'noopener,noreferrer',
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
                    >
                      📄 논문 →
                    </button>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 스터디 — 프로젝트와 동일한 직사각형 카드 ─────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">스터디</h2>
          <button
            type="button"
            onClick={() => setStudyMgrOpen(true)}
            className="btn-primary shrink-0 text-sm"
          >
            + 추가 / 관리
          </button>
        </div>

        {studyItems.length === 0 ? (
          <button
            type="button"
            onClick={() => setStudyMgrOpen(true)}
            className="card flex w-full items-center justify-center border-dashed py-8 text-center text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
          >
            <div>
              <div className="mb-2 text-3xl">+</div>
              <p className="text-sm">새 스터디 항목 추가</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {studyItems.map((item) => {
              const meta = TYPE_META[item.type];
              return (
                <Link
                  key={item.id}
                  href={`/portfolio/${item.id}`}
                  className="card relative block transition-all hover:shadow-md"
                >
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
                    <span className="text-xs text-gray-500">{item.period}</span>
                    {item.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        진행중
                      </span>
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────── 실무 경험 모달 (폼 + 리스트) ─────── */}
      {expModalOpen && (
        <div
          onClick={() => setExpModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <h2 className="text-lg font-bold px-1 py-2 text-gray-900">
                실무 경험 & 이력
              </h2>
              <button
                onClick={() => setExpModalOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 pt-2">
              {/* 폼 섹션 */}
              <section className="mb-1 pt-1">
                <div className="mb-1 flex items-center justify-between py-1">
                  <h3 className="text-base font-bold text-gray-900">
                    {expEditId === null ? '새 항목 추가' : '항목 수정 중'}
                  </h3>
                  <div className="flex gap-3">
                    {expEditId !== null && (
                      <button
                        type="button"
                        onClick={resetExpForm}
                        className="rounded-full border border-gray-200 px-5 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        편집 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveExp}
                      className="rounded-full bg-blue-600 px-5 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      {expEditId === null ? '추가' : '수정 저장'}
                    </button>
                  </div>
                </div>
                                
                  <div className="space-y-2 rounded-xl bg-gray-50/70 p-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        회사명
                      </label>
                      <input
                        type="text"
                        value={expForm.company}
                        onChange={(e) => {
                          setExpForm((f) => ({ ...f, company: e.target.value }));
                          if (expError) setExpError('');
                        }}
                        placeholder="예: OpenAI Korea"
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
                          expError
                            ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : 'border-gray-200 focus:border-blue-400 focus:ring-blue-100'
                        }`}
                      />
                      {expError && (
                        <p className="mt-1 text-xs text-red-500">{expError}</p>
                      )}
                    </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          팀 / 부서{' '}
                          <span className="text-xs font-normal text-gray-500">(선택)</span>
                        </label>
                        <input
                          type="text"
                          value={expForm.team}
                          onChange={(e) => setExpForm((f) => ({ ...f, team: e.target.value }))}
                          placeholder="예: 연구팀"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">역할</label>
                        <input
                          type="text"
                          value={expForm.role}
                          onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))}
                          placeholder="예: 리서치 인턴"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
</div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        기간
                      </label>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <YearMonthPicker
                          value={expForm.startDate}
                          onChange={(v) => {
                            setExpForm((f) => ({ ...f, startDate: v }));
                            if (expError) setExpError('');
                          }}
                        />
                        <span className="text-sm text-gray-400">~</span>
                        <YearMonthPicker
                          value={expForm.current ? '' : expForm.endDate}
                          onChange={(v) => {
                            setExpForm((f) => ({ ...f, endDate: v }));
                            if (expError) setExpError('');
                          }}
                          disabled={expForm.current}
                        />
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={expForm.current}
                            onChange={(e) =>
                              setExpForm((f) => ({
                                ...f,
                                current: e.target.checked,
                                endDate: e.target.checked ? '' : f.endDate,
                              }))
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          재직중
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">


                </div>
              </section>

              {/* 리스트 섹션 */}
              <section className="border-t border-gray-200 pt-2">
                <h3 className="px-1 py-3 flex items-center gap-2 text-base font-bold text-gray-900">
                  <span className="h-4 w-1 rounded-full bg-gray-400" />
                  등록된 항목
                  <span className="text-xs font-normal text-gray-500">
                    ({experiences.length})
                  </span>
                </h3>
                {experiences.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    아직 등록된 항목이 없습니다.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {experiences.map((exp) => {
                      const editing = expEditId === exp.id;
                      return (
                        <li
                          key={exp.id}
                          className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${
                            editing
                              ? 'border-blue-300 bg-blue-50/40'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                {exp.company} {exp.team}
                              </p>
                              {exp.current && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                  재직중
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-gray-600">
                              {exp.role}
                            </p>
                            <p className="mt-1.5 text-xs text-gray-500">
                              {exp.period}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => loadExpToForm(exp)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-blue-600"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExp(exp.id)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            <div className="border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => setExpModalOpen(false)}
                className="w-full rounded-full bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── 경력 모달 (폼 + 리스트) ─────── */}
      {careerModalOpen && (
        <div
          onClick={() => setCareerModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <h2 className="text-lg font-bold px-1 py-2 text-gray-900">
                경력
              </h2>
              <button
                onClick={() => setCareerModalOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4 pt-2">
              {/* 폼 섹션 */}
              <section className="mb-1 pt-1">
                <div className="mb-1 flex items-center justify-between py-1">
                  <h3 className="text-base font-bold text-gray-900">
                    {careerEditId === null ? '새 항목 추가' : '항목 수정 중'}
                  </h3>
                  <div className="flex gap-3">
                    {careerEditId !== null && (
                      <button
                        type="button"
                        onClick={resetCareerForm}
                        className="rounded-full border border-gray-200 px-5 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      >
                        편집 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={saveCareer}
                      className="rounded-full bg-blue-600 px-5 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                    >
                      {careerEditId === null ? '추가' : '수정 저장'}
                    </button>
                  </div>
                </div>
                <p className="mb-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  예시:{' '}
                  <span className="font-medium">
                    2024년 xxxx 해커톤 은상 수상
                  </span>
                  ,{' '}
                  <span className="font-medium">2023년 0000 부트캠프 참여</span>
                </p>

                <div className="space-y-2 rounded-xl bg-gray-50/70 p-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      연도
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={careerForm.year}
                      onChange={(e) => {
                        setCareerForm((f) => ({
                          ...f,
                          year: e.target.value
                            .replace(/[^0-9]/g, '')
                            .slice(0, 4),
                        }));
                        if (careerError) setCareerError('');
                      }}
                      placeholder="예: 2024"
                      maxLength={4}
                      className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">내용</label>
                      <p className="text-xs text-gray-500">
                        {careerForm.content.length} / {CAREER_CONTENT_MAX}
                      </p>
                    </div>
                    <input
                      type="text"
                      value={careerForm.content}
                      onChange={(e) => {
                        setCareerForm((f) => ({
                          ...f,
                          content: e.target.value.slice(0, CAREER_CONTENT_MAX),
                        }));
                        if (careerError) setCareerError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveCareer();
                      }}
                      placeholder="예: xxxx 해커톤 은상 수상"
                      maxLength={CAREER_CONTENT_MAX}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {careerError && (
                    <p className="text-xs text-red-500">{careerError}</p>
                  )}
                </div>
              </section>

              {/* 리스트 섹션 */}
              <section className="border-t border-gray-200 pt-2">
                <h3 className="px-1 py-3 flex items-center gap-2 text-base font-bold text-gray-900">
                  <span className="h-4 w-1 rounded-full bg-gray-400" />
                  등록된 항목
                  <span className="text-xs font-normal text-gray-500">
                    ({sortedCareers.length})
                  </span>
                </h3>
                {sortedCareers.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    아직 등록된 항목이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {sortedCareers.map((c) => {
                      const editing = careerEditId === c.id;
                      return (
                        <li
                          key={c.id}
                          className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${
                            editing
                              ? 'border-blue-300 bg-blue-50/40'
                              : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
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
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => loadCareerToForm(c)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-blue-600"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCareer(c.id)}
                              className="rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-white hover:text-red-500"
                            >
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => setCareerModalOpen(false)}
                className="w-full rounded-full bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────── 프로젝트 관리 모달 ─────── */}
      {portfolioMgrOpen && (
        <ItemMgrModal
          title="프로젝트 관리"
          items={portfolioItems}
          addLabel="+ 새 프로젝트 항목 추가"
          addHref="/portfolio/edit"
          onClose={() => setPortfolioMgrOpen(false)}
          onDelete={deleteItem}
        />
      )}

      {/* ─────── 연구 관리 모달 ─────── */}
      {researchMgrOpen && (
        <ItemMgrModal
          title="연구 관리"
          items={researchItems}
          addLabel="+ 새 연구 항목 추가"
          addHref="/portfolio/edit?type=research"
          onClose={() => setResearchMgrOpen(false)}
          onDelete={deleteItem}
        />
      )}

      {/* ─────── 스터디 관리 모달 ─────── */}
      {studyMgrOpen && (
        <ItemMgrModal
          title="스터디 관리"
          items={studyItems}
          addLabel="+ 새 스터디 항목 추가"
          addHref="/portfolio/edit?type=study"
          onClose={() => setStudyMgrOpen(false)}
          onDelete={deleteItem}
        />
      )}
    </div>
  );
}

// ─────── 대표 프로젝트 즐겨찾기(별) ───────
/** 카드/헤더 우상단에 떠 있는 별 토글. 채워진 별 = 대표 프로젝트.
 *  부모가 <Link> 일 수 있으므로 클릭 시 navigate 를 막는다. */
export function FeaturedStar({
  featured,
  onToggle,
  className,
}: {
  featured: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={featured}
      aria-label={featured ? '대표 프로젝트 해제' : '대표 프로젝트로 지정'}
      title={featured ? '대표 프로젝트 해제' : '대표 프로젝트로 지정'}
      className={`absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none shadow-sm ring-1 transition-all ${
        featured
          ? 'bg-amber-100 text-amber-500 ring-amber-200 hover:bg-amber-200'
          : 'bg-white/90 text-gray-300 ring-gray-200 hover:bg-amber-50 hover:text-amber-400'
      } ${className ?? ''}`}
    >
      {featured ? '★' : '☆'}
    </button>
  );
}

// ─────── 포트폴리오/스터디 공용 관리 모달 ───────
function ItemMgrModal({
  title,
  items,
  addLabel,
  addHref,
  onClose,
  onDelete,
}: {
  title: string;
  items: PortfolioItem[];
  addLabel: string;
  addHref: string;
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6 py-10 sm:px-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6 sm:px-10">
          <h2 className="text-xl font-bold leading-snug text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 sm:px-10 sm:py-7">
          {/* 새 항목 추가 — 페이지 이동 (상세 폼) */}
          <Link
            href={addHref}
            className="mb-6 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-4 py-4 text-sm font-medium leading-relaxed text-blue-600 transition-all hover:border-blue-400 hover:bg-blue-50"
          >
            {addLabel}
          </Link>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="mb-6 px-1 text-sm font-semibold leading-relaxed text-gray-700">
              등록된 항목 ({items.length})
            </h3>
            {items.length === 0 ? (
              <p className="px-1 text-sm leading-7 text-gray-500">
                아직 등록된 항목이 없습니다.
              </p>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => {
                  const meta = TYPE_META[item.type];
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-4 rounded-lg border border-gray-100 px-5 py-4 transition-all hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] ${meta.bg} ${meta.text}`}
                          >
                            {meta.label}
                          </span>
                          {item.domain && (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
                              {item.domain}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-500">
                            {item.period}
                          </span>
                        </div>
                        <p className="break-words text-sm font-semibold leading-relaxed text-gray-800">
                          {item.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-row items-center gap-1.5">
                        <Link
                          href={`/portfolio/edit?id=${item.id}&type=${item.type}`}
                          className="rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-white hover:text-blue-600"
                        >
                          수정
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDelete(item.id)}
                          className="rounded-md px-2.5 py-1 text-xs text-gray-600 hover:bg-white hover:text-red-500"
                        >
                          삭제
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-full bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
