import { SVGProps } from 'react';

/**
 * 채팅 화면 SVG 아이콘 모음 — 모두 단일 base에서 파생 (viewBox 24, stroke 2, round caps).
 *
 * 디자인 원칙:
 *  - 24x24 viewBox, stroke="currentColor"로 텍스트 색상 상속
 *  - strokeWidth=2 + linecap/linejoin round → 부드러운 라인
 *  - fill="none" 기본, 채움이 필요한 경우 path별로 fill 지정
 *  - className으로 크기·색상 외부 override (예: "h-4 w-4 text-gray-500")
 *  - aria-hidden 기본 — 라벨은 부모 button의 aria-label로
 *
 * 사용: <ReplyIcon className="h-4 w-4" /> 등
 * 모든 icon은 IconBase를 통해 일관성 강제 — 새 아이콘 추가 시 path만 작성.
 *
 * Path 출처: Lucide(MIT) 기반, 일부는 단순화·자체 그림. 단일 색상·간결한 라인 위주.
 */

type IconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

/** 모든 아이콘 공통 base — viewBox·stroke 규격 통일. children에 path/circle/line 등 element 전달 */
function IconBase({
  children,
  className = 'h-5 w-5',
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ===== 액션 버튼 (메시지 hover) =====

/** 답글 — corner-up-left (Lucide) */
export function ReplyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </IconBase>
  );
}

/** 클립보드 (원문 복사) — copy (Lucide) */
export function ClipboardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </IconBase>
  );
}

/** 체크 — check (Lucide). 복사 완료·선택 확인 등 */
export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="20 6 9 17 4 12" />
    </IconBase>
  );
}

/** 연필 (편집) — pencil (Lucide 단순화) */
export function PencilIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </IconBase>
  );
}

/** 휴지통 (삭제) — trash-2 (Lucide) */
export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </IconBase>
  );
}

/** 반응 추가 — smile-plus (Lucide) */
export function SmilePlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 11v1a10 10 0 1 1-9-10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
      <path d="M16 5h6" />
      <path d="M19 2v6" />
    </IconBase>
  );
}

// ===== 상태 표시 =====

/** 채워진 작은 원 — 연결됨 등 active 상태 (8px feeling, 24 viewBox 안 r=4) */
export function DotFilledIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** 빈 원 (테두리만) — 끊김 등 inactive 상태 */
export function DotOutlineIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4" />
    </IconBase>
  );
}

/** 경고 삼각형 — alert-triangle (Lucide). 전송 실패 등 */
export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </IconBase>
  );
}

// ===== 화살표 / 네비 =====

/** 좌향 화살표 — arrow-left (Lucide) */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="19" x2="5" y1="12" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </IconBase>
  );
}

/** 상향 화살표 — arrow-up (Lucide) */
export function ArrowUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="12" x2="12" y1="19" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </IconBase>
  );
}

// ===== 방/멤버 아바타 =====

/** 1인 사용자 — user (Lucide). DIRECT 채팅 */
export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </IconBase>
  );
}

/** 그룹 — users (Lucide). GROUP 채팅 */
export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconBase>
  );
}

/** 말풍선 — message-square (Lucide). 빈 상태 카드 */
export function MessageSquareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </IconBase>
  );
}

/** 알림 꺼짐 — bell-off (Lucide). mute 표시 */
export function BellOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </IconBase>
  );
}

// ===== Attachment 타입별 아이콘 =====

/** 폴더 — folder (Lucide). portfolio attachment */
export function FolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </IconBase>
  );
}

/** 링크 (외부) — external-link (Lucide). 외부 URL */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </IconBase>
  );
}

/** 클립 (첨부) — paperclip (Lucide). default attachment */
export function PaperclipIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.98 8.83l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </IconBase>
  );
}

// ===== 기타 =====

/** X (닫기) — x (Lucide). 모달 닫기 등 */
export function XIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}
