'use client';

import { useCallback, useEffect, useState } from 'react';

/** 전역 alert 팝업.
 *  마운트 시 window.alert 를 큐 기반 모달로 monkey-patch 한다.
 *  기존 코드의 alert(...) / window.alert(...) 호출은 그대로 두고 표시 방식만 교체.
 *  - 동기 → 비동기로 바뀌지만 현 호출부는 모두 단순 알림 용도라 흐름에 영향 없음.
 *  - 빠르게 연속 호출되면 큐에 쌓아 순서대로 표시. */
export default function AlertModal() {
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    const original = window.alert;
    window.alert = (msg?: unknown) => {
      setQueue((q) => [...q, msg == null ? '' : String(msg)]);
    };
    return () => {
      window.alert = original;
    };
  }, []);

  const close = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  // ESC / Enter 로 닫기
  useEffect(() => {
    if (queue.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue.length, close]);

  if (queue.length === 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm"
      >
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
          {queue[0]}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={close}
            className="btn-primary text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
