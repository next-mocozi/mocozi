'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { RoomPreviewPanel } from '@/components/chat/RoomPreviewPanel';
import {
  ArrowLeftIcon,
  BellOffIcon,
  FileIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons/ChatIcons';
import { ClockIcon } from '@/components/icons/CommonIcons';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { summarizePreview } from '@/lib/messageTemplate';
import { getMaskedName, timeAgo } from '@/lib/utils';
import {
  useChatNotifications,
  useChatSocket,
} from '@/providers/SocketProvider';
import type {
  ChatRoomWithMembers,
  MessageContext,
  RoomsPageResponse,
} from '@/types/chat';

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
  /** §B-DM-8 인라인 액션 — 기획서/프로필 미리보기 패널 (한 번에 하나만 열림) */
  const [previewPanel, setPreviewPanel] = useState<{
    mode: 'team-proposal' | 'user-profile';
    targetId: string;
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
            hiddenAt: r.hiddenAt,
          })),
        );
      } catch (e: unknown) {
        // eslint-disable-next-line no-console
        console.error('[chat] room list load failed:', e);
        const err = e as {
          response?: { status?: number; data?: { message?: string } };
          code?: string;
          message?: string;
        };
        let msg = '채팅방 목록을 불러오지 못했습니다.';
        if (err.response) {
          const status = err.response.status;
          const serverMsg = err.response.data?.message;
          msg = serverMsg
            ? `${serverMsg}${status ? ` (HTTP ${status})` : ''}`
            : `서버 오류 (HTTP ${status ?? '?'})`;
        } else if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')) {
          msg = '서버 응답 timeout (15s). 백엔드 상태 확인.';
        } else if (err.message) {
          msg = `요청 실패: ${err.message}`;
        }
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
            ? {
                ...r,
                lastMessage: n.lastMessage,
                lastMessageAt: n.lastMessageAt,
              }
            : r,
        ),
      );
    };
    socket.on('notification:roomLastMessageChanged', onRoomLastMessageChanged);

    return () => {
      socket.off('connect', onConnect);
      socket.off('notification:newMessage', onNewMessage);
      socket.off(
        'notification:roomLastMessageChanged',
        onRoomLastMessageChanged,
      );
    };
  }, [socket, load, showingHidden]);

  // rooms 변경 시 module cache 동기화 — 모드별로 갈래.
  // socket onNewMessage / handleHide / handleLeave 등 모든 setRooms 호출을 자동 캐치.
  // 가드:
  //  - loading=true — toggleHidden 전환 중 의도적으로 rooms를 비운 상태는 캐시에 반영하지 않음
  //  - loading=false — 마지막 방 hide/leave 같은 실제 빈 목록은 캐시에 반영해 stale room 재노출 방지
  useEffect(() => {
    if (loading) return;
    if (showingHidden && hasLoadedHiddenInSession) {
      cachedHiddenRooms = rooms;
    } else if (!showingHidden && hasLoadedActiveInSession) {
      cachedActiveRooms = rooms;
    }
  }, [rooms, showingHidden, loading]);

  /**
   * "숨긴 채팅 보기" ↔ "활성 채팅" 토글.
   *
   * - setRooms([])로 즉시 비움: 토글 직후 옛 rooms가 visibleRooms 필터 우회로 raw 노출되는
   *   깜빡임 회피
   * - setLoading(true)로 명시 spinner: 빈 list가 "아직 채팅 내역이 없습니다"로 잘못 신호되는 것
   *   회피. fetch 완료(load의 finally)에서 자동 setLoading(false)
   */
  /** §17 색 범례 popover 열림 상태 (헤더 ? 아이콘 클릭) */
  const [legendOpen, setLegendOpen] = useState(false);

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
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">
            {showingHidden ? '숨긴 채팅' : '채팅'}
          </h2>
          {/* §17 색 범례 popover — ? 아이콘 클릭 시 진입 컨텍스트 색 의미 표시 */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLegendOpen((v) => !v);
              }}
              className="flex h-5 w-5 items-center justify-center bg-stone-100 text-[10px] font-bold text-stone-500 hover:bg-stone-200 hover:text-stone-700"
              aria-label="색 점 의미 보기"
              aria-expanded={legendOpen}
              title="색 점 의미"
            >
              ?
            </button>
            {legendOpen && (
              <>
                {/* 외부 클릭 닫기 */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setLegendOpen(false)}
                />
                <div
                  className="absolute left-0 top-7 z-20 w-44 border border-stone-200 bg-white p-3 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-2 text-[11px] font-semibold text-stone-700">
                    진입 컨텍스트
                  </p>
                  <ul className="space-y-3 text-xs text-stone-600">
                    <li className="flex items-center gap-3">
                      <span className="h-1 w-1 animate-neon-pulse bg-blue-500 shadow-[0_0_4px_rgb(59_130_246/0.95),0_0_12px_rgb(59_130_246/0.6),0_0_24px_rgb(59_130_246/0.3)]" />
                      구인 (recruit)
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="h-1 w-1 animate-neon-pulse bg-amber-500 shadow-[0_0_4px_rgb(245_158_11/0.95),0_0_12px_rgb(245_158_11/0.6),0_0_24px_rgb(245_158_11/0.3)]" />
                      팀 합류
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="h-1 w-1 animate-neon-pulse bg-emerald-500 shadow-[0_0_4px_rgb(16_185_129/0.95),0_0_12px_rgb(16_185_129/0.6),0_0_24px_rgb(16_185_129/0.3)]" />
                      포트폴리오
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
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
        <div className="m-3 border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 빈 방(메시지 0개) 자동 숨김 정책 — docs/chat 정책 §15 참조:
          - 메시지 1개 이상이면 표시
          - OR 본인이 그 방에 draft 작성 중이면 표시 (의도 보존)
          - OR 현재 보고 있는 방이면 표시 (사용자가 열어둔 방이 list에서 사라지면 혼란)
          - 셋 다 아니면 숨김 (양쪽 멤버 모두 동일 동작)
          - "숨긴 채팅" 화면(showingHidden)에선 이 필터 우회 — 명시 숨김한 빈 방도 표시 */}
      {(() => {
        const filtered = showingHidden
          ? rooms
          : rooms.filter((room) => {
              // 현재 보고 있는 방 — 빈 방이어도 list에 노출
              if (pathname === `/chat/${room.id}`) return true;
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
        // 정렬 기준: lastMessageAt > sessionStorage `chat-entered-${id}` > createdAt.
        // - 메시지 있으면 lastMessageAt
        // - 빈 방인데 사용자가 진입한 적 있으면 진입 시점 (find-or-create로 옛 방이
        //   재사용되어 createdAt이 옛 시각이어도 진입 시점에 timeline 끼워짐)
        // - 둘 다 없으면 createdAt fallback
        // socket으로 lastMessageAt 갱신되면 sort가 매 render 재계산 → 자동 재정렬.
        const effectiveTs = (room: ChatRoomWithMembers): number => {
          if (room.lastMessageAt) return new Date(room.lastMessageAt).getTime();
          if (typeof window !== 'undefined') {
            try {
              const entered = window.sessionStorage.getItem(
                `chat-entered-${room.id}`,
              );
              if (entered) return Number(entered);
            } catch {
              // 무시
            }
          }
          return new Date(room.createdAt).getTime();
        };
        const visibleRooms = filtered
          .slice()
          .sort((a, b) => effectiveTs(b) - effectiveTs(a));
        return (
          <div className="flex-1 divide-y divide-stone-200 overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-sm text-stone-500">
                불러오는 중…
              </div>
            )}

            {!loading &&
              visibleRooms.map((room) => {
                const unread = unreadByRoom[room.id] ?? room.unreadCount;
                const displayName = roomDisplayName(room, user?.id);
                const time = room.lastMessageAt
                  ? timeAgo(room.lastMessageAt)
                  : '';
                const isActive = pathname === `/chat/${room.id}`;
                const menuOpen = openMenuRoomId === room.id;

                return (
                  <div
                    key={room.id}
                    className={`group relative flex min-w-0 items-center gap-1 ${
                      isActive ? 'bg-indigo-50' : 'hover:bg-stone-50'
                    } ${room.responseExpired ? 'opacity-60' : ''}`}
                  >
                    <Link
                      href={`/chat/${room.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center bg-indigo-100 text-indigo-600">
                          {room.type === 'DIRECT' ? (
                            <UserIcon className="h-5 w-5" />
                          ) : (
                            <UsersIcon className="h-5 w-5" />
                          )}
                        </div>
                        {/* §17 진입 컨텍스트 점은 이름 옆으로 이동 (네온 글로우가 모서리에서 잘리던 문제 해소) */}
                        {/* §B-DM-8 응답 만료 — 아바타 우하단 시계 overlay */}
                        {room.responseExpired && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-2 ring-white"
                            title="3일 동안 응답 없음"
                            aria-label="응답 시간 만료"
                          >
                            <ClockIcon className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <h3 className="truncate text-sm font-medium">
                              {displayName}
                            </h3>
                            {/* §17 진입 컨텍스트 네온 점 — 이름 옆 오른쪽, 미세 호흡 글로우.
                                내부 발광체는 작게(h-1 w-1=4px), 외부 글로우 반경(10px)은 유지 →
                                핀포인트 LED 같은 네온 비율. */}
                            {room.context && (
                              <span
                                className={`h-1 w-1 shrink-0 animate-neon-pulse ${contextNeonClasses(room.context)}`}
                                title={contextLabel(room.context)}
                                aria-label={`진입: ${contextLabel(room.context)}`}
                              />
                            )}
                            {mutedRoomIds.has(room.id) && (
                              <BellOffIcon
                                className="h-3.5 w-3.5 shrink-0 text-stone-400"
                                aria-label="알림 꺼짐"
                              />
                            )}
                          </div>
                          {time && (
                            <span className="shrink-0 text-xs text-stone-500">
                              {time}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-stone-500">
                          {/* 미리보기 — 첨부 마커는 "파일/이미지를 보냈습니다."로 요약, 일반 텍스트는 한 줄.
                          공통 util `summarizePreview` (lib/messageTemplate.ts) */}
                          {summarizePreview(room.lastMessage)}
                          {room.responseExpired && (
                            <span className="ml-1 text-amber-700">· 응답 만료</span>
                          )}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center bg-indigo-600 px-1.5 text-xs text-white">
                          {unread}
                        </span>
                      )}
                    </Link>

                    {/* §B-DM-8 인라인 액션 — context가 가리키는 "주체"별 미리보기.
                        - SCOUT_FROM_TEAM(팀이 사람 영입) → 📄 기획서 (주체=팀)
                        - RECRUIT_TEAM(사람이 팀에 지원) → 👤 프로필 (주체=지원자=creator)
                        - RECRUIT_INDIVIDUAL/PORTFOLIO_* → 👤 프로필 (주체=상대 멤버)
                        타겟이 본인(myId)이면 자동 숨김 (본인 자신 미리보기 의미 X). */}
                    {(() => {
                      const ctx = room.context;
                      const myUserId = user?.id;

                      // 기획서 버튼 — SCOUT_FROM_TEAM 전용. 타겟=teamId.
                      // creator(=팀장)도 본인 팀이라 useless하지만 무해 — 굳이 가드 X.
                      const teamTargetId =
                        ctx === 'SCOUT_FROM_TEAM' ? room.contextTargetId : null;

                      // 프로필 버튼 타겟 결정
                      let profileTargetId: string | null = null;
                      if (ctx === 'RECRUIT_TEAM') {
                        // 지원 방의 주체 = 지원자 = room.creatorId
                        profileTargetId = room.creatorId ?? null;
                      } else if (
                        ctx === 'RECRUIT_INDIVIDUAL' ||
                        ctx === 'PORTFOLIO_COFFEE_CHAT' ||
                        ctx === 'PORTFOLIO_FRIENDSHIP' ||
                        ctx === 'PORTFOLIO_INQUIRY' ||
                        ctx === 'PORTFOLIO_COLLAB' ||
                        ctx === 'PORTFOLIO_PRAISE'
                      ) {
                        // 옛 방·포트폴리오 흐름은 DIRECT 상대 멤버를 주체로 간주
                        const other =
                          myUserId &&
                          room.members.find(
                            (m) => m.userId !== myUserId && !m.leftAt,
                          )?.userId;
                        profileTargetId = other ?? null;
                      }

                      // 본인 자신을 가리키면 의미 없으므로 숨김 (sender view에서 자동 정리)
                      if (profileTargetId === myUserId) profileTargetId = null;

                      const showTeam = !!teamTargetId;
                      const showProfile = !!profileTargetId;
                      if (!showTeam && !showProfile) return null;
                      return (
                        <div className="hidden items-center group-hover:flex">
                          {showTeam && teamTargetId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPanel({
                                  mode: 'team-proposal',
                                  targetId: teamTargetId,
                                });
                              }}
                              className="p-1 text-stone-400 hover:bg-stone-200 hover:text-indigo-600"
                              aria-label="기획서 보기"
                              title="기획서 보기"
                            >
                              <FileIcon className="h-4 w-4" />
                            </button>
                          )}
                          {showProfile && profileTargetId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPanel({
                                  mode: 'user-profile',
                                  targetId: profileTargetId,
                                });
                              }}
                              className="p-1 text-stone-400 hover:bg-stone-200 hover:text-indigo-600"
                              aria-label="프로필 보기"
                              title="프로필 보기"
                            >
                              <UserIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* ⋯ 메뉴 버튼 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuRoomId(menuOpen ? null : room.id);
                      }}
                      className="mr-2 p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
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
                        className="absolute right-2 top-12 z-10 w-36 border border-stone-200 bg-white py-1 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* 알림 끄기/켜기 — 가벼운 액션이라 다이얼로그 없이 즉시 적용 */}
                        {!showingHidden &&
                          (mutedRoomIds.has(room.id) ? (
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
                          ))}
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
            className="w-full max-w-sm bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-stone-900">
              {confirmAction.type === 'hide'
                ? '채팅방 숨기기'
                : '채팅방 나가기'}
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
                className="border border-stone-300 bg-white px-4 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
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
                className={`px-4 py-1.5 text-sm text-white ${
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

      {/* §B-DM-8 인라인 액션 — 기획서/프로필 미리보기 패널 (한 번에 하나만) */}
      <RoomPreviewPanel
        open={!!previewPanel}
        mode={previewPanel?.mode ?? 'team-proposal'}
        targetId={previewPanel?.targetId ?? ''}
        onClose={() => setPreviewPanel(null)}
      />
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
      if (other?.user) return getMaskedName(other.user);
      // myId 명시됐는데 상대방 없음 — backend `roomInclude()`가 `leftAt: null` 필터링하므로
      // 상대방이 leaveRoom한 DIRECT 방은 본인 멤버만 들어옴.
      // 본인 이름으로 fallback하면 "자기 자신과 대화"처럼 보여 혼란 → 명시 문구.
      return '(나간 사용자)';
    }
    // myId 미로드 — 첫 멤버 이름이라도 표시 (useAuth.user 완성되면 자동 교체)
    const fallbackUser = room.members[0]?.user;
    if (fallbackUser) return getMaskedName(fallbackUser);
  }
  return '대화방';
}

/**
 * §17 진입 컨텍스트 라벨 — `title` hover tooltip + 범례 popover에 사용.
 * Phase A 진입점: RECRUIT_INDIVIDUAL / RECRUIT_TEAM.
 * Phase B (포트폴리오 5종)는 enum 등록만 — 진입점 wired되면 자동 작동.
 */
function contextLabel(c: MessageContext): string {
  switch (c) {
    // 구인 카테고리 — "사람이 다른 사람/팀이 사람을 영입하려는" 방향.
    //   RECRUIT_INDIVIDUAL = 개인이 개인 프로필 보고 채팅 시작
    //   SCOUT_FROM_TEAM    = 팀이 (구인 페이지에서) 개인을 영입 시도
    case 'RECRUIT_INDIVIDUAL':
    case 'SCOUT_FROM_TEAM':
      return '구인';
    // 팀 합류 카테고리 — "사람이 팀에 들어가려는" 방향.
    case 'RECRUIT_TEAM':
      return '팀 합류';
    case 'PORTFOLIO_COFFEE_CHAT':
    case 'PORTFOLIO_FRIENDSHIP':
    case 'PORTFOLIO_INQUIRY':
    case 'PORTFOLIO_COLLAB':
    case 'PORTFOLIO_PRAISE':
      return '포트폴리오';
    default:
      return '대화';
  }
}

/** §17 진입 컨텍스트 네온 점 — bg + 3중 glow shadow.
 *  4px 근접 코어 → 12px 중간 → 24px 외곽 산란으로 부드러운 페이드.
 *  발광체(h-1 w-1=4px) 대비 후광이 6배 펴져 LED 후광 인상.
 *  animate-neon-pulse (globals.css)와 함께 "on the record" 미세 호흡. */
function contextNeonClasses(c: MessageContext): string {
  switch (c) {
    case 'RECRUIT_INDIVIDUAL':
    case 'SCOUT_FROM_TEAM':
      // blue-500 = rgb(59 130 246)
      return 'bg-blue-500 shadow-[0_0_4px_rgb(59_130_246/0.95),0_0_12px_rgb(59_130_246/0.6),0_0_24px_rgb(59_130_246/0.3)]';
    case 'RECRUIT_TEAM':
      // amber-500 = rgb(245 158 11)
      return 'bg-amber-500 shadow-[0_0_4px_rgb(245_158_11/0.95),0_0_12px_rgb(245_158_11/0.6),0_0_24px_rgb(245_158_11/0.3)]';
    case 'PORTFOLIO_COFFEE_CHAT':
    case 'PORTFOLIO_FRIENDSHIP':
    case 'PORTFOLIO_INQUIRY':
    case 'PORTFOLIO_COLLAB':
    case 'PORTFOLIO_PRAISE':
      // emerald-500 = rgb(16 185 129)
      return 'bg-emerald-500 shadow-[0_0_4px_rgb(16_185_129/0.95),0_0_12px_rgb(16_185_129/0.6),0_0_24px_rgb(16_185_129/0.3)]';
    default:
      return 'bg-stone-400';
  }
}
