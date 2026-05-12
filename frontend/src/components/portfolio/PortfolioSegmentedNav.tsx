'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolioStatus } from '@/hooks/useMyPortfolioStatus';

export type PortfolioNavTab = 'feed' | 'mine' | 'me';

/** 포트폴리오 영역 좌측 상단 segmented controls.
 *  탭: 피드 | 내 포트폴리오 | 내 피드.
 *  (공개/비공개 뱃지는 제거됨 — 설정 모달에서만 확인.) */
export default function PortfolioSegmentedNav({
  current,
}: {
  current: PortfolioNavTab;
  /** 옛 props 호환을 위해 받기는 하지만 더 이상 사용 안 함. */
  isPublic?: boolean;
}) {
  const { user } = useAuth();
  const myHref = user ? `/portfolio/${user.id}` : '/portfolio';

  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="inline-flex rounded-full bg-gray-100 p-1 shadow-sm">
        <TabLink href="/portfolio" active={current === 'feed'} label="피드" />
        <TabLink
          href={myHref}
          active={current === 'mine'}
          label="내 포트폴리오"
        />
        <TabLink href="/portfolio/me" active={current === 'me'} label="내 피드" />
      </div>
    </div>
  );
}

function TabLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  );
}
