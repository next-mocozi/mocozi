'use client';

interface TemplateTriggerProps {
  /** 컨텍스트별 다른 라벨 — 단순화: "인사 양식" 공통 사용 */
  onClick: () => void;
}

/**
 * 채팅방 입력창 위에 떠있는 양식 트리거 버튼.
 *
 * 표시 조건:
 *  - 메시지 0건 (첫 진입)
 *  - URL query에 context 존재
 *  → chat/[roomId]/page.tsx에서 조건부 렌더
 *
 * 클릭 시 SlidingPanel 열림.
 */
export function TemplateTrigger({ onClick }: TemplateTriggerProps) {
  return (
    <div className="border-t border-gray-200 bg-primary-50 px-4 py-3">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2.5 text-sm font-medium text-primary-700 shadow-sm transition-colors hover:bg-primary-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        인사 양식으로 시작하기
      </button>
      <p className="mt-1.5 text-center text-xs text-gray-500">
        미리 만들어둔 인사 양식으로 빠르게 첫 메시지를 보낼 수 있어요
      </p>
    </div>
  );
}
