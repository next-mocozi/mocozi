'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useChatNotifications, useChatSocket } from '@/providers/SocketProvider';
import type { ChatRoomWithMembers, RoomsPageResponse } from '@/types/chat';

/**
 * 채팅방 리스트 페이지
 *
 * 데이터 흐름:
 *  1. 마운트 시 GET /api/chat/rooms → 초기 방 목록
 *  2. unreadByRoom (Context) — 토스트·broadcast로 실시간 갱신
 *  3. socket reconnect 시 onConnect 콜백으로 GET 재호출 (catch-up)
 *
 * 표시 요소:
 *  - 방 이름 (DIRECT면 상대방 이름, GROUP/CHANNEL이면 room.name)
 *  - lastMessage 미리보기
 *  - lastMessageAt 상대 시간
 *  - unreadCount 뱃지 (live)
 */
export default function ChatListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { socket } = useChatSocket();
  const { unreadByRoom, initFromRooms } = useChatNotifications();

  const [rooms, setRooms] = useState<ChatRoomWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  // ---------------------------------------------------------
  // 초기 fetch + reconnect 시 재fetch
  // ---------------------------------------------------------
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
        // unread context에 초기값 일괄 동기화
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

    // 새 메시지 도착 시 — lastMessage / lastMessageAt 즉시 갱신해 리스트 화면 동기화.
    // (unreadCount는 SocketProvider의 useNotifications가 별도로 처리 — 여기선 미리보기만)
    // 사용자 시나리오: "상대방이 채팅을 작성하면 새로고침 전까지 새 내용 안 보임" 버그 fix
    const onNewMessage = (n: {
      roomId: string;
      preview: string;
      // backend가 createdAt을 안 보내는 경우엔 클라이언트 시각으로 fallback
      createdAt?: string;
    }) => {
      const ts = n.createdAt ?? new Date().toISOString();
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === n.roomId);
        if (idx === -1) {
          // 새로 만들어진 방의 알림이면 GET 다시 — 정렬·멤버 정보 일관성 위해
          void load();
          return prev;
        }
        const updated = {
          ...prev[idx],
          lastMessage: n.preview,
          lastMessageAt: ts,
        };
        // 최신 활동 순 정렬 (lastMessageAt desc) — 가장 위로 끌어올림
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return next;
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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">채팅</h1>
        <button
          type="button"
          onClick={() => setNewChatOpen(true)}
          className="btn-primary text-sm"
        >
          + 새 채팅
        </button>
      </div>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        myId={user?.id}
        onCreated={(room) => {
          // 목록 즉시 반영 (이미 있는 방이면 중복 방지) + 해당 방으로 이동
          setRooms((prev) =>
            prev.some((r) => r.id === room.id) ? prev : [room, ...prev],
          );
          router.push(`/chat/${room.id}`);
        }}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {loading && (
          <div className="p-8 text-center text-gray-500">불러오는 중…</div>
        )}

        {!loading &&
          rooms.map((room) => {
            const unread = unreadByRoom[room.id] ?? room.unreadCount;
            const displayName = roomDisplayName(room, user?.id);
            const time = room.lastMessageAt ? timeAgo(room.lastMessageAt) : '';

            return (
              <Link
                key={room.id}
                href={`/chat/${room.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg text-primary-600">
                  {room.type === 'DIRECT' ? '👤' : '👥'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{displayName}</h3>
                    {time && (
                      <span className="text-xs text-gray-500">{time}</span>
                    )}
                  </div>
                  <p className="truncate text-sm text-gray-500">
                    {room.lastMessage ?? '메시지가 없습니다.'}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}

        {!loading && !error && rooms.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            아직 채팅 내역이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 방 표시명 결정:
 *  - GROUP/CHANNEL: room.name
 *  - DIRECT: 상대방 이름 (members 중 본인 아닌 첫 사람)
 *  - 폴백: '대화방'
 *
 * myId 가 정의돼 있으면 본인을 제외하고 상대방 이름 표시.
 * myId 가 아직 로드되기 전(undefined)이면 폴백으로 첫 멤버 사용.
 */
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
    // myId 미로드 시 폴백 — 첫 멤버. 비록 본인이 보일 수도 있지만 useAuth.user 완성되면 자동 교체
    const fallback = room.members[0]?.user?.name;
    if (fallback) return fallback;
  }
  return '대화방';
}
