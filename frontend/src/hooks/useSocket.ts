'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  EditMessagePayload,
  ReactionPayload,
  SendMessagePayload,
  ServerToClientEvents,
} from '@/types/chat';

/**
 * 모코지 채팅 Socket.IO 클라이언트 훅
 *
 * 변경점 (Day 8):
 * - namespace 제거 (백엔드도 default namespace 사용)
 * - handshake `auth: { token }` 적용 (WsJwtGuard 통과)
 * - 이벤트 이름: conversation:* / message:* (서버 spec와 일치)
 * - 메서드 시그니처에서 senderId 제거 (서버가 토큰에서 추출)
 * - SocketEvents 타입 적용으로 emit/on 모두 컴파일 타임 체크
 * - 'exception' 이벤트 자동 listen (디버그·UX용)
 * - 토큰 만료 시 자동 logout 리다이렉트 (refresh는 인증 모듈 도입 후 도입 예정)
 *
 * 참고: docs/chat/05-api-spec.md §2
 */

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  /**
   * 인증 토큰. 미지정 시 localStorage('accessToken')에서 자동 로드.
   * 토큰 없으면 connect 안 함.
   */
  token?: string;

  /**
   * 토큰 만료(connect_error 'Unauthorized') 시 호출. 기본은 logout 리다이렉트.
   * 추후 refresh token 흐름이 추가되면 여기서 갈아끼우고 reconnect.
   */
  onAuthError?: () => void;

  /**
   * 자동 연결 끄고 싶을 때 false. 기본 true.
   */
  autoConnect?: boolean;

  /**
   * 매 connect 시점에 호출 (최초 + 재연결).
   *
   * 재연결 시 catch-up 패턴:
   *  - re-emit 'conversation:join' for 현재 보고 있는 방 (서버 socket room은 disconnect 시 사라짐)
   *  - fetch GET /api/chat/rooms (사이드바 unreadCount 재동기화)
   *  - 옵션) GET /api/chat/rooms/:id/messages?cursor=... 로 누락 메시지 catch-up
   *
   * `info.reconnect`는 최초 연결이 아니라 재연결인지 구분. 콜러가 분기 처리 가능.
   */
  onConnect?: (info: { reconnect: boolean }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { onAuthError, onConnect, autoConnect = true } = options;

  const socketRef = useRef<ChatSocket | null>(null);
  /** 한 번이라도 connect된 적 있는지 추적 — 다음 connect는 reconnect로 분류 */
  const hasConnectedOnceRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastException, setLastException] = useState<{
    code: string;
    message: string;
  } | null>(null);

  // ---------------------------------------------------------
  // 연결 / 해제
  // ---------------------------------------------------------
  useEffect(() => {
    if (!autoConnect) return;

    const token =
      options.token ??
      (typeof window !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null);
    if (!token) {
      // 토큰 없으면 연결 안 함. 로그인 화면 진입 등 비인증 상태에서 호출되는 케이스
      return;
    }

    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

    // Railway 같은 호스팅에서 wss 핸드셰이크 실패 시 polling으로 fallback
    // 순서: websocket 먼저 시도 → 실패 시 polling으로 자동 전환
    const socket: ChatSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // transport upgrade 추적 (polling → websocket)
    socket.io.engine?.on('upgrade', (transport: { name: string }) => {
      // eslint-disable-next-line no-console
      console.info('[ws] transport upgraded to', transport.name);
    });

    socket.on('connect', () => {
      setIsConnected(true);
      const isReconnect = hasConnectedOnceRef.current;
      hasConnectedOnceRef.current = true;
      const transport = socket.io.engine?.transport?.name ?? 'unknown';
      // eslint-disable-next-line no-console
      console.info(
        '[ws]',
        isReconnect ? 'reconnected' : 'connected',
        'via',
        transport,
      );
      if (onConnect) onConnect({ reconnect: isReconnect });
    });
    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      // eslint-disable-next-line no-console
      console.info('[ws] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      const message = err?.message ?? '';
      if (message === 'Unauthorized' || message.toLowerCase().includes('unauthorized')) {
        // socket connect_error("Unauthorized") 발생 케이스:
        //   1) 토큰 만료/위조 → HTTP 인터셉터가 refresh 시도, 실패 시 로그아웃
        //   2) 백엔드 일시 장애 / DB 지연 / startup race → transient
        //   3) 새로고침 중 socket 끊김 → transient
        // 토큰 정리는 HTTP 측이 담당 (더 신뢰성 높은 판단). 여기선 socket 무한 재시도만 차단.
        socket.disconnect();
        if (onAuthError) {
          onAuthError();
        }
      }
    });

    socket.on('exception', (err) => {
      setLastException({ code: err.code, message: err.message });
      // 디버그 — 콘솔에도 출력
      // eslint-disable-next-line no-console
      console.warn('[ws exception]', err);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // options.token 변경 시 재연결, onAuthError는 의도적 제외 (콜백 정체성 변동에 휘둘리지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, options.token]);

  // ---------------------------------------------------------
  // 액션 — 모든 메서드는 socket이 없으면 no-op
  // (refs로 잡아서 콜러 측 의존성 변동 회피)
  // ---------------------------------------------------------

  const joinConversation = useCallback((roomId: string) => {
    return new Promise<{ ok: boolean; roomId: string; unreadCount: number }>(
      (resolve) => {
        if (!socketRef.current) return resolve({ ok: false, roomId, unreadCount: 0 });
        socketRef.current.emit('conversation:join', { roomId }, (res) => {
          resolve(res ?? { ok: false, roomId, unreadCount: 0 });
        });
      },
    );
  }, []);

  const leaveConversation = useCallback((roomId: string) => {
    socketRef.current?.emit('conversation:leave', { roomId });
  }, []);

  const sendMessage = useCallback((payload: SendMessagePayload) => {
    return new Promise<unknown>((resolve) => {
      if (!socketRef.current) return resolve(null);
      socketRef.current.emit('message:send', payload, (msg) => resolve(msg));
    });
  }, []);

  const editMessage = useCallback((payload: EditMessagePayload) => {
    return new Promise<unknown>((resolve) => {
      if (!socketRef.current) return resolve(null);
      socketRef.current.emit('message:edit', payload, (msg) => resolve(msg));
    });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    return new Promise<unknown>((resolve) => {
      if (!socketRef.current) return resolve(null);
      socketRef.current.emit('message:delete', { messageId }, (res) =>
        resolve(res),
      );
    });
  }, []);

  const markAsRead = useCallback((roomId: string, messageId: string) => {
    return new Promise<{ ok: boolean; unreadCount: number }>((resolve) => {
      if (!socketRef.current) return resolve({ ok: false, unreadCount: 0 });
      socketRef.current.emit('message:read', { roomId, messageId }, (res) =>
        resolve(res ?? { ok: false, unreadCount: 0 }),
      );
    });
  }, []);

  const addReaction = useCallback((payload: ReactionPayload) => {
    return new Promise<unknown>((resolve) => {
      if (!socketRef.current) return resolve(null);
      socketRef.current.emit('reaction:add', payload, (r) => resolve(r));
    });
  }, []);

  const removeReaction = useCallback((payload: ReactionPayload) => {
    return new Promise<unknown>((resolve) => {
      if (!socketRef.current) return resolve(null);
      socketRef.current.emit('reaction:remove', payload, (res) => resolve(res));
    });
  }, []);

  /**
   * 타이핑 인디케이터 emit — fire-and-forget. ack 불필요 (휘발성).
   * 호출자는 textarea onChange에서 debounce + idle timeout으로 false 자동 호출.
   */
  const emitTyping = useCallback((roomId: string, isTyping: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.emit('typing:update', { roomId, isTyping });
  }, []);

  return {
    /** 현재 socket 인스턴스 (이벤트 listen에 직접 활용 가능) */
    socket: socketRef.current,
    isConnected,
    /** 가장 최근에 받은 'exception' 이벤트 (디버그·UI 표시용). 새 발생 시 갱신 */
    lastException,

    // 액션
    joinConversation,
    leaveConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    addReaction,
    removeReaction,
    emitTyping,
  };
}
