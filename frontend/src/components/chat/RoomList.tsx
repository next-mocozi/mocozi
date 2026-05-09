'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useChatNotifications, useChatSocket } from '@/providers/SocketProvider';
import type { ChatRoomWithMembers, RoomsPageResponse } from '@/types/chat';

/**
 * "+ 새 채팅" 버튼 노출 여부 — Phase A에서 hide.
 *
 * 사유: 모코지의 채팅 진입은 컨텍스트(프로필/팀/포트폴리오) 기반이 정합. 빈 상태 사용자
 * 검색으로 채팅 시작은 어색한 패턴. NewChatModal 코드는 보존 (Phase B 팔로우 도입 시 재활용).
 */
const SHOW_NEW_CHAT_BUTTON = false;

export default function RoomList() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { socket } = useChatSocket();
  const {
    unreadByRoom,
    initFromRooms,
    mutedRoomIds,
    setRoomMuted,
    setRoomUnmuted,
  } = useChatNotifications();

  const [rooms, setRooms] = useState<ChatRoomWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  /** "숨긴 채팅 보기" 토글 — true면 onlyHidden, false면 active만 */
  const [showingHidden, setShowingHidden] = useState(false);
  /** ⋯ 메뉴 열린 방 id (한 번에 하나만) */
  const [openMenuRoomId, setOpenMenuRoomId] = useState<string | null>(null);
  /** 확인 다이얼로그 — 'hide' / 'leave' 행동 + 대상 방 */
  const [confirmAction, setConfirmAction] = useState<{
    type: 'hide' | 'leave';
    room: ChatRoomWithMembers;
  } | null>(null);

  const load = useCallback(
    async (opts: { onlyHidden?: boolean } = {}) => {
      try {
        setError(null);
        setLoading(true);
        const params = new URLSearchParams({ limit: '50' });
        if (opts.onlyHidden) params.set('onlyHidden', 'true');
        const res = await api.get<{ data: RoomsPageResponse }>(
          `/api/chat/rooms?${params.toString()}`,
        );
        const list = res.data.data.rooms;
        setRooms(list);
        initFromRooms(
          list.map((r) => ({
            id: r.id,
            unreadCount: r.unreadCount,
            mutedAt: r.mutedAt,
          })),
        );
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? '채팅방 목록을 불러오지 못했습니다.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [initFromRooms],
  );

  useEffect(() => {
    void load({ onlyHidden: showingHidden });

    if (!socket) return;

    const onConnect = () => void load({ onlyHidden: showingHidden });
    socket.on('connect', onConnect);

    // 새 메시지 도착 — 활성 목록일 때만 lastMessage 갱신
    const onNewMessage = (n: {
      roomId: string;
      preview: string;
      createdAt?: string;
    }) => {
      if (showingHidden) return; // hidden 화면에선 새 메시지가 와도 그대로 hidden
      const ts = n.createdAt ?? new Date().toISOString();
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === n.roomId);
        if (idx === -1) {
          // 새로 만들어진 방 알림이면 활성 목록 재조회
          void load({ onlyHidden: false });
          return prev;
        }
        const updated = {
          ...prev[idx],
          lastMessage: n.preview,
          lastMessageAt: ts,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    };
    socket.on('notification:newMessage', onNewMessage);

    const onRoomLastMessageChanged = (n: {
      roomId: string;
      lastMessage: string | null;
      lastMessageAt: string | null;
    }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === n.roomId
            ? { ...r, lastMessage: n.lastMessage, lastMessageAt: n.lastMessageAt }
            : r,
        ),
      );
    };
    socket.on('notification:roomLastMessageChanged', onRoomLastMessageChanged);

    return () => {
      socket.off('connect', onConnect);
      socket.off('notification:newMessage', onNewMessage);
      socket.off('notification:roomLastMessageChanged', onRoomLastMessageChanged);
    };
  }, [socket, load, showingHidden]);

  // 외부 클릭 시 ⋯ 메뉴 닫기
  useEffect(() => {
    if (!openMenuRoomId) return;
    const onClick = () => setOpenMenuRoomId(null);
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [openMenuRoomId]);

  const handleHide = async (roomId: string) => {
    try {
      await api.post(`/api/chat/rooms/${roomId}/hide`);
      // 활성 목록에서 즉시 제거 (Optimistic)
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      // 백엔드 정책: hide 시 자동 mute. 클라이언트도 mutedRoomIds 갱신
      setRoomMuted(roomId);
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error('[chat] hide failed', e);
    } finally {
      setConfirmAction(null);
    }
  };

  const handleUnhide = async (roomId: string) => {
    try {
      await api.post(`/api/chat/rooms/${roomId}/unhide`);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error('[chat] unhide failed', e);
    }
  };

  const handleMute = async (roomId: string) => {
    // Optimistic — 즉시 set 갱신 + UI 반영
    setRoomMuted(roomId);
    try {
      await api.post(`/api/chat/rooms/${roomId}/mute`);
    } catch (e) {
      setRoomUnmuted(roomId); // 롤백
      // eslint-disable-next-line no-console
      console.error('[chat] mute failed', e);
    }
  };

  const handleUnmute = async (roomId: string) => {
    setRoomUnmuted(roomId);
    try {
      await api.post(`/api/chat/rooms/${roomId}/unmute`);
    } catch (e) {
      setRoomMuted(roomId); // 롤백
      // eslint-disable-next-line no-console
      console.error('[chat] unmute failed', e);
    }
  };

  const handleLeave = async (roomId: string) => {
    try {
      await api.post(`/api/chat/rooms/${roomId}/leave`);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      // 현재 방 보고 있다면 채팅 메인으로
      if (pathname === `/chat/${roomId}`) {
        router.push('/chat');
      }
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error('[chat] leave failed', e);
    } finally {
      setConfirmAction(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-bold">
          {showingHidden ? '숨긴 채팅' : '채팅'}
        </h2>
        {SHOW_NEW_CHAT_BUTTON && !showingHidden && (
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            className="btn-primary text-xs"
          >
            + 새 채팅
          </button>
        )}
        {showingHidden && (
          <button
            type="button"
            onClick={() => setShowingHidden(false)}
            className="text-xs text-primary-600 hover:underline"
          >
            ← 활성 채팅
          </button>
        )}
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
            const menuOpen = openMenuRoomId === room.id;

            return (
              <div
                key={room.id}
                className={`relative flex min-w-0 items-center gap-1 ${
                  isActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <Link
                  href={`/chat/${room.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-base text-primary-600">
                    {room.type === 'DIRECT' ? '👤' : '👥'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1">
                        <h3 className="truncate text-sm font-medium">{displayName}</h3>
                        {mutedRoomIds.has(room.id) && (
                          <span
                            className="shrink-0 text-xs text-gray-400"
                            aria-label="알림 꺼짐"
                            title="알림 꺼짐"
                          >
                            🔕
                          </span>
                        )}
                      </div>
                      {time && (
                        <span className="shrink-0 text-xs text-gray-500">{time}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {/* 미리보기 — 메시지 본문이 multi-line이거나 attachment 마커
                          ([[link:...]])를 포함할 수 있어 한 줄로 요약 + 마커 제거 */}
                      {sanitizePreview(room.lastMessage)}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs text-white">
                      {unread}
                    </span>
                  )}
                </Link>

                {/* ⋯ 메뉴 버튼 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuRoomId(menuOpen ? null : room.id);
                  }}
                  className="mr-2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  aria-label="채팅방 메뉴"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <circle cx="4" cy="10" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="16" cy="10" r="1.5" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-2 top-12 z-10 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 알림 끄기/켜기 — 가벼운 액션이라 다이얼로그 없이 즉시 적용 */}
                    {!showingHidden && (
                      mutedRoomIds.has(room.id) ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-50"
                          onClick={() => {
                            void handleUnmute(room.id);
                            setOpenMenuRoomId(null);
                          }}
                        >
                          알림 켜기
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-50"
                          onClick={() => {
                            void handleMute(room.id);
                            setOpenMenuRoomId(null);
                          }}
                        >
                          알림 끄기
                        </button>
                      )
                    )}
                    {showingHidden ? (
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-50"
                        onClick={() => {
                          void handleUnhide(room.id);
                          setOpenMenuRoomId(null);
                        }}
                      >
                        숨김 해제
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-50"
                        onClick={() => {
                          setConfirmAction({ type: 'hide', room });
                          setOpenMenuRoomId(null);
                        }}
                      >
                        숨기기
                      </button>
                    )}
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setConfirmAction({ type: 'leave', room });
                        setOpenMenuRoomId(null);
                      }}
                    >
                      나가기
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        {!loading && !error && rooms.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-500">
            {showingHidden
              ? '숨긴 채팅이 없습니다.'
              : '아직 채팅 내역이 없습니다.'}
          </div>
        )}
      </div>

      {/* 숨긴 채팅 보기 토글 (활성 목록 하단) */}
      {!showingHidden && (
        <button
          type="button"
          onClick={() => setShowingHidden(true)}
          className="border-t border-gray-200 px-4 py-2 text-center text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          숨긴 채팅 보기
        </button>
      )}

      {/* 확인 다이얼로그 */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">
              {confirmAction.type === 'hide' ? '채팅방 숨기기' : '채팅방 나가기'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {confirmAction.type === 'hide'
                ? '이 방이 목록에서 안 보이게 됩니다. 새 메시지는 계속 받으며, "숨긴 채팅 보기"에서 다시 활성화할 수 있습니다.'
                : '이 방에서 영구히 나갑니다. 이후 새 메시지를 받지 못하고, 다시 들어가려면 다른 멤버의 초대가 필요합니다.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmAction.type === 'hide'
                    ? void handleHide(confirmAction.room.id)
                    : void handleLeave(confirmAction.room.id)
                }
                className={`rounded-lg px-4 py-1.5 text-sm text-white ${
                  confirmAction.type === 'hide'
                    ? 'bg-primary-600 hover:bg-primary-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction.type === 'hide' ? '숨기기' : '나가기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 사이드바 미리보기 텍스트 정제.
 * - 줄바꿈 → 공백 (truncate가 nowrap이라도 multi-line이 시각적으로 어색하게 보일 수 있음)
 * - attachment 마커 [[link:type:target|label]] → label만 남김 (또는 제거)
 * - 연속 공백 압축
 */
function sanitizePreview(raw: string | null | undefined): string {
  if (!raw) return '메시지가 없습니다.';
  const noMarker = raw.replace(/\[\[link:[^|\]]+\|([^\]]+)\]\]/g, '$1');
  const oneLine = noMarker.replace(/\s+/g, ' ').trim();
  return oneLine || '메시지가 없습니다.';
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
