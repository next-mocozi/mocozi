'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 * (4) muted 방 set — ToastContainer가 토스트 skip 판단용
 * 을 state로 노출.
 *
 * 백엔드 구조:
 *  - 'notification:newMessage'  — 누군가 메시지 보내면 모든 방 멤버의 user:<id>로 broadcast
 *  - 'notification:unreadCountChanged' — 본인이 다른 디바이스에서 읽음 → unreadCount=0 갱신
 *
 * mute는 클라이언트 측 처리:
 *  - GET /rooms 응답의 mutedAt으로 초기화
 *  - mute/unmute 액션 시 set 갱신
 *  - ToastContainer가 mutedRoomIds.has(roomId)면 즉시 dismiss
 */
export function useNotifications(socket: ChatSocket | null) {
  /** 방별 unreadCount. 사이드바 뱃지·총합 계산용 */
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});

  /** 가장 최근 newMessage 알림 (토스트). 표시 후 dismissLatest()로 클리어 */
  const [latestNotification, setLatestNotification] =
    useState<NewMessageNotification | null>(null);

  /** mute된 방 id set — 토스트 skip 판단용 */
  const [mutedRoomIds, setMutedRoomIds] = useState<Set<string>>(() => new Set());

  /**
   * mutedRoomIds를 socket listener에서 stale closure 없이 참조하기 위한 ref.
   * useEffect deps에 mutedRoomIds 넣으면 listener가 매번 재등록됨 — 비효율.
   * ref로 최신 값 추적하면 listener는 한 번만 등록되고도 항상 최신 set 참조.
   */
  const mutedRoomIdsRef = useRef(mutedRoomIds);
  useEffect(() => {
    mutedRoomIdsRef.current = mutedRoomIds;
  }, [mutedRoomIds]);

  // ---------------------------------------------------------
  // socket listener 등록 / 해제
  // ---------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (n: NewMessageNotification) => {
      // eslint-disable-next-line no-console
      console.info('[ws] notification:newMessage', n);
      setUnreadByRoom((prev) => ({ ...prev, [n.roomId]: n.unreadCount }));
      // mute된 방은 latestNotification 자체에 set 안 함 — 토스트 깜빡임 방지
      // (ToastContainer가 render에서 한 번 더 가드 — 이중 안전망)
      if (!mutedRoomIdsRef.current.has(n.roomId)) {
        setLatestNotification(n);
      }
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
  // 외부 갱신 helpers
  // ---------------------------------------------------------
  const setRoomUnread = useCallback((roomId: string, count: number) => {
    setUnreadByRoom((prev) => ({ ...prev, [roomId]: count }));
  }, []);

  /** 토스트 닫기 (다음 알림 도착 전까지 latestNotification = null) */
  const dismissLatest = useCallback(() => setLatestNotification(null), []);

  /**
   * 채팅방 목록 GET 직후에 일괄 초기화. unreadCount + mutedAt 동시에.
   *
   * mutedAt이 있는 방은 mutedRoomIds set에 등록 → 이후 토스트 도착 시 skip.
   */
  const initFromRooms = useCallback(
    (
      rooms: Array<{
        id: string;
        unreadCount: number;
        mutedAt?: string | null;
      }>,
    ) => {
      const unreadMap: Record<string, number> = {};
      const muted = new Set<string>();
      for (const r of rooms) {
        unreadMap[r.id] = r.unreadCount;
        if (r.mutedAt) muted.add(r.id);
      }
      setUnreadByRoom(unreadMap);
      setMutedRoomIds(muted);
    },
    [],
  );

  /** mute 액션 후 — set에 추가 (낙관적). 실패 시 호출 측에서 setRoomUnmuted 호출 */
  const setRoomMuted = useCallback((roomId: string) => {
    setMutedRoomIds((prev) => {
      if (prev.has(roomId)) return prev;
      const next = new Set(prev);
      next.add(roomId);
      return next;
    });
  }, []);

  /** unmute 액션 후 — set에서 제거 */
  const setRoomUnmuted = useCallback((roomId: string) => {
    setMutedRoomIds((prev) => {
      if (!prev.has(roomId)) return prev;
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

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
    /** GET /rooms 응답 배열로부터 일괄 초기화 (unread + mute 동시) */
    initFromRooms,
    /** mute된 방 id set — ToastContainer가 토스트 skip 판단 */
    mutedRoomIds,
    /** 액션 후 set 갱신 — 낙관적 업데이트 */
    setRoomMuted,
    setRoomUnmuted,
  };
}
