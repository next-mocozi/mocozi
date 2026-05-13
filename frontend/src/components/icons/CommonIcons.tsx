import { SVGProps } from 'react';

/**
 * 모코지 공용 SVG 아이콘 — Lucide(MIT) 기반, 일부 자체 단순화.
 *
 * 디자인 원칙:
 *  - 24x24 viewBox, stroke="currentColor"로 텍스트 색 상속
 *  - strokeWidth=2 + linecap/linejoin round → 부드러운 라인
 *  - fill="none" (기본), 채움 필요 시 path별 명시
 *  - className으로 크기·색상 override (예: "h-4 w-4 text-stone-500")
 *  - aria-hidden 기본 — 라벨은 부모 button의 aria-label로
 *
 * ChatIcons.tsx는 채팅 컴포넌트 전용 아이콘, 이 파일은 일반 UI 아이콘 (학교/검색/시계 등).
 */

type IconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

function IconBase({
  children,
  className = 'h-5 w-5',
  ...rest
}: IconProps & { children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

/** 학교 아이콘 (🏫 대체) — 지붕 + 본체 + 깃발. recruit "같은 학교" 필터 등. */
export function SchoolIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {/* 지붕 */}
      <path d="M3 21V11l9-6 9 6v10" />
      {/* 본체 안쪽 — 출입구 */}
      <path d="M10 21v-6h4v6" />
      {/* 깃발 */}
      <path d="M12 5V3" />
      <path d="M12 3h4v2h-4" />
    </IconBase>
  );
}

/** 시계 아이콘 (⏰ 대체) — 단순한 원형 시계. 응답 만료/대기 신호. */
export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </IconBase>
  );
}

/** 검색 아이콘 (🔍 대체) — 돋보기. 검색 input prefix, 빈 상태 등. */
export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

/** 메일 아이콘 (✉️ 대체) — 봉투. 이메일 인증/알림. */
export function MailIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </IconBase>
  );
}

/** 전구 아이콘 (💡 대체) — 힌트/팁. portfolio onboarding 등. */
export function LightbulbIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {/* 전구 본체 */}
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.8.6 1.3 1.5 1.3 2.4V18h5.4v-.9c0-.9.5-1.8 1.3-2.4A7 7 0 0 0 12 2Z" />
    </IconBase>
  );
}
