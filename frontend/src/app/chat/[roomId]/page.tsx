'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import RoomList from '@/components/chat/RoomList';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { useChatNotifications, useChatSocket } from '@/providers/SocketProvider';
import type {
  ChatMessageWithSender,
  ChatRoomWithMembers,
  MessagesPageResponse,
} from '@/types/chat';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

/**
 * 화면용 메시지 타입 — 서버 메시지 + 클라이언트 전용 낙관적 UI 상태
 *
 * __pending: ack 대기 중 (입력 즉시 표시되는 임시 메시지)
 * __failed:  ack timeout 또는 실패. UI에 ⚠ 표시, 재전송 안내
 *
 * 서버 broadcast로 받은 메시지에는 두 플래그 모두 미정의 (정상 메시지)
 */
type LocalMessage = ChatMessageWithSender & {
  __pending?: boolean;
  __failed?: boolean;
};

/**
 * 채팅방 화면 — Day 10-1
 *
 * 데이터 흐름:
 *  1. 마운트:
 *     - GET /api/chat/rooms/:id  (방 정보 + 멤버)
 *     - GET /api/chat/rooms/:id/messages?limit=50  (초기 메시지, 최신 50개)
 *     - socket.joinConversation(roomId)  (Socket room 가입 + 자동 읽음)
 *  2. 실시간:
 *     - 'message:new' broadcast 수신 → 메시지 목록 끝에 append
 *  3. 전송:
 *     - socket.sendMessage({ roomId, content }) → ack 받으면 콘솔 디버그
 *       (실제 메시지는 서버 broadcast로 자기 자신에게도 수신됨)
 *
 * 미구현 (후속 단위):
 *  - 10-2 낙관적 UI (보내자마자 임시 메시지로 보임)
 *  - 10-3 수정/삭제 UI
 *  - 10-4 답글/반응 UI
 *  - 10-5 무한 스크롤 + 자동 스크롤 가드
 */
export default function ChatRoomPage({ params }: PageProps) {
  const { roomId } = use(params);
  const { user } = useAuth();
  const {
    socket,
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    addReaction,
    removeReaction,
  } = useChatSocket();
  const { setRoomUnread } = useChatNotifications();

  const [room, setRoom] = useState<ChatRoomWithMembers | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  /** 편집 모드 — 한 번에 한 메시지만. null이면 편집 모드 아님 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  /**
   * 답글 대상 — null이면 일반 메시지. 객체 보유 시 다음 message:send에 parentId 포함
   * (UI: 입력창 위에 "○○○에게 답글" 미리보기 표시)
   */
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);

  /** 무한 스크롤 — 위쪽으로 이전 메시지 페이징 */
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /** DOM refs */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  /** 자동 스크롤 가드 — 마지막으로 본 메시지 id (변경 추적용) */
  const lastMessageIdRef = useRef<string | null>(null);
  /** 첫 로드 시 무조건 맨 아래로 한 번 — 그 이후에만 가드 적용 */
  const initialScrolledRef = useRef(false);

  // ---------------------------------------------------------
  // 초기 로드 — 방 정보 + 메시지
  // ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setError(null);
        setLoading(true);
        const [roomRes, msgRes] = await Promise.all([
          api.get<{ data: ChatRoomWithMembers }>(`/api/chat/rooms/${roomId}`),
          api.get<{ data: MessagesPageResponse }>(
            `/api/chat/rooms/${roomId}/messages?limit=50`,
          ),
        ]);
        if (cancelled) return;

        setRoom(roomRes.data.data);
        // 백엔드는 createdAt DESC 반환 → 화면은 시간순(오래된 위, 최신 아래)이라 reverse
        setMessages([...msgRes.data.data.messages].reverse());
        // cursor 저장 — null이면 더 이상 옛 메시지 없음 (페이지 첫 로드)
        setNextCursor(msgRes.data.data.nextCursor);
        // 새 방 진입이므로 자동 스크롤 상태 리셋
        initialScrolledRef.current = false;
        lastMessageIdRef.current = null;
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? '채팅방 정보를 불러오지 못했습니다.';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ---------------------------------------------------------
  // socket — conversation:join / leave + message:new listener
  // ---------------------------------------------------------
  useEffect(() => {
    if (!socket || !isConnected) return;

    void joinConversation(roomId).then(() => {
      // 진입 시 자동 읽음 처리됨 (Pattern C). 사이드바 unread도 0으로
      setRoomUnread(roomId, 0);
    });

    const onMessageNew = (msg: ChatMessageWithSender) => {
      if (msg.roomId !== roomId) return; // 다른 방 broadcast는 무시 (방어적)
      setMessages((prev) => {
        // 낙관적 UI race 처리:
        //  - ack가 먼저 도달해서 이미 real id로 교체됐으면 중복 방지 (id로 dedup)
        //  - broadcast가 ack보다 먼저 도달했으면 그냥 append (이후 ack 핸들러가 tempId만 제거)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Phase A 읽음 정책 ② — 사용자가 방에 머무는 동안 새 메시지 도착 시 즉시 읽음 처리
      // (정책 ①은 conversation:join에서 처리. ②가 빠지면 머무는 동안 도착한 메시지가
      //  방을 나갔을 때 unread로 남는 버그 — 카톡 등 일반 메신저와 다른 동작)
      // 본인 메시지든 타인 메시지든 lastReadMessageId 를 최신으로 전진. 서버의 unreadCount
      // 쿼리는 senderId !== userId 필터가 있어 본인 메시지는 어차피 카운트 제외.
      void markAsRead(roomId, msg.id);
    };

    const onMessageEdited = (msg: ChatMessageWithSender) => {
      if (msg.roomId !== roomId) return;
      // 같은 id 자리에 새 객체로 교체. content / editedAt / reactions 등 갱신
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };

    const onMessageDeleted = (data: { messageId: string; roomId: string }) => {
      if (data.roomId !== roomId) return;
      // 소프트 삭제 — 같은 id를 deletedAt 마킹. row 자체는 유지 (답글 부모 보존)
      // + 이 메시지를 parent로 참조하는 답글들의 parent.deletedAt도 함께 갱신
      //   (그래야 답글 인용 박스에 "(삭제된 메시지)"가 즉시 반영됨. 갱신 안 하면
      //    탭 새로고침으로 GET /messages 다시 받기 전까지 옛 인용 그대로 보임)
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return { ...m, deletedAt: now };
          }
          if (m.parent?.id === data.messageId && m.parent.deletedAt === null) {
            return { ...m, parent: { ...m.parent, deletedAt: now } };
          }
          return m;
        }),
      );
    };

    const onReactionAdded = (
      r: { id: string; messageId: string; userId: string; emoji: string; createdAt: string } & {
        roomId?: string;
      },
    ) => {
      // roomId 필드는 broadcast 페이로드에 포함될 수도/없을 수도 — messageId가 우리 방 안에 있는지로 분기
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== r.messageId) return m;
          // 중복 방지 — 같은 (userId, emoji) 이미 있으면 무시
          if (m.reactions.some((x) => x.userId === r.userId && x.emoji === r.emoji)) {
            return m;
          }
          return {
            ...m,
            reactions: [
              ...m.reactions,
              {
                id: r.id,
                messageId: r.messageId,
                userId: r.userId,
                emoji: r.emoji,
                createdAt: r.createdAt,
              },
            ],
          };
        }),
      );
    };

    const onReactionRemoved = (data: {
      messageId: string;
      userId: string;
      emoji: string;
    }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== data.messageId) return m;
          return {
            ...m,
            reactions: m.reactions.filter(
              (x) => !(x.userId === data.userId && x.emoji === data.emoji),
            ),
          };
        }),
      );
    };

    socket.on('message:new', onMessageNew);
    socket.on('message:edited', onMessageEdited);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('reaction:added', onReactionAdded);
    socket.on('reaction:removed', onReactionRemoved);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:edited', onMessageEdited);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('reaction:added', onReactionAdded);
      socket.off('reaction:removed', onReactionRemoved);
      leaveConversation(roomId);
    };
  }, [
    socket,
    isConnected,
    roomId,
    joinConversation,
    leaveConversation,
    setRoomUnread,
    markAsRead,
  ]);

  // ---------------------------------------------------------
  // 자동 스크롤 — 가드 적용
  //
  // 정책:
  //  - 첫 로드 (initialScrolledRef false) → 무조건 맨 아래로 (instant)
  //  - 메시지 갯수만 변동하고 마지막 id는 그대로 → prepend(옛 메시지 로드)이므로 점프 X
  //  - 마지막 id가 변경됨 → 새 메시지 도착. 사용자가 "맨 아래 가까이"(< 100px)일 때만 따라감
  //
  // prepend 직후의 scrollTop 보정은 loadOlder 안에서 별도 처리.
  // ---------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || messages.length === 0) return;

    const newLastId = messages[messages.length - 1]?.id ?? null;

    // 첫 로드 — 즉시 맨 아래로 (애니메이션 없이)
    if (!initialScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      initialScrolledRef.current = true;
      lastMessageIdRef.current = newLastId;
      return;
    }

    const lastChanged = newLastId !== lastMessageIdRef.current;
    lastMessageIdRef.current = newLastId;

    if (!lastChanged) return; // prepend 또는 in-place 갱신만 — 스크롤 건드리지 않음

    // 사용자가 맨 아래 가까이 있을 때만 자동 따라감
    const distanceFromBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (distanceFromBottom < 100) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ---------------------------------------------------------
  // 무한 스크롤 — 위로 옛 메시지 페이징
  //
  // 흐름:
  //  1) 사용자가 위로 스크롤 → topSentinel viewport 진입
  //  2) IntersectionObserver 트리거 → loadOlder() 호출
  //  3) GET /messages?cursor=<nextCursor>&limit=50
  //  4) 응답 → reverse → 기존 messages 앞에 prepend + nextCursor 갱신
  //  5) prepend로 인한 scrollHeight 증가만큼 scrollTop도 증가 → 시각적 위치 유지
  // ---------------------------------------------------------
  const loadOlder = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    const container = containerRef.current;
    const oldScrollHeight = container?.scrollHeight ?? 0;
    const oldScrollTop = container?.scrollTop ?? 0;

    try {
      const res = await api.get<{ data: MessagesPageResponse }>(
        `/api/chat/rooms/${roomId}/messages?limit=50&cursor=${encodeURIComponent(nextCursor)}`,
      );
      const olderReversed = [...res.data.data.messages].reverse();
      // 기존 메시지 앞에 prepend (이미 ID로 dedup하고 있어서 중복 위험 낮음)
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const filtered = olderReversed.filter((m) => !known.has(m.id));
        return [...filtered, ...prev];
      });
      setNextCursor(res.data.data.nextCursor);

      // scrollTop 보정 — 다음 paint에서 측정·적용
      requestAnimationFrame(() => {
        const c = containerRef.current;
        if (!c) return;
        const delta = c.scrollHeight - oldScrollHeight;
        c.scrollTop = oldScrollTop + delta;
      });
    } catch {
      // 네트워크 오류는 일단 silent — Phase B에서 명시 배너
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, nextCursor, loadingMore]);

  // top sentinel 가시화 시 자동 loadOlder
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadOlder();
      },
      { root: container, threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlder]);

  // ---------------------------------------------------------
  // 메시지 전송 — 낙관적 UI
  //
  // 흐름:
  //  1) crypto.randomUUID()로 tempId 생성
  //  2) __pending 플래그 단 임시 메시지를 즉시 화면에 추가 (사용자 체감 RT 0)
  //  3) socket.sendMessage ack 대기
  //  4) ack 결과 분기:
  //     - 성공 + 같은 id가 이미 있음 (broadcast가 먼저 옴) → tempId 제거
  //     - 성공 + 같은 id 없음 → tempId 자리에 real message로 교체
  //     - null/실패 → __failed 마킹 (사용자가 재전송하도록)
  //
  // 사용자가 텍스트를 입력 중일 때 보낸 다른 메시지의 ack가 늦게 와도
  // tempId로 정확히 매칭되므로 안전.
  // ---------------------------------------------------------
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !user) return;

    setSending(true);

    const tempId = crypto.randomUUID();
    const parentId = replyTo?.id ?? undefined;
    const tempMessage: LocalMessage = {
      id: tempId,
      roomId,
      senderId: user.id,
      content,
      parentId: parentId ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, name: user.name, profileImage: null },
      reactions: [],
      parent: replyTo
        ? {
            id: replyTo.id,
            content: replyTo.content,
            senderId: replyTo.senderId,
            deletedAt: replyTo.deletedAt,
          }
        : null,
      __pending: true,
    };
    setMessages((prev) => [...prev, tempMessage]);
    setDraft('');
    setReplyTo(null); // 전송 즉시 답글 모드 해제

    try {
      const ack = (await sendMessage({
        roomId,
        content,
        ...(parentId ? { parentId } : {}),
      })) as ChatMessageWithSender | null | undefined;

      if (ack && typeof ack === 'object' && 'id' in ack && typeof ack.id === 'string') {
        const serverMessage = ack as ChatMessageWithSender;
        setMessages((prev) => {
          const realExists = prev.some((m) => m.id === serverMessage.id);
          if (realExists) {
            // broadcast 먼저 도착 — tempId만 제거
            return prev.filter((m) => m.id !== tempId);
          }
          // ack 먼저 도착 — tempId 자리에 서버 메시지로 교체
          return prev.map((m) => (m.id === tempId ? serverMessage : m));
        });
      } else {
        // ack가 없거나 형식 이상 — 실패 마킹
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, __pending: false, __failed: true } : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, __pending: false, __failed: true } : m,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------
  // 편집 — 본인 메시지만 가능 (서버가 senderId 검증, 클라이언트도 UI에서 차단)
  // ---------------------------------------------------------
  const startEdit = (m: LocalMessage) => {
    if (m.senderId !== user?.id) return;
    if (m.deletedAt) return; // 이미 삭제된 메시지는 편집 불가 (서버도 거부)
    if (m.__pending || m.__failed) return; // 아직 ack 안 온 메시지는 편집 X
    setEditingId(m.id);
    setEditDraft(m.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const submitEdit = async () => {
    if (!editingId) return;
    const content = editDraft.trim();
    if (content.length === 0) return;
    try {
      // 결과는 broadcast(message:edited)로 listener가 갱신
      await editMessage({ messageId: editingId, content });
    } catch {
      // exception 이벤트는 useSocket의 lastException에 저장됨. UI 알림은 Phase B
    } finally {
      cancelEdit();
    }
  };

  // ---------------------------------------------------------
  // 삭제 — 본인 메시지만, 소프트 삭제 (서버가 deletedAt 설정)
  // ---------------------------------------------------------
  const handleDelete = async (m: LocalMessage) => {
    if (m.senderId !== user?.id) return;
    if (m.deletedAt) return;
    if (m.__pending || m.__failed) return;
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) return;
    try {
      await deleteMessage(m.id);
      // 결과는 broadcast(message:deleted)로 처리됨
    } catch {
      // 무시
    }
  };

  // ---------------------------------------------------------
  // 답글 — UI에서 입력창 위에 부모 미리보기, 다음 message:send에 parentId 포함
  // ---------------------------------------------------------
  const startReply = (m: LocalMessage) => {
    if (m.deletedAt) return;
    if (m.__pending || m.__failed) return;
    setReplyTo(m);
  };
  const cancelReply = () => setReplyTo(null);

  // ---------------------------------------------------------
  // 반응 — 토글 동작: 본인이 이미 그 emoji로 반응했으면 제거, 아니면 추가
  // ---------------------------------------------------------
  const toggleReaction = async (m: LocalMessage, emoji: string) => {
    if (!user) return;
    if (m.deletedAt) return;
    if (m.__pending || m.__failed) return;

    const mine = m.reactions.some(
      (r) => r.userId === user.id && r.emoji === emoji,
    );
    try {
      if (mine) {
        await removeReaction({ messageId: m.id, emoji });
      } else {
        await addReaction({ messageId: m.id, emoji });
      }
      // 결과는 broadcast(reaction:added/removed)로 갱신
    } catch {
      // 무시
    }
  };

  return (
    <div className="relative h-[calc(100vh-11rem)]">
      {/* 좌측 사이드바 — 채팅창 가운데 정렬은 그대로 두고, 좌측 빈 공간에 absolute로 배치.
          xl(1280px) 미만에선 채팅창과 겹쳐서 hidden 처리 */}
      <aside className="absolute right-[calc(50%+21rem)] top-0 hidden h-full w-72 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white xl:flex">
        <RoomList />
      </aside>

      <div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Link href="/chat" className="text-gray-500 hover:text-gray-700">
          ← 뒤로
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm text-primary-600">
          {room?.type === 'DIRECT' ? '👤' : '👥'}
        </div>
        <h2 className="font-medium">{loading ? '…' : roomTitle(room, user?.id)}</h2>
        <span
          className={`ml-auto text-xs ${isConnected ? 'text-green-600' : 'text-gray-400'}`}
        >
          {isConnected ? '● 연결됨' : '○ 연결 끊김'}
        </span>
      </div>

      {/* 메시지 목록 */}
      <div
        ref={containerRef}
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        {/* 위로 스크롤 시 옛 메시지 페이징 trigger */}
        {nextCursor && (
          <div
            ref={topSentinelRef}
            className="py-2 text-center text-xs text-gray-400"
          >
            {loadingMore ? '이전 메시지 불러오는 중…' : '↑ 더 위로 스크롤하여 이전 메시지 보기'}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center text-sm text-gray-500">불러오는 중…</div>
        )}

        {!loading &&
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              myId={user?.id}
              isEditing={editingId === msg.id}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onStartEdit={() => startEdit(msg)}
              onSubmitEdit={submitEdit}
              onCancelEdit={cancelEdit}
              onDelete={() => handleDelete(msg)}
              onReply={() => startReply(msg)}
              onToggleReaction={(emoji) => toggleReaction(msg, emoji)}
            />
          ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 답글 미리보기 — replyTo가 있으면 입력창 위에 표시 */}
      {replyTo && (
        <div className="flex items-start gap-2 border-t border-gray-200 bg-gray-50 px-4 py-2 text-sm">
          <div className="min-w-0 flex-1 border-l-2 border-primary-400 pl-2">
            <p className="text-xs text-gray-500">
              {replyTo.sender.name}님에게 답글
            </p>
            <p className="truncate text-gray-700">
              {replyTo.deletedAt ? '(삭제된 메시지)' : replyTo.content}
            </p>
          </div>
          <button
            type="button"
            onClick={cancelReply}
            className="rounded p-1 text-xs text-gray-500 hover:bg-gray-200"
            aria-label="답글 취소"
          >
            ×
          </button>
        </div>
      )}

      {/* 입력 */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-gray-200 bg-white p-4"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            replyTo
              ? `${replyTo.sender.name}님에게 답글 작성…`
              : isConnected
                ? '메시지를 입력하세요...'
                : '연결 대기 중…'
          }
          disabled={!isConnected}
          className="input-field flex-1 disabled:bg-gray-50"
        />
        <button
          type="submit"
          className="btn-primary disabled:opacity-50"
          disabled={!isConnected || sending || draft.trim().length === 0}
        >
          전송
        </button>
      </form>
      </div>
    </div>
  );
}

/**
 * 메시지 한 줄 렌더
 * - 본인/타인 분리
 * - deletedAt placeholder
 * - editedAt 마커
 * - 낙관적 UI 상태 (__pending/__failed)
 * - 본인 메시지: 편집/삭제 버튼 (hover/항상 표시) + 편집 모드 시 inline textarea
 */
/** Phase A 고정 이모지 셋. Phase B에서 본격 피커로 교체 */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

function MessageItem({
  message,
  myId,
  isEditing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
  onReply,
  onToggleReaction,
}: {
  message: LocalMessage;
  myId: string | undefined;
  isEditing: boolean;
  editDraft: string;
  onEditDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const isMine = message.senderId === myId;
  const time = formatTime(message.createdAt);

  if (message.deletedAt) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[70%] rounded-2xl border border-dashed border-gray-300 px-4 py-2 text-sm italic text-gray-400">
          삭제된 메시지입니다
        </div>
      </div>
    );
  }

  // 편집 모드 — 본인 메시지에 한해 inline textarea
  if (isEditing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[70%] rounded-2xl border border-primary-300 bg-primary-50 p-2">
          <textarea
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmitEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
          />
          <div className="mt-2 flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded px-2 py-1 text-gray-600 hover:bg-gray-100"
            >
              취소 (Esc)
            </button>
            <button
              type="button"
              onClick={onSubmitEdit}
              disabled={editDraft.trim().length === 0}
              className="rounded bg-primary-600 px-2 py-1 font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              저장 (Enter)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 낙관적 UI 상태에 따른 시각 변형
  const stateClass = message.__pending
    ? 'opacity-60'
    : message.__failed
      ? 'opacity-80 ring-2 ring-red-400'
      : '';

  const stateLabel = message.__pending
    ? '전송 중…'
    : message.__failed
      ? '⚠ 전송 실패'
      : null;

  // 편집/삭제 가능 여부 — 본인 + 정상 상태(아직 미확정 메시지 X)
  const canMutate = isMine && !message.__pending && !message.__failed;
  const canReact = !message.__pending && !message.__failed;

  // 반응 그룹화 — emoji별 카운트 + 본인 포함 여부
  const groupedReactions = groupReactions(message.reactions, myId);

  return (
    <div className={`group flex ${isMine ? 'justify-end' : 'justify-start'} gap-1`}>
      {/* 본인 메시지 좌측 액션 버튼 (편집/삭제/답글/반응) */}
      {isMine && (
        <div className="flex items-center self-center opacity-0 transition-opacity group-hover:opacity-100">
          {canReact && (
            <ReactionPicker onPick={onToggleReaction} />
          )}
          <button
            type="button"
            onClick={onReply}
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="답글"
            title="답글"
          >
            ↩
          </button>
          {canMutate && (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="메시지 편집"
                title="편집"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600"
                aria-label="메시지 삭제"
                title="삭제"
              >
                🗑
              </button>
            </>
          )}
        </div>
      )}

      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isMine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
        } ${stateClass}`}
      >
        {/* 부모 메시지 인용 (답글) */}
        {message.parent && (
          <div
            className={`mb-2 border-l-2 pl-2 text-xs ${
              isMine
                ? 'border-primary-300 text-primary-100'
                : 'border-gray-400 text-gray-500'
            }`}
          >
            <p className="truncate italic">
              ↩{' '}
              {message.parent.deletedAt
                ? '(삭제된 메시지)'
                : message.parent.content}
            </p>
          </div>
        )}

        {!isMine && (
          <p className="mb-0.5 text-xs font-medium opacity-80">
            {message.sender.name}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content}
        </p>

        {/* 반응 표시 — emoji별 그룹 */}
        {groupedReactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {groupedReactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(r.emoji)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  r.mine
                    ? isMine
                      ? 'bg-primary-400 text-white'
                      : 'bg-primary-100 text-primary-700'
                    : isMine
                      ? 'bg-primary-700/40 text-white'
                      : 'bg-gray-200 text-gray-700'
                }`}
                aria-label={`${r.emoji} 반응 ${r.count}개${r.mine ? ' (내가 추가함)' : ''}`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        <p
          className={`mt-1 text-right text-xs ${
            isMine ? 'text-primary-200' : 'text-gray-400'
          }`}
        >
          {stateLabel ? (
            <span className={message.__failed ? 'font-semibold text-red-200' : ''}>
              {stateLabel}
            </span>
          ) : (
            <>
              {message.editedAt && '(편집됨) '}
              {time}
            </>
          )}
        </p>
      </div>

      {/* 타인 메시지 우측 액션 버튼 (답글/반응) — 편집·삭제는 권한 없음 */}
      {!isMine && (
        <div className="flex items-center self-center opacity-0 transition-opacity group-hover:opacity-100">
          {canReact && <ReactionPicker onPick={onToggleReaction} />}
          <button
            type="button"
            onClick={onReply}
            className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="답글"
            title="답글"
          >
            ↩
          </button>
        </div>
      )}
    </div>
  );
}

/** 반응 picker — hover 시 표시. 클릭하면 onPick(emoji) */
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="반응 추가"
        title="반응"
      >
        😀
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-1 flex -translate-x-1/2 gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-md">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="rounded p-1 text-base hover:bg-gray-100"
              aria-label={`${e} 반응 추가`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 반응 배열을 emoji별로 그룹화 — emoji, count, mine(본인 포함 여부)
 * 정렬은 등장 순 (배열 순서) 기준 — 안정적
 */
function groupReactions(
  reactions: LocalMessage['reactions'],
  myId: string | undefined,
): { emoji: string; count: number; mine: boolean }[] {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.userId === myId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return Array.from(map.entries()).map(([emoji, v]) => ({
    emoji,
    count: v.count,
    mine: v.mine,
  }));
}

/**
 * 방 표시명:
 *  - GROUP/CHANNEL: room.name
 *  - DIRECT: 본인 아닌 첫 멤버 이름 (myId 모르면 첫 멤버 폴백)
 */
function roomTitle(
  room: ChatRoomWithMembers | null,
  myId: string | undefined,
): string {
  if (!room) return '대화방';
  if (room.name) return room.name;
  if (room.type === 'DIRECT') {
    const others = room.members.filter((m) => m.userId !== myId);
    const name = others[0]?.user?.name ?? room.members[0]?.user?.name;
    if (name) return name;
  }
  return '대화방';
}

/** ISO string → "오후 2:30" 한국식 시간 표시 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hour12}:${m}`;
}
