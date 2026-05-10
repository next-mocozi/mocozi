'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Peer = {
  initial: string;
  name: string;
  school: string;
  department: string;
  roles: string[];
  skills: string[];
  accent: string;
};

const PEERS: Peer[] = [
  {
    initial: '김',
    name: '김태윤',
    school: '고려대학교',
    department: '컴퓨터학과',
    roles: ['백엔드'],
    skills: ['Node.js', 'Postgres', 'AWS'],
    accent: 'bg-primary-100 text-primary-700',
  },
  {
    initial: '이',
    name: '이지민',
    school: '서울대학교',
    department: '컴퓨터공학부',
    roles: ['풀스택'],
    skills: ['Next.js', 'React', 'Figma'],
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    initial: '박',
    name: '박우진',
    school: '서강대학교',
    department: '컴퓨터공학과',
    roles: ['프론트엔드'],
    skills: ['React', 'TypeScript', 'Tailwind'],
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    initial: '정',
    name: '정수아',
    school: 'KAIST',
    department: '전산학부',
    roles: ['ML/AI', '데이터'],
    skills: ['PyTorch', 'TensorFlow', 'CUDA'],
    accent: 'bg-purple-100 text-purple-700',
  },
  {
    initial: '최',
    name: '최민준',
    school: '연세대학교',
    department: '디자인예술학부',
    roles: ['디자인'],
    skills: ['Figma', 'Framer', 'Motion'],
    accent: 'bg-pink-100 text-pink-700',
  },
  {
    initial: '강',
    name: '강서연',
    school: '한양대학교',
    department: '컴퓨터소프트웨어학부',
    roles: ['모바일', 'iOS'],
    skills: ['Swift', 'SwiftUI'],
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    initial: '윤',
    name: '윤도현',
    school: '성균관대학교',
    department: '소프트웨어학과',
    roles: ['백엔드', '임베디드'],
    skills: ['Java', 'Spring', 'Kafka'],
    accent: 'bg-primary-100 text-primary-700',
  },
  {
    initial: '한',
    name: '한지우',
    school: '이화여자대학교',
    department: '컴퓨터공학과',
    roles: ['PM'],
    skills: ['기획', 'Notion'],
    accent: 'bg-rose-100 text-rose-700',
  },
  {
    initial: '임',
    name: '임채원',
    school: '서강대학교',
    department: '컴퓨터공학과',
    roles: ['안드로이드', 'iOS', '모바일'],
    skills: ['Kotlin', 'Jetpack', 'Compose'],
    accent: 'bg-teal-100 text-teal-700',
  },
  {
    initial: '송',
    name: '송예진',
    school: '중앙대학교',
    department: '소프트웨어학부',
    roles: ['프론트엔드'],
    skills: ['Vue', 'Tailwind', 'Vite'],
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    initial: '오',
    name: '오시현',
    school: '경희대학교',
    department: '컴퓨터공학과',
    roles: ['ML/AI', '게임', 'QA'],
    skills: ['Python', 'Pandas', 'scikit'],
    accent: 'bg-purple-100 text-purple-700',
  },
  {
    initial: '신',
    name: '신유나',
    school: '숙명여자대학교',
    department: '컴퓨터과학과',
    roles: ['풀스택'],
    skills: ['Django', 'React'],
    accent: 'bg-emerald-100 text-emerald-700',
  },
];

const SCHOOL_FILTERS = [
  '전체',
  '서울대학교',
  'KAIST',
  '연세대학교',
  '고려대학교',
  '성균관대학교',
];

const ROLE_FILTERS = [
  '전체',
  '백엔드',
  '프론트엔드',
  '풀스택',
  'ML/AI',
  '디자인',
  'iOS',
  '안드로이드',
  'PM',
];

export default function PeerDirectory() {
  const [school, setSchool] = useState<string>('전체');
  const [role, setRole] = useState<string>('전체');
  const [expanded, setExpanded] = useState<boolean>(false);

  const filtered = useMemo(
    () =>
      PEERS.filter((p) => {
        const okSchool = school === '전체' || p.school === school;
        const okRole = role === '전체' || p.roles.includes(role);
        return okSchool && okRole;
      }),
    [school, role],
  );

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col items-start justify-between gap-2 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl">
              지금 모코지에 있는 동료들
            </h2>
            <p className="mt-2 text-gray-600">
              .ac.kr 메일 인증으로 검증된 IT 대학생들. 가입 전에도 둘러보세요.
            </p>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            미리보기 예시
          </span>
        </div>

        {/* 모바일: 가로 스크롤 (줄넘김 회피) + 우측 페이드 마스크로 스크롤 어포던스. md+: 기존 wrap */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
          {SCHOOL_FILTERS.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={school === s}
              onClick={() => setSchool(s)}
            />
          ))}
        </div>
        <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
          {ROLE_FILTERS.map((r) => (
            <FilterChip
              key={r}
              label={r}
              active={role === r}
              onClick={() => setRole(r)}
            />
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-500">
            조건에 맞는 동료가 없어요. 필터를 바꿔보세요.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p, idx) => {
              // 모바일: 4개 / sm-md: 8개 / lg+: 전체. expanded면 모두 노출.
              let visibility = '';
              if (!expanded) {
                if (idx >= 8) visibility = 'hidden lg:flex';
                else if (idx >= 4) visibility = 'hidden sm:flex';
              }
              return (
              <article key={p.name} className={`card flex flex-col gap-3 ${visibility}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${p.accent}`}
                  >
                    {p.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="truncate text-sm text-gray-500">
                      {p.school} · {p.department}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.roles[0] && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                      {p.roles[0]}
                    </span>
                  )}
                  {p.roles.slice(1).map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500"
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </article>
              );
            })}
          </div>
        )}

        {!expanded && filtered.length > 4 && (
          <div
            className={`mt-6 flex justify-center ${filtered.length > 8 ? 'lg:hidden' : 'sm:hidden'}`}
          >
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              더 보기
            </button>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-slate-50 px-6 py-5 md:flex-row">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">전체 1,247명</span>의
            IT 대학생이 모코지에 있어요
          </p>
          <Link href="/register" className="btn-primary px-6 py-2.5 text-sm">
            가입하고 전체 둘러보기
          </Link>
        </div>
      </div>
    </section>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'shrink-0 whitespace-nowrap rounded-full bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm'
          : 'shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50'
      }
    >
      {label}
    </button>
  );
}
