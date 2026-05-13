'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NotificationIcon } from '@/components/icons/NotificationIcon';
import { useNotificationFeed } from '@/hooks/useNotificationFeed';
import { useChatSocket } from '@/providers/SocketProvider';
import type { Notification, NotificationType } from '@/types/notification';

/**
 * §B-DM-9 알림 센터.
 *
 * - mount 시 GET /api/notifications fetch + socket `notification:new` listen
 * - 우상단 빨간 점: 안 읽은 알림 1개+일 때
 * - dropdown: 알림 목록 + 클릭 시 router.push + markRead
 * - "모두 읽음" 버튼: 일괄 read 처리
 *
 * 현재 등재된 카테고리 (backend NotificationType):
 *   - CHAT_NEW_REQUEST      스카우트/구인 등 첫 메시지 수신
 *   - APPLICATION_RECEIVED  본인 팀에 지원자 들어옴
 *   - APPLICATION_PROCESSED 본인 지원 결과 (수락/거절) — 후속에서 활성
 */
export default function NotificationCenter() {
  const router = useRouter();
  const { socket } = useChatSocket();
  const { items, unreadCount, markRead, markAllRead } = useNotificationFeed(socket);

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

  const handleClickItem = (n: Notification) => {
    if (!n.readAt) void markRead(n.id);
    setOpen(false);
    if (n.linkTo) router.push(n.linkTo);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-gray-100"
        aria-label={
          unreadCount > 0 ? `알림 (안 읽음 ${unreadCount}개)` : '알림'
        }
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <NotificationIcon className="h-6 w-6 text-primary-600" />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">알림</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-indigo-600 hover:text-indigo-700"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                아직 알림이 없어요
              </p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClickItem(n)}
                      className={`block w-full px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                        n.readAt ? 'text-gray-500' : 'bg-indigo-50/40 text-gray-900'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <NotificationTypeBadge type={n.type} />
                        <div className="flex-1 min-w-0">
                          <p className={`break-words ${n.readAt ? '' : 'font-medium'}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="mt-0.5 text-xs text-gray-500 break-words">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-gray-400">
                            {formatTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-500 transition-colors hover:bg-gray-50"
          >
            자세히 보기
          </Link>
        </div>
      )}
    </div>
  );
}

/** 알림 type 별 색 점 — 시각적 카테고리 식별 */
function NotificationTypeBadge({ type }: { type: NotificationType }) {
  const map: Record<NotificationType, string> = {
    // 채팅 요청 → blue (구인 컨텍스트와 동일 톤)
    CHAT_NEW_REQUEST: 'bg-blue-500',
    // 지원 접수 → amber (팀 합류 컨텍스트와 동일 톤)
    APPLICATION_RECEIVED: 'bg-amber-500',
    // 지원 결과 → emerald
    APPLICATION_PROCESSED: 'bg-emerald-500',
  };
  return (
    <span
      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${map[type] ?? 'bg-stone-400'}`}
      aria-hidden
    />
  );
}

/** 간단 시간 포맷 — N분 전 / N시간 전 / 어제 / 날짜 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '방금';
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 2 * day) return '어제';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
