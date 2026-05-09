/**
 * 미니멀 눈 모양 아이콘 — 채팅 입력 미리보기 토글 등에 사용.
 * currentColor 사용해서 부모 텍스트 색상 따라감.
 */
export function PreviewIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2.5 12C4.8 7.8 8.1 5.7 12 5.7C15.9 5.7 19.2 7.8 21.5 12C19.2 16.2 15.9 18.3 12 18.3C8.1 18.3 4.8 16.2 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="4.1" fill="currentColor" />
      <circle cx="10.6" cy="10.1" r="1.1" fill="white" />
    </svg>
  );
}
