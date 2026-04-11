'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/** Socket.IO 연결 훅 - 실시간 채팅용 */
export function useSocket(namespace = '/chat') {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

    socketRef.current = io(`${socketUrl}${namespace}`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [namespace]);

  /** 채팅방 입장 */
  const joinRoom = (roomId: string) => {
    socketRef.current?.emit('joinRoom', roomId);
  };

  /** 채팅방 퇴장 */
  const leaveRoom = (roomId: string) => {
    socketRef.current?.emit('leaveRoom', roomId);
  };

  /** 메시지 전송 */
  const sendMessage = (roomId: string, senderId: string, content: string) => {
    socketRef.current?.emit('sendMessage', { roomId, senderId, content });
  };

  return {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage,
  };
}
