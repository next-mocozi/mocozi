'use client';

import Link from 'next/link';
import {
  ExternalLinkIcon,
  FolderIcon,
  PaperclipIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons/ChatIcons';
import type { ParsedAttachment } from '@/lib/messageTemplate';

interface AttachmentButtonProps {
  attachment: ParsedAttachment;
  /** 메시지 풍선이 본인 메시지(우측)인지 — 색상 분기 */
  isMine: boolean;
}

/**
 * 메시지 풍선 아래에 표시되는 가로로 긴 둥근사각형 리다이렉트 버튼.
 *
 * Phase A — 단순한 page navigation:
 *  - profile → /profile/{target}
 *  - 그 외 type은 안전 fallback (#)
 *
 * Phase B 진화: SlidingPanel 다시 열어 그 안에서 미리보기 (페이지 이동 없이).
 */
export function AttachmentButton({ attachment, isMine }: AttachmentButtonProps) {
  const href = resolveHref(attachment);

  return (
    <Link
      href={href}
      className={`
        flex items-center justify-between gap-2 border px-3 py-2 text-xs transition-colors
        ${
          isMine
            ? 'border-primary-300 bg-white/95 text-primary-900 hover:bg-white'
            : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
        }
      `}
    >
      <span className="flex items-center gap-2">
        <IconFor type={attachment.type} className="h-4 w-4" />
        <span className="font-medium">{attachment.label}</span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 flex-shrink-0 opacity-60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </Link>
  );
}

function resolveHref(a: ParsedAttachment): string {
  switch (a.type) {
    case 'profile':
      return `/profile/${a.target}`;
    case 'portfolio':
      return `/portfolio/${a.target}`;
    case 'team':
      return `/team/${a.target}`;
    case 'external':
      return a.target.startsWith('http') ? a.target : `https://${a.target}`;
    default:
      return '#';
  }
}

function IconFor({
  type,
  className,
}: {
  type: ParsedAttachment['type'];
  className?: string;
}) {
  switch (type) {
    case 'profile':
      return <UserIcon className={className} />;
    case 'portfolio':
      return <FolderIcon className={className} />;
    case 'team':
      return <UsersIcon className={className} />;
    case 'external':
      return <ExternalLinkIcon className={className} />;
    default:
      return <PaperclipIcon className={className} />;
  }
}
