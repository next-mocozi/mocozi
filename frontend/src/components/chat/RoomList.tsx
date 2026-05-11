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
import { summarizePreview } from '@/lib/messageTemplate';
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

/**
 * 같은 탭 세션 내에 RoomList가 한 번이라도 데이터 로드 완료했는지 추적 (모드별).
 *
 * useRef는 컴포넌트 인스턴스 lifecycle에 묶여서, `/chat ↔ /chat/[roomId]` 라우팅처럼
 * RoomList가 unmount/remount되면 ref도 false로 리셋 → 매 진입마다 "불러오는 중..." 깜빡임.
 * module-level let은 페이지 라우팅에도 살아남아 첫 진입(또는 hard reload/새 탭)에서만 spinner.
 *
 * 활성/숨김 모드는 응답이 분리되므로 각각 추적. 모드 토글 직후엔 명시 spinner 1회 유지
 * (toggleHidden가 setLoading(true)), 같은 모드 내 remount는 silent.
 */
let hasLoadedActiveInSession = false;
let hasLoadedHiddenInSession = false;

/**
 * 모드별 방 목록 캐시 — RoomList unmount/remount 시 새 인스턴스의 lazy initializer에서
 * 즉시 이전 데이터를 보여주고 fetch는 background로 갱신 (사용자 체감상 깜빡임 0).
 *
 * 활성/숨김 응답은 분리되므로 각각 캐시. 모드 토글 후 첫 진입은 명시 spinner라 cache 없어도 OK,
 * 같은 모드 내 라우팅 후엔 cache로 즉시 표시 + silent refresh.
 */
let cachedActiveRooms: ChatRoomWithMembers[] | null = null;
let cachedHiddenRooms: ChatRoomWithMembers[] | null = null;

/**
 * 같은 탭 세션 내 "숨긴 채팅 보기" 모드 유지.
 *
 * - 페이지 라우팅(`/chat` ↔ `/chat/[roomId]`): module-level let으로 유지
 * - hard reload / 새 페이지 진입: sessionStorage에서 mount 후 복원 (hydration mismatch 회피
 *   위해 useEffect에서 sync — SSR 시점엔 항상 false로 server/client 일치)
 * - 새 탭: sessionStorage 별개 → 활성으로 시작 (각 탭 독립 — localStorage 안 씀)
 * - "활성 채팅" 버튼: 명시적 복귀
 */
const SHOWING_HIDDEN_KEY = 'mocozi:chat-showing-hidden';
let lastShowingHidden = false;

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

  /**
   * "숨긴 채팅 보기" 토글 — true면 onlyHidden, false면 active만.
   * 마운트 초기값은 module-level `lastShowingHidden` (페이지 라우팅 후에도 모드 유지).
   */
  const [showingHidden, setShowingHidden] = useState(() => lastShowingHidden);

  // lazy initializer로 모드별 cache 즉시 복구.
  const [rooms, setRooms] = useState<ChatRoomWithMembers[]>(() =>
    showingHidden ? (cachedHiddenRooms ?? []) : (cachedActiveRooms ?? []),
  );
  // 모드별 첫 호출이면 spinner, 같은 모드 후속 마운트면 silent.
  const [loading, setLoading] = useState(
    showingHidden ? !hasLoadedHiddenInSession : !hasLoadedActiveInSession,
  );
  const [error, setError] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  /** ⋯ 메뉴 열린 방 id (한 번에 하나만) */
  const [openMenuRoomId, setOpenMenuRoomId] = useState<string | null>(null);
  /** 확인 다이얼로그 — 'hide' / 'leave' 행동 + 대상 방 */
  const [confirmAction, setConfirmAction] = useState<{
    type: 'hide' | 'leave';
    room: ChatRoomWithMembers;
  } | null>(null);

  const load = useCallback(
    async (opts: { onlyHidden?: boolean } = {}) => {
      const isHidden = opts.onlyHidden === true;
      try {
        setError(null);
        // 모드별 첫 호출만 spinner. 이후 refetch(socket 재연결, page 라우팅 remount,
        // useEffect deps 변경)는 silent — cache로 즉시 표시 + 백그라운드 갱신.
        // toggleHidden(모드 전환)에선 별도로 setLoading(true)를 명시 호출.
        if (isHidden ? !hasLoadedHiddenInSession : !hasLoadedActiveInSession) {
          setLoading(true);
        }
        const params = new URLSearchParams({ limit: '50' });
        if (isHidden) params.set('onlyHidden', 'true');
        const res = await api.get<{ data: RoomsPageResponse }>(
          `/api/chat/rooms?${params.toString()}`,
        );
        const list = res.data.data.rooms;
        setRooms(list);
        // 모드별 캐시 — 다음 remount 시 즉시 복구
        if (isHidden) cachedHiddenRooms = list;
        else cachedActiveRooms = list;
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
        // 모드별 첫 로드 flag 갱신 — 다음 마운트가 silent로 시작
        if (isHidden) hasLoadedHiddenInSession = true;
        else hasLoadedActiveInSession = true;
      }
    },
    [initFromRooms],
  );

  // 마운트 후 sessionStorage에서 숨김 모드 복원 — SSR/hydration mismatch 회피 위해
  // 초기 state는 false로 두고 effect에서 sync. 페이지 라우팅 후 remount는 module-level
  // lastShowingHidden로 즉시 복원되므로 storage read는 fallback (모듈 새로 로드된 경우).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(SHOWING_HIDDEN_KEY) === '1';
      if (stored && !showingHidden) {
        lastShowingHidden = true;
        setShowingHidden(true);
      }
    } catch {
      // private mode 등 storage 접근 실패 — fallback으로 false 유지
    }
    // 마운트 시점 1회만 — toggleHidden은 별도로 storage write
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load({ onlyHidden: showingHidden });

    if (!socket) return;

    const onConnect = () => void load({ onlyHidden: showingHidden });
    socket.on('connect', onConnect);

    // 새 메시지 도착 — 현재 보고 있는 모드(활성/숨김)의 rooms에 해당 방이 있으면 lastMessage 갱신.
    // 활성 모드면 hide 안 한 방들만 rooms에 있고, 숨김 모드면 hide한 방들만. 각각 자기 모드 방의
    // 새 메시지는 실시간 반영.
    const onNewMessage = (n: {
      roomId: string;
      preview: string;
      createdAt?: string;
    }) => {
      const ts = n.createdAt ?? new Date().toISOString();
      setRooms((prev) => {
        const idx = prev.findIndex((r) => r.id === n.roomId);
        if (idx === -1) {
          // 현재 모드 목록에 없는 방의 알림 — 다음 중 하나:
          //  (a) 다른 모드(숨김↔활성)의 방. 갱신 X — 그 모드 진입 시 fetch로 자연 동기화
          //  (b) 다른 사람이 사용자를 새 방에 초대 (Phase B 시나리오)
          //  (c) 사용자가 막 만든 방 — NewChatModal.onCreated에서 이미 setRooms로 처리됨
          // → 매번 GET /rooms로 reload하면 깜빡임 발생. socket 재연결(onConnect) 또는 페이지
          //   이동 시 자연스럽게 load되므로 여기선 무시.
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

  // rooms 변경 시 module cache 동기화 — 모드별로 갈래.
  // socket onNewMessage / handleHide / handleLeave 등 모든 setRooms 호출을 자동 캐치.
  // 가드:
  //  - hasLoaded*=false (아직 첫 fetch 전) — 빈 배열로 덮지 않음
  //  - rooms.length === 0 — toggleHidden 시 의도적 비움 / 전환 중 — cache는 직전 데이터 유지
  useEffect(() => {
    if (rooms.length === 0) return;
    if (showingHidden && hasLoadedHiddenInSession) {
      cachedHiddenRooms = rooms;
    } else if (!showingHidden && hasLoadedActiveInSession) {
      cachedActiveRooms = rooms;
    }
  }, [rooms, showingHidden]);

  /**
   * "숨긴 채팅 보기" ↔ "활성 채팅" 토글.
   *
   * - setRooms([])로 즉시 비움: 토글 직후 옛 rooms가 visibleRooms 필터 우회로 raw 노출되는
   *   깜빡임 회피
   * - setLoading(true)로 명시 spinner: 빈 list가 "아직 채팅 내역이 없습니다"로 잘못 신호되는 것
   *   회피. fetch 완료(load의 finally)에서 자동 setLoading(false)
   */
  const toggleHidden = useCallback((next: boolean) => {
    lastShowingHidden = next; // module-level과 동기화 — 다음 마운트가 이 모드로 시작
    // sessionStorage에도 영속 — hard reload 후에도 모드 유지 (탭 단위)
    if (typeof window !== 'undefined') {
      try {
        if (next) window.sessionStorage.setItem(SHOWING_HIDDEN_KEY, '1');
        else window.sessionStorage.removeItem(SHOWING_HIDDEN_KEY);
      } catch {
        // private mode 등 storage 접근 실패 — 무시 (module-level만으로 fallback)
      }
    }
    setRooms([]);
    setLoading(true);
    setShowingHidden(next);
  }, []);

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
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
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
            onClick={() => toggleHidden(false)}
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

      {/* 빈 방(메시지 0개) 자동 숨김 정책 — docs/chat 정책 참조:
          - 메시지 1개 이상이면 표시
          - OR 본인이 그 방에 draft 작성 중이면 표시 (의도 보존)
          - 둘 다 아니면 숨김 (양쪽 멤버 모두 동일 동작)
          - "숨긴 채팅" 화면(showingHidden)에선 이 필터 우회 — 명시 숨김한 빈 방도 표시 */}
      {(() => {
        const visibleRooms = showingHidden
          ? rooms
          : rooms.filter((room) => {
              if (room.lastMessage) return true;
              if (typeof window !== 'undefined') {
                try {
                  const draft = localStorage.getItem(`chat-draft-${room.id}`);
                  if (draft && draft.trim()) return true;
                } catch {
                  // private mode 등 storage 접근 실패 — 무시
                }
              }
              return false;
            });
        return (
      <div className="flex-1 divide-y divide-stone-200 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-sm text-stone-500">불러오는 중…</div>
        )}

        {!loading &&
          visibleRooms.map((room) => {
            const unread = unreadByRoom[room.id] ?? room.unreadCount;
            const displayName = roomDisplayName(room, user?.id);
            const time = room.lastMessageAt ? timeAgo(room.lastMessageAt) : '';
            const isActive = pathname === `/chat/${room.id}`;
            const menuOpen = openMenuRoomId === room.id;

            return (
              <div
                key={room.id}
                className={`relative flex min-w-0 items-center gap-1 ${
                  isActive ? 'bg-indigo-50' : 'hover:bg-stone-50'
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
                            className="h-3.5 w-3.5 shrink-0 text-stone-400"
                            aria-label="알림 꺼짐"
                          />
                        )}
                      </div>
                      {time && (
                        <span className="shrink-0 text-xs text-stone-500">{time}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-stone-500">
                      {/* 미리보기 — 첨부 마커는 "파일/이미지를 보냈습니다."로 요약, 일반 텍스트는 한 줄.
                          공통 util `summarizePreview` (lib/messageTemplate.ts) */}
                      {summarizePreview(room.lastMessage)}
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
                  className="mr-2 rounded-full p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
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
                    className="absolute right-2 top-12 z-10 w-36 rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 알림 끄기/켜기 — 가벼운 액션이라 다이얼로그 없이 즉시 적용 */}
                    {!showingHidden && (
                      mutedRoomIds.has(room.id) ? (
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left text-xs text-stone-800 hover:bg-stone-50"
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
                          className="block w-full px-3 py-1.5 text-left text-xs text-stone-800 hover:bg-stone-50"
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
                        className="block w-full px-3 py-1.5 text-left text-xs text-stone-800 hover:bg-stone-50"
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
                        className="block w-full px-3 py-1.5 text-left text-xs text-stone-800 hover:bg-stone-50"
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

        {!loading && !error && visibleRooms.length === 0 && (
          <div className="p-6 text-center text-sm text-stone-500">
            {showingHidden
              ? '숨긴 채팅이 없습니다.'
              : '아직 채팅 내역이 없습니다.'}
          </div>
        )}
      </div>
        );
      })()}

      {/* 숨긴 채팅 보기 토글 (활성 목록 하단) */}
      {!showingHidden && (
        <button
          type="button"
          onClick={() => toggleHidden(true)}
          className="border-t border-stone-200 px-4 py-2 text-center text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-700"
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
            <h3 className="text-base font-semibold text-stone-900">
              {confirmAction.type === 'hide' ? '채팅방 숨기기' : '채팅방 나가기'}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {confirmAction.type === 'hide'
                ? '이 방이 목록에서 안 보이게 됩니다. 새 메시지는 계속 받으며, "숨긴 채팅 보기"에서 다시 활성화할 수 있습니다.'
                : '이 방에서 영구히 나갑니다. 이후 새 메시지를 받지 못하고, 다시 들어가려면 다른 멤버의 초대가 필요합니다.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-stone-300 bg-white px-4 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
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

// sanitizePreview 로컬 구현 제거 — `lib/messageTemplate.ts`의 `summarizePreview` 공용 util 사용.
// 그쪽이 ToastContainer와 일관된 동일 함수를 쓰기 위함.

function roomDisplayName(
  room: ChatRoomWithMembers,
  myId: string | undefined,
): string {
  if (room.name) return room.name;
  if (room.type === 'DIRECT' && room.members.length > 0) {
    if (myId) {
      const other = room.members.find((m) => m.userId !== myId);
      if (other?.user?.name) return other.user.name;
      // myId 명시됐는데 상대방 없음 — backend `roomInclude()`가 `leftAt: null` 필터링하므로
      // 상대방이 leaveRoom한 DIRECT 방은 본인 멤버만 들어옴.
      // 본인 이름으로 fallback하면 "자기 자신과 대화"처럼 보여 혼란 → 명시 문구.
      return '(나간 사용자)';
    }
    // myId 미로드 — 첫 멤버 이름이라도 표시 (useAuth.user 완성되면 자동 교체)
    const fallback = room.members[0]?.user?.name;
    if (fallback) return fallback;
  }
  return '대화방';
}
