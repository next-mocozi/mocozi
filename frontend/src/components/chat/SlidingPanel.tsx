'use client';

import { ReactNode, useEffect } from 'react';

interface SlidingPanelProps {
  open: boolean;
  onClose: () => void;
  /** 패널 헤더 — 단계 표시 등 (선택) */
  title?: string;
  /** 콘텐츠 */
  children: ReactNode;
  /** 데스크톱(xl 이상)에서만 패널 폭 (channel 영역 안 비율). 기본 50% */
  desktopWidthClass?: string;
}

/**
 * 슬라이딩 패널 — 양식 미리보기 / attachment 뷰어 등 재사용.
 *
 * 반응형 동작:
 *  - **xl(1280px) 이상**: 채팅방 영역 우측에서 왼쪽으로 슬라이드 in (absolute, 채팅방 안)
 *    → 채팅방 콘텐츠는 그대로 두고 패널이 위에 덮음
 *  - **xl 미만**: 화면 아래에서 위로 슬라이드 in (fixed bottom sheet)
 *    → 인스타그램 갤러리 슬라이드 UX
 *
 * 닫기:
 *  - 백드롭 외부 클릭
 *  - 닫기 버튼 (X)
 *  - ESC 키
 */
export function SlidingPanel({
  open,
  onClose,
  title,
  children,
  desktopWidthClass = 'xl:w-[50%]',
}: SlidingPanelProps) {
  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 외부 스크롤 잠금 (모바일 bottom sheet에서 중요)
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop — 부드러운 페이드 */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/30 transition-opacity duration-300
          ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}
        `}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`
          fixed z-50 bg-white shadow-2xl transition-transform duration-300 ease-out
          /* xl 미만 — bottom sheet (아래→위) */
          inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl
          ${open ? 'translate-y-0' : 'translate-y-full'}
          /* xl 이상 — 우측에서 좌측 슬라이드 (채팅 콘텐츠 우측 영역 안) */
          xl:inset-y-0 xl:left-auto xl:right-0 xl:max-h-none xl:rounded-t-none xl:rounded-l-2xl ${desktopWidthClass}
          ${open ? 'xl:translate-y-0 xl:translate-x-0' : 'xl:translate-x-full xl:translate-y-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">{title ?? ''}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="닫기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content — 스크롤 가능 */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(80vh - 4rem)' }}>
          {children}
        </div>
      </div>
    </>
  );
}
