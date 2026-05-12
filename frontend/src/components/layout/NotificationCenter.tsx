'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { NotificationIcon } from '@/components/icons/NotificationIcon';
import { useChatNotifications } from '@/providers/SocketProvider';

/**
 * §B-DM-8 알림 센터 — Phase B 자리 잡기.
 *
 * 현재 phase: 헤더 아이콘 + dropdown placeholder만. 실제 알림 데이터/모델은 후속 plan.
 * dropdown에는 채팅 unread 카운트만 노출 (`useChatNotifications.totalUnread`).
 *
 * 향후 추가될 알림 카테고리 (Notification 모델·socket 이벤트 정착 시):
 *  1. 채팅 요청 받음 — recruit/scout/portfolio 채팅방 첫 메시지 수신
 *  2. 채팅 답장 받음 — 본인 메시지에 상대 답장
 *  3. 응답 만료 — 본인이 보낸 메시지가 3일 무응답
 *  4. 지원 접수 — 본인 팀에 지원자 들어옴
 *  5. 지원 처리 결과 — 본인 지원 수락/거절
 *  6. 팀 멤버 변경 — 본인 팀에 멤버 가입/탈퇴
 *  7. (후속) 포트폴리오 인터랙션 — 코멘트/좋아요
 */
export default function NotificationCenter() {
  const { totalUnread } = useChatNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-gray-100"
        aria-label={
          totalUnread > 0 ? `알림 (안 읽은 메시지 ${totalUnread}개)` : '알림'
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* SVG로 자체 구현 — 외부 PNG 의존 제거. currentColor 상속으로 dark mode 등 향후 확장 용이 */}
        <NotificationIcon className="h-6 w-6 text-gray-700" />
        {totalUnread > 0 && (
          <span
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">알림</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {totalUnread > 0 ? (
              <Link
                href="/chat"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <span>안 읽은 채팅 메시지</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {totalUnread}
                </span>
              </Link>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-gray-400">
                아직 알림이 없어요
              </p>
            )}
            <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
              스카우트·지원·팀 변동 등 추가 알림이 곧 도입돼요
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
