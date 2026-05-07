'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  NewMessageNotification,
  UnreadCountChangedNotification,
} from '@/types/chat';
import type { ChatSocket } from './useSocket';

/**
 * 인앱 알림 관리 훅
 *
 * useSocket으로 얻은 socket을 입력으로 받아 글로벌 알림을 listen하고
 * (1) 방별 unreadCount 맵
 * (2) 가장 최근 newMessage (토스트용)
 * (3) 전체 unread 합계 (사이드바 빨간 점)
 * 를 state로 노출.
 *
 * 백엔드 구조:
 *  - 'notification:newMessage'  — 누군가 메시지 보내면 모든 방 멤버의 user:<id>로 broadcast
 *  - 'notification:unreadCountChanged' — 본인이 다른 디바이스에서 읽음 → unreadCount=0 갱신
 *
 * 사용 패턴 — 앱 layout.tsx 같은 최상위에서 한 번만 호출:
 *   const { socket } = useSocket();
 *   const { totalUnread, latestNotification, dismissLatest, setRoomUnread } =
 *     useNotifications(socket);
 *
 * 채팅방 목록 GET 직후엔 setRoomUnread로 초기값 동기화 권장.
 */
export function useNotifications(socket: ChatSocket | null) {
  /** 방별 unreadCount. 사이드바 뱃지·총합 계산용 */
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});

  /** 가장 최근 newMessage 알림 (토스트). 표시 후 dismissLatest()로 클리어 */
  const [latestNotification, setLatestNotification] =
    useState<NewMessageNotification | null>(null);

  // ---------------------------------------------------------
  // socket listener 등록 / 해제
  // ---------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (n: NewMessageNotification) => {
      // eslint-disable-next-line no-console
      console.info('[ws] notification:newMessage', n);
      setUnreadByRoom((prev) => ({ ...prev, [n.roomId]: n.unreadCount }));
      // 가장 최근 알림 갱신 — UI는 dismissLatest 또는 다음 알림 도착 시 교체
      setLatestNotification(n);
    };

    const onUnreadChanged = (n: UnreadCountChangedNotification) => {
      // eslint-disable-next-line no-console
      console.info('[ws] notification:unreadCountChanged', n);
      setUnreadByRoom((prev) => ({ ...prev, [n.roomId]: n.unreadCount }));
    };

    socket.on('notification:newMessage', onNewMessage);
    socket.on('notification:unreadCountChanged', onUnreadChanged);

    return () => {
      socket.off('notification:newMessage', onNewMessage);
      socket.off('notification:unreadCountChanged', onUnreadChanged);
    };
  }, [socket]);

  // ---------------------------------------------------------
  // 외부 갱신 — REST 응답에서 받은 unreadCount를 반영하거나, 사용자가 방에 들어가
  // 자동 읽음 처리되어 0으로 갱신해야 할 때
  // ---------------------------------------------------------
  const setRoomUnread = useCallback((roomId: string, count: number) => {
    setUnreadByRoom((prev) => ({ ...prev, [roomId]: count }));
  }, []);

  /** 토스트 닫기 (다음 알림 도착 전까지 latestNotification = null) */
  const dismissLatest = useCallback(() => setLatestNotification(null), []);

  /** 채팅방 목록 GET 직후에 일괄 초기화하기 좋은 helper */
  const initFromRooms = useCallback(
    (rooms: Array<{ id: string; unreadCount: number }>) => {
      const map: Record<string, number> = {};
      for (const r of rooms) map[r.id] = r.unreadCount;
      setUnreadByRoom(map);
    },
    [],
  );

  // 전체 unread 합계 — 사이드바 "안 읽은 방 있음" 빨간 점 표시용
  const totalUnread = Object.values(unreadByRoom).reduce(
    (sum, n) => sum + n,
    0,
  );

  return {
    /** 방 ID → unreadCount 맵 */
    unreadByRoom,
    /** 전체 unread 합 (≥ 1이면 사이드바 빨간 점) */
    totalUnread,
    /** 가장 최근 newMessage 알림. 토스트로 표시. 없으면 null */
    latestNotification,
    /** 토스트 닫기 */
    dismissLatest,
    /** 외부 (REST 응답 등)에서 특정 방 unread 직접 설정 */
    setRoomUnread,
    /** GET /rooms 응답 배열로부터 일괄 초기화 */
    initFromRooms,
  };
}
