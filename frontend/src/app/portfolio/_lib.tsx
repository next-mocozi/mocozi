'use client';

// 포트폴리오 공통 타입/상수/유틸/컴포넌트 — page.tsx, [userId]/page.tsx,
// [userId]/items/[itemId]/page.tsx, edit/* 등 여러 파일에서 공유.
// 백엔드 미연동 상태 — localStorage 기반 mock.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ProfileLink } from './_platforms';

// ──────── localStorage 키 ────────
export const LINKS_STORAGE_KEY = 'mock_profile_links';
export const ROLES_STORAGE_KEY = 'mock_profile_roles';
export const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
export const INTRO_STORAGE_KEY = 'mock_portfolio_intro';
export const CAREERS_STORAGE_KEY = 'mock_portfolio_career_items';
export const EXPS_STORAGE_KEY = 'mock_portfolio_experiences';
export const VISIBILITY_STORAGE_KEY = 'mock_portfolio_visibility';
export const OWNER_STORAGE_KEY = 'mock_portfolio_owner';
// 온보딩 완료 시점 (epoch ms). 첫 게시물(ProfilePost) 의 createdAt 으로 사용 —
// 공개로 전환 시 메인 피드, 항상 내 피드에 노출된다.
export const FIRST_POST_STORAGE_KEY = 'mock_portfolio_first_post_at';

export const INTRO_MAX = 500;
export const CAREER_CONTENT_MAX = 200;
export const MAX_FEATURED = 4;

// ──────── 타입 ────────
export type PortfolioVisibility = 'public' | 'private';

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
  featured?: boolean;
  thumbnail?: string;
  draft?: boolean;
  paperUrl?: string;
  /** 게시물(피드)에 노출될 때 사용하는 등록 시점 (epoch ms).
   *  본인 항목은 ID 가 Date.now() 기반이므로 fallback 으로 id 를 사용 가능. */
  createdAt?: number;
};

export type Experience = {
  id: number;
  company: string;
  team: string;
  role: string;
  period: string;
  current: boolean;
};

export type CareerItem = {
  id: number;
  year: string;
  content: string;
};

export type ExpFormState = {
  company: string;
  team: string;
  role: string;
  startDate: string;
  endDate: string;
  current: boolean;
};

export const EMPTY_EXP_FORM: ExpFormState = {
  company: '',
  team: '',
  role: '',
  startDate: '',
  endDate: '',
  current: false,
};

export const EMPTY_CAREER_FORM: Omit<CareerItem, 'id'> = {
  year: '',
  content: '',
};

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

// ──────── 기본값 ────────
// 신규 사용자는 빈 상태로 시작 — localStorage 가 채워질 때까지 fallback 으로 사용.
// (예전엔 데모용 더미 데이터가 있었으나, 클릭 시 존재하지 않는 항목으로 라우팅되어
//  404 가 발생하고 신규 사용자에게 혼란을 주어 모두 비웠음.)
export const DEFAULT_INTRO = '';
export const DEFAULT_CAREERS: CareerItem[] = [];
export const DEFAULT_LINKS: ProfileLink[] = [];
export const DEFAULT_EXPS: Experience[] = [];
export const DEFAULT_ITEMS: PortfolioItem[] = [];

// ──────── 유틸 ────────
export function parseStartDateNum(period: string): number {
  const m = period.match(/^\s*(\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?/);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = m[3] ? Number(m[3]) : 1;
  return y * 10000 + mo * 100 + d;
}

export function sortPortfolioItems(items: PortfolioItem[]): PortfolioItem[] {
  const byStartDesc = (a: PortfolioItem, b: PortfolioItem) =>
    parseStartDateNum(b.period) - parseStartDateNum(a.period) || b.id - a.id;
  const featured = items.filter((it) => it.featured).sort(byStartDesc);
  const others = items.filter((it) => !it.featured).sort(byStartDesc);
  return [...featured, ...others];
}

export function parsePeriod(period: string): {
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

export function formatPeriod(
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

// localStorage 의 OWNER_STORAGE_KEY 를 읽어 본인 포트폴리오 상세 경로 반환.
// 작성 후 라우팅 시 useAuth 를 추가하지 않고도 본인 [userId] 페이지로 보낼 수 있다.
// 소유자 정보가 없으면 피드(/portfolio)로 fallback.
export function getMyPortfolioPath(): string {
  if (typeof window === 'undefined') return '/portfolio';
  try {
    const ownerId = localStorage.getItem(OWNER_STORAGE_KEY);
    return ownerId ? `/portfolio/${ownerId}` : '/portfolio';
  } catch {
    return '/portfolio';
  }
}

// ──────── 년/월 드롭다운 옵션 ────────
const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from(
  { length: 32 },
  (_, i) => CURRENT_YEAR + 1 - i,
);
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

// ──────── 컴포넌트: YearMonthPicker ────────
export function YearMonthPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [year, setYear] = useState(value ? value.split('-')[0] : '');
  const [month, setMonth] = useState(value ? value.split('-')[1] : '');

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

// ──────── 컴포넌트: FeaturedStar (대표 프로젝트 토글) ────────
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

// ──────── 컴포넌트: ItemMgrModal (포트폴리오/연구/스터디 공용 관리 모달) ────────
export function ItemMgrModal({
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
