'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useChatNotifications } from '@/providers/SocketProvider';

/**
 * 인앱 알림 토스트
 *
 * 동작:
 *  - SocketProvider의 `latestNotification` 구독
 *  - 새 메시지 도착 시 우측 상단에 토스트 (3초 자동 닫힘)
 *  - 클릭 시 해당 방으로 이동
 *  - 현재 보고 있는 방의 알림은 즉시 dismiss (토스트 안 띄움)
 *
 * 사용: layout.tsx에 한 번 마운트
 */
export function ToastContainer() {
  const { latestNotification, dismissLatest, mutedRoomIds, hiddenRoomIds } =
    useChatNotifications();
  const pathname = usePathname();
  const router = useRouter();

  // 현재 보고 있는 방 / mute된 방 / hidden인 방의 알림은 모두 skip
  useEffect(() => {
    if (!latestNotification) return;

    const currentRoomId = pathname?.startsWith('/chat/')
      ? pathname.slice('/chat/'.length).split('/')[0]
      : null;

    if (currentRoomId === latestNotification.roomId) {
      dismissLatest();
      return;
    }

    // mute된 방 또는 hidden인 방 — 토스트 skip (unreadCount는 useNotifications에서 갱신됨)
    if (
      mutedRoomIds.has(latestNotification.roomId) ||
      hiddenRoomIds.has(latestNotification.roomId)
    ) {
      dismissLatest();
      return;
    }

    const timer = setTimeout(dismissLatest, 3000);
    return () => clearTimeout(timer);
  }, [
    latestNotification,
    pathname,
    dismissLatest,
    mutedRoomIds,
    hiddenRoomIds,
  ]);

  if (!latestNotification) return null;

  // 위 effect에서 dismiss 호출됐어도 다음 렌더에 반영. 명시 가드 한 번 더.
  const currentRoomId = pathname?.startsWith('/chat/')
    ? pathname.slice('/chat/'.length).split('/')[0]
    : null;
  if (currentRoomId === latestNotification.roomId) return null;
  if (mutedRoomIds.has(latestNotification.roomId)) return null;
  if (hiddenRoomIds.has(latestNotification.roomId)) return null;

  const displayTitle =
    latestNotification.roomName ?? latestNotification.senderName;

  return (
    <button
      type="button"
      onClick={() => {
        router.push(`/chat/${latestNotification.roomId}`);
        dismissLatest();
      }}
      className="fixed right-4 top-20 z-[60] flex max-w-sm flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg transition-shadow hover:shadow-xl"
      aria-label={`새 메시지: ${latestNotification.senderName}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-900">
          {displayTitle}
        </span>
        {latestNotification.unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs text-white">
            {latestNotification.unreadCount}
          </span>
        )}
      </div>
      <p className="truncate text-sm text-gray-600">
        {latestNotification.senderName}: {latestNotification.preview}
      </p>
    </button>
  );
}
