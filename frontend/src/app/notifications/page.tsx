'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useNotificationFeed } from '@/hooks/useNotificationFeed';
import { useAuth } from '@/hooks/useAuth';
import { useChatSocket } from '@/providers/SocketProvider';
import type { Notification, NotificationType } from '@/types/notification';

/**
 * §B-DM-9 알림 전체 목록 페이지.
 *
 * 모바일에선 헤더 사이드바 → 이 페이지로 진입 (헤더 NotificationCenter 아이콘이 hidden md:flex라
 * 모바일엔 dropdown 접근 X). 데스크톱은 dropdown footer "전체 보기"에서도 진입.
 *
 * NotificationCenter dropdown과 동일 데이터(`useNotificationFeed`) + 동일 액션(클릭 read /
 * 일괄 read) — 페이지 형태로 풀어 한 화면에서 검토.
 *
 * 비로그인 게이트는 `/chat`, `/portfolio` 와 동일 패턴: auth loading 끝난 뒤 user 없으면 /login.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { socket } = useChatSocket();
  const { items, loading, error, unreadCount, markRead, markAllRead } =
    useNotificationFeed(socket);

  // 비로그인 게이트
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
  }, [user, authLoading, router]);

  const handleClick = (n: Notification) => {
    if (!n.readAt) void markRead(n.id);
    if (n.linkTo) router.push(n.linkTo);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">알림</h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            모두 읽음
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">
          불러오는 중...
        </p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-500">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          아직 알림이 없어요
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 bg-white">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => handleClick(n)}
                className={`block w-full px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                  n.readAt ? 'text-gray-500' : 'bg-indigo-50/40 text-gray-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  <NotificationTypeBadge type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`break-words ${n.readAt ? '' : 'font-medium'}`}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 break-words text-xs text-gray-500">
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
  );
}

/** type별 색 점 — NotificationCenter dropdown과 동일 톤 (구인=blue, 지원=amber 등) */
function NotificationTypeBadge({ type }: { type: NotificationType }) {
  const map: Record<NotificationType, string> = {
    CHAT_NEW_REQUEST: 'bg-blue-500',
    APPLICATION_RECEIVED: 'bg-amber-500',
    APPLICATION_PROCESSED: 'bg-emerald-500',
  };
  return (
    <span
      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${map[type] ?? 'bg-stone-400'}`}
      aria-hidden
    />
  );
}

/** 간단 시간 포맷 — N분 전/N시간 전/어제/MM/DD */
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
