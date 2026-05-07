'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useMyPortfolioStatus } from '@/hooks/useMyPortfolioStatus';

export type PortfolioNavTab = 'feed' | 'mine' | 'me';

/** 포트폴리오 영역 좌측 상단 segmented controls.
 *  탭: 피드 | 내 포트폴리오 | 내 피드.
 *  "내 포트폴리오" 옆에 공개/비공개 뱃지를 작게 표시.
 *  - 미작성(unwritten) 사용자는 게이트에 의해 도달하지 않으므로 단순 fallback 라우팅. */
export default function PortfolioSegmentedNav({
  current,
}: {
  current: PortfolioNavTab;
}) {
  const { user } = useAuth();
  const { status } = useMyPortfolioStatus();

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

      {/* 공개/비공개 뱃지 — '내 포트폴리오' 가 활성이거나 작성됨 상태일 때 노출 */}
      {(status === 'public' || status === 'private') && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            status === 'public'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}
          aria-label={status === 'public' ? '공개 상태' : '비공개 상태'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'public' ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          {status === 'public' ? '공개' : '비공개'}
        </span>
      )}
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
