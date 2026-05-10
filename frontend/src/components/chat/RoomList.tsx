'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import {
  ArrowLeftIcon,
  BellOffIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons/ChatIcons';
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
    setRoomHidden,
    setRoomUnhidden,
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
          // 활성 목록에 없는 방의 알림 — 다음 셋 중 하나:
          //  (a) 사용자가 hide한 방 (가장 흔함). 의도적으로 가린 것이므로 갱신 X
          //  (b) 다른 사람이 사용자를 새 방에 초대했음 (Phase B 시나리오, Phase A에서는 거의 없음)
          //  (c) 사용자가 막 만든 방 — NewChatModal.onCreated에서 이미 setRooms로 처리됨
          // → 매번 GET /rooms로 reload하면 hide 방 알림이 올 때마다 "불러오는 중..." 깜빡임 발생.
          //   socket 재연결(onConnect) 또는 페이지 이동 시 자연스럽게 load되므로 여기선 무시.
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
      // 토스트 차단 — hide 자체가 알림 차단 효과 (mute와 별개)
      // 숨김 해제 시 hide 전 mute 상태로 자연 복귀 — mutedRoomIds는 안 건드림
      setRoomHidden(roomId);
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
      // 숨김 목록에서 즉시 제거 (Optimistic)
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      // hiddenRoomIds set에서 해제 — mutedRoomIds는 hide 전 상태 그대로 유지
      // 즉 hide 전 명시 mute였다면 unhide 후에도 mute / 아니었으면 알림 정상
      setRoomUnhidden(roomId);
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
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
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
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            <ArrowLeftIcon className="h-3 w-3" />
            <span>활성 채팅</span>
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

      <div className="flex-1 divide-y divide-slate-200 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-sm text-slate-500">불러오는 중…</div>
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
                  isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <Link
                  href={`/chat/${room.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    {room.type === 'DIRECT' ? (
                      <UserIcon className="h-5 w-5" />
                    ) : (
                      <UsersIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1">
                        <h3 className="truncate text-sm font-medium">{displayName}</h3>
                        {mutedRoomIds.has(room.id) && (
                          <BellOffIcon
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-label="알림 꺼짐"
                          />
                        )}
                      </div>
                      {time && (
                        <span className="shrink-0 text-xs text-slate-500">{time}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {/* 미리보기 — 메시지 본문이 multi-line이거나 attachment 마커
                          ([[link:...]])를 포함할 수 있어 한 줄로 요약 + 마커 제거 */}
                      {sanitizePreview(room.lastMessage)}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs text-white">
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
                  className="mr-2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
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
                    className="absolute right-2 top-12 z-10 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 알림 끄기/켜기 — 가벼운 액션이라 다이얼로그 없이 즉시 적용 */}
                    {!showingHidden && (
                      mutedRoomIds.has(room.id) ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
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
                          className="block w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
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
                        className="block w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
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
                        className="block w-full px-3 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
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
          <div className="p-6 text-center text-sm text-slate-500">
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
          className="border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
            <h3 className="text-base font-semibold text-slate-900">
              {confirmAction.type === 'hide' ? '채팅방 숨기기' : '채팅방 나가기'}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {confirmAction.type === 'hide'
                ? '이 방이 목록에서 안 보이게 됩니다. 새 메시지는 계속 받으며, "숨긴 채팅 보기"에서 다시 활성화할 수 있습니다.'
                : '이 방에서 영구히 나갑니다. 이후 새 메시지를 받지 못하고, 다시 들어가려면 다른 멤버의 초대가 필요합니다.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
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
                    ? 'bg-indigo-600 hover:bg-indigo-700'
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
