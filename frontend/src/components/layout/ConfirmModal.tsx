'use client';

import { useCallback, useEffect, useState } from 'react';

/** 전역 confirm 팝업.
 *  native window.confirm 을 대체하는 자체 모달. window.confirm 은 동기 + boolean
 *  반환이라 monkey-patch 가 불가능하므로, 대신 Promise<boolean> 을 돌려주는
 *  confirmDialog() 헬퍼를 노출한다. 호출부는 `await confirmDialog(...)` 로 사용.
 *  - 연속 호출되면 큐에 쌓아 순서대로 표시.
 *  - ESC/배경 클릭 = 취소(false), Enter = 확인(true). */

type ConfirmRequest = {
  message: string;
  resolve: (ok: boolean) => void;
};

/** ConfirmModal 이 마운트되면 채워지는 큐 추가 함수. */
let enqueue: ((req: ConfirmRequest) => void) | null = null;

/** native window.confirm 대체 — 자체 팝업으로 확인을 받아 Promise<boolean> 반환.
 *  모달이 아직 마운트되지 않은 극초기 호출은 native confirm 으로 폴백. */
export function confirmDialog(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (enqueue) {
      enqueue({ message, resolve });
    } else if (typeof window !== 'undefined') {
      resolve(window.confirm(message));
    } else {
      resolve(false);
    }
  });
}

export default function ConfirmModal() {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);

  useEffect(() => {
    enqueue = (req) => setQueue((q) => [...q, req]);
    return () => {
      enqueue = null;
    };
  }, []);

  const current = queue[0];

  const settle = useCallback((ok: boolean) => {
    setQueue((q) => {
      const [head, ...rest] = q;
      // resolve 는 idempotent — Strict Mode 더블 호출에도 안전.
      head?.resolve(ok);
      return rest;
    });
  }, []);

  // ESC = 취소, Enter = 확인
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        settle(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, settle]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => settle(false)}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm"
      >
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
          {current.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => settle(false)}
            className="btn-secondary text-sm"
          >
            취소
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => settle(true)}
            className="btn-primary text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
