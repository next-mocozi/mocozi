import { SVGProps } from 'react';

/**
 * 알림 센터 아이콘 — 검은 둥근 사각형 + 우상단 점(notch 분리).
 *
 * 디자인:
 *  - 24x24 viewBox, fill="currentColor" (텍스트 색 상속)
 *  - 사각형은 우상단에 원형 mask로 cut-out된 형태 → 점과 사이에 1px 빈 공간(visual notch)
 *  - 점은 별도 circle로 그 cut-out 안에 위치
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
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* mask — 흰=노출, 검=투명. 우상단에 점보다 약간 큰 원을 검정으로 두어 cut-out */}
      <mask
        id="notification-icon-notch"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="white" />
        <circle cx="19" cy="5" r="4" fill="black" />
      </mask>
      {/* 둥근 사각형 본체 — mask로 우상단 원형 cut-out */}
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4.5"
        mask="url(#notification-icon-notch)"
      />
      {/* 우상단 알림 점 — cut-out 안에 위치 (1px 가시적 gap) */}
      <circle cx="19" cy="5" r="3" />
    </svg>
  );
}
