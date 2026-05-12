'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import type { Notification } from '@/types/notification';
import type { ChatSocket } from './useSocket';

/**
 * §B-DM-9 알림 피드 훅.
 *
 * - mount 시 GET /api/notifications fetch (최신 50개)
 * - socket 'notification:new' listen — 새 알림 도착 시 prepend + unread++
 * - markRead(id) — 클릭 시점에 PATCH + 로컬 readAt 갱신
 * - markAllRead() — 일괄 처리
 *
 * NotificationCenter dropdown이 사용. SocketProvider의 chat unread와 별개 시스템.
 */
export function useNotificationFeed(socket: ChatSocket | null) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 초기 fetch — mount 시 한 번. socket으로 들어오는 신규는 prepend.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: Notification[] }>('/api/notifications')
      .then((res) => {
        if (cancelled) return;
        setItems(res.data?.data ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { data?: { message?: string } } };
        setError(err.response?.data?.message ?? '알림을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // socket 실시간 — 새 알림 들어오면 맨 위에 prepend (이미 있는 id는 중복 방지)
  useEffect(() => {
    if (!socket) return;
    const onNew = (notif: Notification) => {
      // eslint-disable-next-line no-console
      console.info('[ws] notification:new', notif);
      setItems((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
    };
    // socket.io 타입에 notification:new가 등재 안 됨 — emit/listen 모두 string 채널이라 cast.
    (socket as unknown as {
      on: (e: string, cb: (n: Notification) => void) => void;
      off: (e: string, cb: (n: Notification) => void) => void;
    }).on('notification:new', onNew);
    return () => {
      (socket as unknown as {
        on: (e: string, cb: (n: Notification) => void) => void;
        off: (e: string, cb: (n: Notification) => void) => void;
      }).off('notification:new', onNew);
    };
  }, [socket]);

  const markRead = useCallback(async (id: string) => {
    // 낙관적 업데이트 — 즉시 readAt 셋, 실패 시 그대로 둠 (다음 fetch에서 보정)
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n)),
    );
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } catch {
      // ignore — 다음 mount fetch가 정답으로 보정
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    );
    try {
      await api.patch('/api/notifications/read-all');
    } catch {
      // 동일 — 다음 fetch 보정
    }
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;

  return {
    items,
    loading,
    error,
    unreadCount,
    markRead,
    markAllRead,
  };
}
