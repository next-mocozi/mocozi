import { SVGProps } from 'react';

/**
 * 알림 센터 아이콘 — Lucide bell 톤. 사이트의 다른 line-icon(ChatIcons 등)과
 * 동일한 stroke-2 round caps 규격.
 *
 * 디자인:
 *  - 24x24 viewBox, stroke="currentColor" (텍스트 색 상속)
 *  - 일반 bell outline — 알림 개수 표시(빨간 점)는 NotificationCenter가 외부에서
 *    unreadCount > 0 일 때만 absolute로 overlay (분리된 책임).
 *
 * 외부 icons8 PNG 의존 제거 (네트워크/저작권/리사이즈 품질 모두 SVG가 우월).
 */
type IconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

export function NotificationIcon({
  className = 'h-6 w-6',
  ...rest
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* Lucide bell — 일반 종 outline. 빨간 점은 외부에서 absolute overlay. */}
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
