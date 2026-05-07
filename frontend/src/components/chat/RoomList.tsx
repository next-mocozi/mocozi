'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useChatNotifications, useChatSocket } from '@/providers/SocketProvider';
import type { ChatRoomWithMembers, RoomsPageResponse } from '@/types/chat';

export default function RoomList() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { socket } = useChatSocket();
  const { unreadByRoom, initFromRooms } = useChatNotifications();

  const [rooms, setRooms] = useState<ChatRoomWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setError(null);
        const res = await api.get<{ data: RoomsPageResponse }>(
          '/api/chat/rooms?limit=50',
        );
        if (cancelled) return;
        const list = res.data.data.rooms;
        setRooms(list);
        initFromRooms(list.map((r) => ({ id: r.id, unreadCount: r.unreadCount })));
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? '채팅방 목록을 불러오지 못했습니다.';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    if (!socket) {
      return () => {
        cancelled = true;
      };
    }

    // socket 재연결 시 다시 fetch (누락된 동안의 사이드바 동기화)
    const onConnect = () => void load();
    socket.on('connect', onConnect);

    // 새 메시지 도착 시 — 해당 방의 lastMessage / lastMessageAt 즉시 갱신해 리스트 동기화
    // (unreadCount는 SocketProvider의 useNotifications가 별도로 처리)
    const onNewMessage = (n: {
      roomId: string;
      preview: string;
      createdAt?: string;
    }) => {
      const ts = n.createdAt ?? new Date().toISOString();
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === n.roomId);
        if (idx === -1) {
          // 새로 만들어진 방의 알림이면 GET 재호출
          void load();
          return prev;
        }
        const updated = {
          ...prev[idx],
          lastMessage: n.preview,
          lastMessageAt: ts,
        };
        // 최신 활동 순 (lastMessageAt desc) — 가장 위로
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    };

    socket.on('notification:newMessage', onNewMessage);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('notification:newMessage', onNewMessage);
    };
  }, [socket, initFromRooms]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-bold">채팅</h2>
        <button
          type="button"
          onClick={() => setNewChatOpen(true)}
          className="btn-primary text-xs"
        >
          + 새 채팅
        </button>
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        myId={user?.id}
        onCreated={(room) => {
          setRooms((prev) =>
            prev.some((r) => r.id === room.id) ? prev : [room, ...prev],
          );
          router.push(`/chat/${room.id}`);
        }}
      />

      {error && (
        <div className="m-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 divide-y divide-gray-200 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-sm text-gray-500">불러오는 중…</div>
        )}

        {!loading &&
          rooms.map((room) => {
            const unread = unreadByRoom[room.id] ?? room.unreadCount;
            const displayName = roomDisplayName(room, user?.id);
            const time = room.lastMessageAt ? timeAgo(room.lastMessageAt) : '';
            const isActive = pathname === `/chat/${room.id}`;

            return (
              <Link
                key={room.id}
                href={`/chat/${room.id}`}
                className={`flex items-center gap-3 p-3 transition-colors ${
                  isActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-base text-primary-600">
                  {room.type === 'DIRECT' ? '👤' : '👥'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-medium">{displayName}</h3>
                    {time && (
                      <span className="shrink-0 text-xs text-gray-500">{time}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {room.lastMessage ?? '메시지가 없습니다.'}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}

        {!loading && !error && rooms.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">
            아직 채팅 내역이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function roomDisplayName(
  room: ChatRoomWithMembers,
  myId: string | undefined,
): string {
  if (room.name) return room.name;
  if (room.type === 'DIRECT' && room.members.length > 0) {
    if (myId) {
      const other = room.members.find((m) => m.userId !== myId);
      if (other?.user?.name) return other.user.name;
    }
    const fallback = room.members[0]?.user?.name;
    if (fallback) return fallback;
  }
  return '대화방';
}
