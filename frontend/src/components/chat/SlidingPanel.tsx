'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface SlidingPanelProps {
  open: boolean;
  onClose: () => void;
  /** 패널 헤더 — 단계 표시 등 (선택) */
  title?: string;
  /** 콘텐츠 */
  children: ReactNode;
  /** 데스크톱(md+) 패널 폭. 기본 28rem (xl: 32rem) — 포트폴리오 패턴과 동일 */
  desktopWidthClass?: string;
}

/** 사용자 drag로 조절 가능한 폭 범위 — 너무 좁으면 사용성 저하, 너무 넓으면 채팅창 가림 */
const MIN_PANEL_PX = 240; // 15rem
const MAX_PANEL_VW_RATIO = 0.8; // 화면 폭의 80%까지

/**
 * 슬라이딩 패널 — 우측에서 좌측으로 슬라이드 인 (포트폴리오 split-shift 패턴).
 *
 * 동작:
 *  - **md(768px) 이상**: 부모 내부 absolute 패널. backdrop 없이 두 컬럼 동시 visible.
 *    부모가 자기 main content를 좌측으로 translate해서 패널 자리 만들어줘야 함.
 *    좌측 끝에 resize handle — 좌우 drag로 패널 폭 조절 가능 (240px ~ 80vw).
 *  - **md 미만 (모바일)**: fixed fullscreen modal + backdrop. 부모 layout 영향 없음.
 *    resize 비활성 (모바일에선 폭 조절 무의미).
 *
 * 사용 시 부모 요건 (md+):
 *  - 부모 컨테이너에 `relative overflow-hidden` 필요
 *  - 패널 open일 때 부모가 자기 콘텐츠에 `md:-translate-x-*` 적용
 *
 * 닫기:
 *  - 백드롭 외부 클릭 (모바일만)
 *  - 닫기 버튼 (X)
 *  - ESC 키
 */
export function SlidingPanel({
  open,
  onClose,
  title,
  children,
  desktopWidthClass = 'md:w-[28rem] xl:w-[32rem]',
}: SlidingPanelProps) {
  /** 사용자 drag로 지정한 패널 폭 (px). null이면 desktopWidthClass 기본값 사용 */
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  /** drag 진행 중 — true면 transition-transform 비활성 (snappy resize) */
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 모바일 modal일 때만 body scroll lock — md+ inline panel은 부모 레이아웃 안에서
  // 자연스럽게 동작하므로 lock 불필요
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // 패널이 닫히면 폭 reset — 다음 open 시 기본값으로 시작 (사용자 의도 추적 어려워 매번 reset)
  useEffect(() => {
    if (!open) setCustomWidth(null);
  }, [open]);

  /** 좌측 edge handle drag 시작 — document에 mousemove/mouseup 등록.
   *  panel 좌측을 잡고 좌→우 = 좌클릭 시 패널이 좁아짐(왼쪽으로 이동), 우→좌 = 패널이 넓어짐. */
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth =
      panelRef.current?.offsetWidth ?? customWidth ?? 0;
    if (startWidth === 0) return;

    setIsResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      // 좌측 끝을 좌측으로 drag하면 panel 넓어짐 → delta 부호 반전
      const delta = startX - ev.clientX;
      const next = Math.max(
        MIN_PANEL_PX,
        Math.min(window.innerWidth * MAX_PANEL_VW_RATIO, startWidth + delta),
      );
      setCustomWidth(next);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [customWidth]);

  // customWidth 적용 — Tailwind class에 width 안 박혀 있을 때만 inline style 활성
  const panelStyle = customWidth ? { width: `${customWidth}px` } : undefined;

  return (
    <>
      {/* md+ — inline split-shift panel (no backdrop, 부모 안 absolute).
          pointer-events-none 으로 off-screen 시 클릭 차단, 안쪽 컨텐츠가 pointer-events-auto.
          drag 중엔 transition 끄기 — mouse 따라가는 동안 부드러운 transition은 부자연스러움 */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        style={panelStyle}
        className={`pointer-events-none absolute inset-y-0 right-0 hidden md:block ${
          customWidth ? '' : desktopWidthClass
        } ${isResizing ? '' : 'transition-transform duration-300 ease-out'} ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="pointer-events-auto relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* 좌측 resize handle — 8px 폭. 사용자가 명확히 잡을 수 있도록 hover 시 강조.
              실제 시각 라인은 1px(left-0.5)이지만 hit area가 더 넓어 잡기 편함. */}
          <div
            onMouseDown={onResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="패널 폭 조절"
            className="absolute left-0 top-0 z-10 hidden h-full w-2 cursor-ew-resize items-center justify-center md:flex"
          >
            <div
              className={`h-full w-px transition-colors ${
                isResizing ? 'bg-primary-400' : 'bg-transparent hover:bg-primary-300'
              }`}
            />
          </div>
          <PanelChrome title={title} onClose={onClose}>
            {children}
          </PanelChrome>
        </div>
      </div>

      {/* md 미만 — fullscreen modal + backdrop, 우측에서 슬라이드 인. resize 비활성 */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 md:hidden ${
          open
            ? 'bg-black/30 opacity-100'
            : 'pointer-events-none bg-black/0 opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <PanelChrome title={title} onClose={onClose}>
          {children}
        </PanelChrome>
      </div>
    </>
  );
}

function PanelChrome({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </>
  );
}
