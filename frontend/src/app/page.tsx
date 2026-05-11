'use client';

import Link from 'next/link';
import PeerDirectory from '@/components/landing/PeerDirectory';
import HowItWorks from '@/components/landing/HowItWorks';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/contexts/AuthContext';

type SamplePeer = {
  initial: string;
  nameMasked: string;
  school: string;
  role: string;
  skills: string[];
  accent: string;
  rotate: string;
};

const SAMPLE_PEERS: SamplePeer[] = [
  {
    initial: '김',
    nameMasked: '김태윤',
    school: '고려대학교 컴퓨터학과',
    role: '백엔드',
    skills: ['Node.js', 'Postgres', 'AWS'],
    accent: 'bg-primary-100 text-primary-700',
    rotate: '-rotate-3 -translate-y-8',
  },
  {
    initial: '이',
    nameMasked: '이지민',
    school: '서울대학교 컴퓨터공학과',
    role: '풀스택',
    skills: ['Next.js', 'React', 'Figma'],
    accent: 'bg-emerald-100 text-emerald-700',
    rotate: 'rotate-2 translate-x-14',
  },
  {
    initial: '박',
    nameMasked: '박우진',
    school: '서강대학교 컴퓨터공학과',
    role: '프론트엔드',
    skills: ['React', 'TypeScript', 'Tailwind'],
    accent: 'bg-amber-100 text-amber-700',
    rotate: '-rotate-1 translate-y-16 -translate-x-10',
  },
];

/** 랜딩 페이지 */
export default function HomePage() {
  const { user, loading } = useAuth();
  // loading 중에는 비로그인 가정 — SSR/첫 페인트에서 마케팅 히어로가 보이는 게 자연스러움.
  // 토큰이 있는 사용자는 /api/users/me 응답 후 짧게 dashboard로 swap.
  const showDashboard = !loading && user !== null;

  return (
    <div>
      {showDashboard && user ? <WelcomeDashboard user={user} /> : <HeroSection />}

      <PeerDirectory />

      <HowItWorks />

      {!showDashboard && <BottomCTA />}
    </div>
  );
}

/* ---------- 비로그인 ---------- */

function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-primary-50 to-white py-12 sm:py-16 md:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
        {/* 좌측: 카피 + CTA */}
        <div className="text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-medium text-primary-700">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            .ac.kr 인증된 IT 대학생만
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl md:text-5xl">
            간편하게 팀을 찾으세요
            <br />
            <span className="text-primary-600">검증된 동료들과</span>
          </h1>
          <p className="mt-5 text-base text-gray-600 sm:text-lg">
            프로젝트, 해커톤, 스터디 — 학교 이메일로 인증된 IT 대학생들이
            기다리고 있어요.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            지난 7일간 <span className="font-semibold text-gray-700">24개</span> 팀이 매칭됐어요
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start">
            <Link href="/register" className="btn-primary px-7 py-3 text-base text-center">
              시작하기
            </Link>
            <Link href="/recruit" className="btn-secondary px-7 py-3 text-base text-center">
              먼저 둘러보기
            </Link>
          </div>
        </div>

        {/* 우측: 프로필 카드 스택 (md 이상에서만 노출) */}
        <div className="relative mx-auto hidden h-[460px] w-full max-w-md md:block">
          <p className="absolute -top-2 right-0 text-[11px] font-medium uppercase tracking-wider text-gray-400">
            미리보기 예시
          </p>
          {SAMPLE_PEERS.map((peer, idx) => {
            const baseZ = ['z-10', 'z-20', 'z-30'][idx] ?? 'z-10';
            return (
              <article
                key={peer.nameMasked}
                aria-hidden="true"
                className={`absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 ${peer.rotate} ${baseZ} card transform-gpu transition-[transform,box-shadow] duration-300 ease-out hover:z-40 hover:scale-[1.03] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)]`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-semibold ${peer.accent}`}
                  >
                    {peer.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold text-gray-900">{peer.nameMasked}</p>
                    </div>
                    <p className="text-sm text-gray-500">{peer.school}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                    {peer.role}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {peer.skills.map((s) => (
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
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="bg-primary-600 py-16">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
          지금 바로 팀을 만들어보세요
        </h2>
        <p className="mt-4 text-primary-100">
          대학교 메일 인증 한 번으로 시작할 수 있습니다
        </p>
        <Link
          href="/register"
          className="mt-8 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-primary-600 transition-colors hover:bg-primary-50"
        >
          무료로 시작하기
        </Link>
      </div>
    </section>
  );
}

/* ---------- 로그인 ---------- */

function WelcomeDashboard({ user }: { user: AuthUser }) {
  return (
    <section className="bg-gradient-to-b from-primary-50 to-white py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-medium text-primary-700">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            다시 오신 것을 환영해요
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
            <span className="text-primary-600">{user.name}</span>님, 오늘은 무엇부터 할까요?
          </h1>
          <p className="mt-3 text-base text-gray-600">
            지원, 팀 운영, 채팅 — 한 화면에서 바로 이어가세요.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/recruit"
            title="구인 둘러보기"
            caption="조건에 맞는 팀을 찾아요"
            accent="bg-primary-100 text-primary-700"
          />
          <QuickAction
            href="/team/create"
            title="팀 만들기"
            caption="기획서로 동료를 모아요"
            accent="bg-emerald-100 text-emerald-700"
          />
          <QuickAction
            href="/chat"
            title="채팅 열기"
            caption="대화 중인 팀과 이어가요"
            accent="bg-amber-100 text-amber-700"
          />
          <QuickAction
            href="/profile"
            title="내 프로필"
            caption="포트폴리오를 정리해요"
            accent="bg-purple-100 text-purple-700"
          />
        </div>
      </div>
    </section>
  );
}

function QuickAction({
  href,
  title,
  caption,
  accent,
}: {
  href: string;
  title: string;
  caption: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-start gap-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)]"
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
        aria-hidden="true"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 group-hover:text-primary-700">{title}</p>
        <p className="mt-0.5 text-sm text-gray-500">{caption}</p>
      </div>
    </Link>
  );
}
