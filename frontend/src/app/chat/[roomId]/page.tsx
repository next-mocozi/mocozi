'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { AttachmentButton } from '@/components/chat/AttachmentButton';
import {
  AttachmentClipButton,
  AttachmentPicker,
  type AttachmentPickerHandle,
} from '@/components/chat/AttachmentPicker';
import { FileAttachmentCard } from '@/components/chat/FileAttachmentCard';
import { ImageAttachment } from '@/components/chat/ImageAttachment';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import RoomList from '@/components/chat/RoomList';
import { RoleSelector } from '@/components/chat/RoleSelector';
import { SlidingPanel } from '@/components/chat/SlidingPanel';
import { TemplatePreview } from '@/components/chat/TemplatePreview';
import { TemplateTrigger } from '@/components/chat/TemplateTrigger';
import { PreviewIcon } from '@/components/icons/PreviewIcon';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckIcon,
  ClipboardIcon,
  DotFilledIcon,
  DotOutlineIcon,
  PencilIcon,
  ReplyIcon,
  SmilePlusIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons/ChatIcons';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import {
  clearEmptyRoomGuard,
  EMPTY_ROOM_LEAVE_MESSAGE,
  setEmptyRoomGuard,
} from '@/lib/chat/emptyRoomGuard';
import {
  ensureProfileAttachment,
  parseAttachmentMarker,
  renderTemplate,
  type TemplateVars,
} from '@/lib/messageTemplate';
import { useChatNotifications, useChatSocket } from '@/providers/SocketProvider';
import type {
  ChatMessageWithSender,
  ChatRoomWithMembers,
  MessageContext,
  MessagesPageResponse,
  MessageTemplate,
  TeamApplicationContact,
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
 * 메시지 본문 최대 길이 — backend SendMessageDto/EditMessageDto의 @MaxLength(4000)와 동기.
 *
 * 초과 시 backend ValidationPipe가 WsException 던지지만 ack 콜백이 절대 resolve 안 됨 →
 * 프론트는 "전송 중..." 영원히 표시. 사용자 사전 차단으로 그 함정 회피.
 *
 * 동기 유지: backend 값 변경 시 함께 수정. 4000 = 약 한국어 A4 1페이지 + 여유.
 */
const MAX_MESSAGE_LENGTH = 4000;
/** 카운터 노출 임계 — 4000의 87.5% (3500자) 도달 시 글자수 표시 */
const COUNTER_THRESHOLD = 3500;

/**
 * "맨 아래로 가기" 버튼 노출 임계 (px).
 * 사용자가 메시지 영역에서 이 값 이상 위로 스크롤한 상태이면 버튼 노출.
 *
 * 카카오톡/Slack/Discord 등 표준 패턴: 한 화면(~200~400px) 정도 올렸을 때부터 노출.
 * 너무 낮으면(예: 50px) 가벼운 스크롤에도 깜빡임 ↑. 너무 높으면(예: 600px) 발견성 ↓.
 * 200px가 균형점 — 메시지 5~7개 정도 위로 스크롤한 시점.
 */
const SCROLL_TO_BOTTOM_THRESHOLD = 200;

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
function ChatRoomPageContent({ params }: PageProps) {
  const { roomId } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // 비로그인 게이트 — /portfolio와 동일한 패턴.
  // 직접 URL로 진입했어도 미인증이면 /login으로 보낸다.
  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login');
  }, [authLoading, user, router]);

  // §15 진입 시점 기록 — find-or-create로 재사용된 빈 방은 createdAt이 옛 시각이라
  // RoomList timeline에서 옛 자리에 박힘. 진입 시점을 sessionStorage에 기록해
  // 사용자가 "지금 진입한 방"이 timeline 적절 위치에 끼워지게.
  // (메시지 있는 방은 lastMessageAt 우선이라 영향 없음 — 빈 방에만 작용)
  useEffect(() => {
    if (typeof window === 'undefined' || !roomId) return;
    try {
      window.sessionStorage.setItem(`chat-entered-${roomId}`, String(Date.now()));
    } catch {
      // 무시 (private mode 등)
    }
  }, [roomId]);

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
    emitTyping,
  } = useChatSocket();
  const { setRoomUnread } = useChatNotifications();

  const [room, setRoom] = useState<ChatRoomWithMembers | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  /** 첨부 picker — 클립/paste/drag-drop으로 받은 파일들을 업로드 후 마커로 변환 */
  const pickerRef = useRef<AttachmentPickerHandle | null>(null);
  /** 첨부 draft 개수 (>0이면 텍스트 없이도 전송 가능) — picker가 onDraftsChange로 push */
  const [attachmentCount, setAttachmentCount] = useState(0);

  /** 입력 미리보기 슬라이딩 패널 — 마크다운 렌더 결과 확인용 */
  const [previewOpen, setPreviewOpen] = useState(false);

  // ---------------------------------------------------------
  // Draft 영속화 — localStorage 방별 키
  // 페이지 이동·새로고침 후에도 작성 중이던 임시 메시지 보존.
  // - 키: `chat-draft-${roomId}`
  // - 마운트 시 복원, 입력 변경 시 debounce 저장, 전송 또는 빈 입력 시 제거
  // ---------------------------------------------------------
  const draftStorageKey = `chat-draft-${roomId}`;

  // 마운트(또는 roomId 변경) 시 저장된 draft 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) setDraft(saved);
      else setDraft(''); // 다른 방으로 이동 시 옛 draft 잔존 방지
    } catch {
      // private mode 등 storage 접근 실패 — 무시
    }
  }, [draftStorageKey]);

  // draft 변경 시 debounce로 저장 (입력 한 글자마다 storage write 부담 회피)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      try {
        if (draft) {
          localStorage.setItem(draftStorageKey, draft);
        } else {
          localStorage.removeItem(draftStorageKey);
        }
      } catch {
        // 무시
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft, draftStorageKey]);

  // textarea 자동 높이 조정 — content-line별 늘어났다 줄어듦.
  // height='auto' 한 번 → scrollHeight 측정 → min(200, ...)으로 클램프.
  // 200px 초과 시점부터 contentOverflows=true → overflow-y-auto로 스크롤바 노출.
  // 그 전에는 overflow-y-hidden — 빈 입력 시 우측에 스크롤 트랙이 보이는 현상 차단.
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const overflows = ta.scrollHeight > 200;
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    setContentOverflows(overflows);
  }, [draft]);

  /** 편집 모드 — 한 번에 한 메시지만. null이면 편집 모드 아님 */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  /**
   * 답글 대상 — null이면 일반 메시지. 객체 보유 시 다음 message:send에 parentId 포함
   * (UI: 입력창 위에 "○○○에게 답글" 미리보기 표시)
   */
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);

  // §15 빈 방 떠남 가드 — 메시지/draft/replyTo 모두 비었을 때만 보호 등록.
  // 사용자가 navigate 시 confirm dialog. 모든 anchor click을 document capture phase로
  // 가로채므로 Header/RoomList/"뒤로" 어디서 클릭하든 자동 cover (Link onClick 불필요).
  // 새로고침/탭 닫기는 beforeunload listener (브라우저 기본 dialog).
  // unmount/메시지 보낸 후 보호 해제.
  //
  // !loading 가드 필수 — fetch 진행 중엔 messages가 빈 배열로 초기화돼있을 뿐 진짜 빈 방인지
  // 모름. loading 중에 가드 set하면 fetch 끝나기 전 navigate 시 confirm이 잘못 뜬다.
  // error 케이스도 제외 — 멤버 아님/방 없음 등 실패 시엔 가드 의미 없음.
  useEffect(() => {
    if (!roomId) return;
    const isEmpty =
      !loading &&
      !error &&
      messages.length === 0 &&
      draft.trim().length === 0 &&
      !replyTo;
    if (isEmpty) {
      setEmptyRoomGuard(roomId);
    } else {
      clearEmptyRoomGuard();
    }

    if (!isEmpty || typeof window === 'undefined') return;

    // 1) 새로고침/탭 닫기 — 브라우저 기본 dialog
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = EMPTY_ROOM_LEAVE_MESSAGE; // 일부 옛 브라우저용 — 커스텀 문구는 무시됨
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // 2) 페이지 내 anchor 클릭 — capture phase로 모든 Link를 일괄 가로챔.
    //    Header(홈/recruit/team/portfolio/chat/profile) + RoomList 다른 채팅 + "뒤로" 버튼
    //    + 채팅창 내 인앱 link 카드까지 모두 cover.
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const anchor = (e.target as HTMLElement | null)?.closest(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank') return; // 새 탭 — 현재 페이지 안 떠남
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return; // 같은 페이지 anchor / mail / tel
      }
      // 현재 채팅방 자체 클릭은 통과 (idempotent)
      if (href === window.location.pathname) return;
      // confirm 거부 시 navigation 차단
      if (!window.confirm(EMPTY_ROOM_LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener('click', onClickCapture, true);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [roomId, loading, error, messages.length, draft, replyTo]);

  // 페이지 unmount 시 항상 guard 해제
  useEffect(() => {
    return () => {
      clearEmptyRoomGuard();
    };
  }, []);

  /**
   * 타이핑 인디케이터 — 다른 멤버가 입력 중인지 추적.
   * Map<userId, fallback timer> — typing:true 받으면 5초 fallback timer (stop 못 받았을 때).
   * `stop` 받으면 즉시 제거.
   */
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  /** 본인 타이핑 emit debounce — 첫 입력에 true, 2초 idle에 false */
  const ownTypingEmittedRef = useRef(false);
  const ownTypingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  /** 무한 스크롤 — 위쪽으로 이전 메시지 페이징 */
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /** DOM refs */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  /** 입력창 — textarea 자동 높이 조정용 (max 200px). content-line별 늘어났다 줄어듦 */
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  /** content가 max-height 초과한 시점부터만 스크롤바/드래그 핸들 노출 — 빈 입력 상태에서 우측에
   *  스크롤 트랙이 항상 보이는 macOS "스크롤바 항상 표시" 설정 환경 회피 */
  const [contentOverflows, setContentOverflows] = useState(false);

  /** "맨 아래로 가기" 버튼 노출 여부 — 메시지 영역에서 사용자가 임계만큼 위로 스크롤한 상태.
   *  카카오톡 패턴: 일정량 위로 스크롤 시 노출 → 클릭 시 맨 아래 도착하며 버튼도 자동 사라짐. */
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  /** 자동 스크롤 가드 — 마지막으로 본 메시지 id (변경 추적용) */
  const lastMessageIdRef = useRef<string | null>(null);
  /** 첫 로드 시 무조건 맨 아래로 한 번 — 그 이후에만 가드 적용 */
  const initialScrolledRef = useRef(false);

  // ---------------------------------------------------------
  // 양식 시스템 (Phase A)
  // ---------------------------------------------------------
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as MessageContext | null;
  const teamIdParam = searchParams.get('teamId');

  /** 슬라이딩 패널 열림 여부 */
  const [panelOpen, setPanelOpen] = useState(false);
  /** 패널 단계 — RECRUIT_TEAM은 직군 선택부터 / 그 외엔 미리보기 직접 */
  const [panelStep, setPanelStep] = useState<'role-select' | 'preview'>(
    'preview',
  );
  /** 직군 선택 결과 (RECRUIT_TEAM) */
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  /** Backend에서 받은 raw 양식 본문 */
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  /** 팀 contact 정보 (RECRUIT_TEAM) — 모집 직군 + 받는 사람 이름 */
  const [teamContact, setTeamContact] = useState<TeamApplicationContact | null>(
    null,
  );

  // 패널 열릴 때 양식 fetch (이미 있으면 재사용)
  useEffect(() => {
    if (!context || templateContent !== null) return;
    void api
      .get<{ data: MessageTemplate }>(`/api/templates?context=${context}`)
      .then((res) => setTemplateContent(res.data.data.content))
      .catch(() => {
        // 실패해도 default 합성 백엔드 fallback 동작 — 그래도 실패하면 빈 양식
        setTemplateContent('안녕하세요, 잘 부탁드립니다.');
      });
  }, [context, templateContent]);

  // 팀 contact (RECRUIT_TEAM) — 모집 직군 + 팀 이름
  useEffect(() => {
    if (context !== 'RECRUIT_TEAM' || !teamIdParam || teamContact) return;
    void api
      .get<{ data: TeamApplicationContact }>(
        `/api/teams/${teamIdParam}/contact`,
      )
      .then((res) => setTeamContact(res.data.data))
      .catch(() => setTeamContact(null));
  }, [context, teamIdParam, teamContact]);

  // 양식 트리거 노출 조건 — 본인이 alive 상태로 보낸 메시지가 0개일 때
  // 단순 messages.length를 보면 다음 케이스에서 양식이 안 떠 어색했음:
  //  - 본인 또는 상대방이 첫 메시지 보낸 후 즉시 삭제 (deletedAt만 있는 placeholder 1개)
  //  - 상대방만 메시지 보내고 본인은 아직 응답 X (본인 입장에서 첫 응답 시점)
  // soft-deleted 메시지는 backend가 그대로 응답에 포함 → 클라이언트가 placeholder 렌더.
  // 따라서 트리거 판단에선 deletedAt 제외 + senderId 본인만 카운트.
  const myAliveMessageCount = useMemo(
    () =>
      user
        ? messages.filter(
            (m) => m.deletedAt === null && m.senderId === user.id,
          ).length
        : 0,
    [messages, user],
  );

  const shouldShowTemplateTrigger =
    !!context && !!user && myAliveMessageCount === 0 && !loading;

  /** 받는 사람 이름 — DIRECT면 상대 멤버, GROUP이면 방 이름 또는 첫 멤버 */
  const recipientName = useMemo(() => {
    if (!room || !user) return '';
    const others = room.members
      .filter((m) => m.userId !== user.id)
      .map((m) => m.user?.name)
      .filter((n): n is string => !!n);
    if (others.length === 0) return room.name ?? '';
    if (room.type === 'GROUP') return room.name ?? others.join(', ');
    return others[0] ?? '';
  }, [room, user]);

  /** 변수 치환된 양식 본문 (preview / 보내기 공통) */
  const renderedTemplate = useMemo(() => {
    if (!templateContent || !user) return '';
    const profileUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/profile/${user.id}`
        : `/profile/${user.id}`;
    const vars: TemplateVars = {
      senderName: user.name,
      senderId: user.id,
      recipientName,
      role: selectedRole ?? undefined,
      teamName: teamContact?.teamName,
      profileUrl,
    };
    return renderTemplate(templateContent, vars);
  }, [templateContent, user, recipientName, selectedRole, teamContact]);

  /** 양식 트리거 클릭 — 패널 열고 첫 단계 결정 */
  const openTemplatePanel = useCallback(() => {
    if (context === 'RECRUIT_TEAM' && !selectedRole) {
      setPanelStep('role-select');
    } else {
      setPanelStep('preview');
    }
    setPanelOpen(true);
  }, [context, selectedRole]);

  const handleRoleSelect = useCallback((role: string) => {
    setSelectedRole(role);
    setPanelStep('preview');
  }, []);

  /** [보내기] — 양식 본문에 attachment 마커 보장 후 sendMessage 호출 */
  const handleTemplateSend = useCallback(async () => {
    if (!user || !room) return;
    const finalContent = ensureProfileAttachment(
      renderedTemplate,
      user.id,
      user.name,
    );
    await sendMessage({ roomId: room.id, content: finalContent });
    setPanelOpen(false);
  }, [renderedTemplate, room, sendMessage, user]);

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
        // 진단 친화 에러 — 원인별 분기:
        //  - response 있음(서버가 응답): 백엔드 message 그대로 (Forbidden/NotFound/Validation 등)
        //  - response 없음 + code 'ECONNABORTED' or message 'timeout': 타임아웃
        //  - response 없음 + 그 외: 네트워크/CORS 등 — 브라우저는 진짜 원인 가림
        //  - 콘솔에 풀 에러 덤프 — 사용자가 직접 확인 가능하게
        // eslint-disable-next-line no-console
        console.error('[chat] room load failed:', e);
        const err = e as {
          response?: { status?: number; data?: { message?: string } };
          code?: string;
          message?: string;
        };
        let msg = '채팅방 정보를 불러오지 못했습니다.';
        if (err.response) {
          const status = err.response.status;
          const serverMsg = err.response.data?.message;
          msg = serverMsg
            ? `${serverMsg}${status ? ` (HTTP ${status})` : ''}`
            : `서버 오류 (HTTP ${status ?? '?'})`;
        } else if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message ?? '')) {
          msg = '서버 응답이 너무 늦습니다 (15초 timeout). 백엔드/네트워크 상태를 확인해주세요.';
        } else if (err.message) {
          msg = `요청 실패: ${err.message}`;
        }
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
        //  - 이미 같은 real id 있으면 중복 방지 (ack가 broadcast보다 먼저 도착한 케이스)
        //  - 본인이 보낸 메시지 broadcast는 자기 __pending tempId를 즉시 제거 (UX: "전송중..." + 완료 메시지가 동시에 보이는 현상 해소)
        //    이전엔 ack 핸들러에서만 tempId 제거 → 3초+ latency 환경에서 두 메시지가 동시 표시되던 문제 fix
        if (prev.some((m) => m.id === msg.id)) return prev;
        let next = prev;
        if (msg.senderId === user?.id) {
          next = prev.filter(
            (m) => !(m.__pending && m.content === msg.content),
          );
        }
        return [...next, msg];
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

    // 타이핑 인디케이터 — 본인 제외 isTyping=true/false 토글, fallback 5초 timer
    const onTypingUpdate = (data: {
      roomId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (data.roomId !== roomId) return;
      if (data.userId === user?.id) return; // backend가 본인 제외 broadcast하지만 안전망
      const timers = typingTimersRef.current;
      const existing = timers.get(data.userId);
      if (existing) clearTimeout(existing);

      if (data.isTyping) {
        setTypingUserIds((prev) => {
          if (prev.has(data.userId)) return prev;
          const next = new Set(prev);
          next.add(data.userId);
          return next;
        });
        // 5초 안에 새 update 안 오면 자동 제거 (stop 못 받았을 때 안전망)
        const timer = setTimeout(() => {
          setTypingUserIds((prev) => {
            if (!prev.has(data.userId)) return prev;
            const next = new Set(prev);
            next.delete(data.userId);
            return next;
          });
          timers.delete(data.userId);
        }, 5000);
        timers.set(data.userId, timer);
      } else {
        setTypingUserIds((prev) => {
          if (!prev.has(data.userId)) return prev;
          const next = new Set(prev);
          next.delete(data.userId);
          return next;
        });
        timers.delete(data.userId);
      }
    };

    // 다른 멤버 읽음 갱신 broadcast — room.members[].lastReadMessageId 갱신해
    // per-message unread badge 즉시 재계산
    const onRoomReadUpdated = (data: {
      roomId: string;
      userId: string;
      lastReadMessageId: string;
    }) => {
      if (data.roomId !== roomId) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: prev.members.map((m) =>
            m.userId === data.userId
              ? { ...m, lastReadMessageId: data.lastReadMessageId }
              : m,
          ),
        };
      });
    };

    socket.on('message:new', onMessageNew);
    socket.on('message:edited', onMessageEdited);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('reaction:added', onReactionAdded);
    socket.on('reaction:removed', onReactionRemoved);
    socket.on('typing:update', onTypingUpdate);
    socket.on('room:readUpdated', onRoomReadUpdated);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:edited', onMessageEdited);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('reaction:added', onReactionAdded);
      socket.off('reaction:removed', onReactionRemoved);
      socket.off('typing:update', onTypingUpdate);
      socket.off('room:readUpdated', onRoomReadUpdated);
      // 방 떠날 때 자기 typing stop emit (잔여 타이머 cleanup)
      if (ownTypingEmittedRef.current) {
        emitTyping(roomId, false);
        ownTypingEmittedRef.current = false;
      }
      if (ownTypingIdleTimerRef.current) {
        clearTimeout(ownTypingIdleTimerRef.current);
        ownTypingIdleTimerRef.current = null;
      }
      // 받은 typing fallback 타이머 정리
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      setTypingUserIds(new Set());
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
    emitTyping,
    user?.id,
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
  // "맨 아래로 가기" 버튼 — 카카오톡 패턴 (사용자가 위로 스크롤하면 노출, 클릭/도착 시 자동 숨김)
  //
  // 정책:
  //  - 컨테이너 scroll 이벤트마다 distanceFromBottom 측정
  //  - distanceFromBottom > SCROLL_TO_BOTTOM_THRESHOLD(200px) → 버튼 visible
  //  - 버튼 클릭 → smooth scrollIntoView → 도착하면서 자연스럽게 distance < threshold → 자동 숨김
  //  - { passive: true } — scroll 이벤트는 빈번해서 listener가 main thread block하면 안됨
  // ---------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance =
        container.scrollHeight - (container.scrollTop + container.clientHeight);
      setShowScrollToBottom(distance > SCROLL_TO_BOTTOM_THRESHOLD);
    };
    // 초기 상태 계산 — 메시지 로드 직후나 방 변경 직후 정확히 반영
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [messages.length]);
  // messages.length deps — 메시지 prepend(loadOlder)나 새 메시지 도착 시 distance 재계산.
  // 컨테이너 ref 자체는 마운트 후 안정.

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
    let content = draft.trim();
    const hasAttachments = pickerRef.current?.hasItems() ?? false;
    // 텍스트도 없고 첨부도 없으면 전송 안 함
    if (!content && !hasAttachments) return;
    if (sending || !user) return;

    // 길이 사전 검증 — backend @MaxLength(4000) 초과 시 ack 콜백이 resolve 안 되어
    // "전송 중..." 영원히 표시되는 함정 회피. 사용자에 즉시 알림.
    if (content.length > MAX_MESSAGE_LENGTH) {
      window.alert(
        `메시지가 너무 깁니다. (${MAX_MESSAGE_LENGTH.toLocaleString()}자 이하)\n현재 ${content.length.toLocaleString()}자`,
      );
      return;
    }

    setSending(true);

    // 첨부가 있으면 업로드 완료 대기 후 마커 append
    if (hasAttachments && pickerRef.current) {
      const markers = await pickerRef.current.flushToMarkers();
      if (markers.length > 0) {
        content = content ? `${content}\n\n${markers.join('\n')}` : markers.join('\n');
      } else if (!content) {
        // 모든 첨부가 실패 + 텍스트 없음 → 전송 중단
        setSending(false);
        window.alert('첨부 업로드에 실패해 전송할 수 없습니다.');
        return;
      }
    }

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
    // 전송 즉시 영속 draft 제거 — debounce 대기 없이 (다음 마운트 시 복원 방지)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // 무시
      }
    }
    setReplyTo(null); // 전송 즉시 답글 모드 해제
    // 전송 즉시 타이핑 stop emit (idle timer 대기 안 함)
    if (ownTypingEmittedRef.current) {
      emitTyping(roomId, false);
      ownTypingEmittedRef.current = false;
    }
    if (ownTypingIdleTimerRef.current) {
      clearTimeout(ownTypingIdleTimerRef.current);
      ownTypingIdleTimerRef.current = null;
    }

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
    // 길이 검증 — backend EditMessageDto @MaxLength(4000)와 동기.
    // 초과 시 ack resolve 안 되어 편집 모드가 풀린 채 무반응 — 사전 차단 필수.
    if (content.length > MAX_MESSAGE_LENGTH) {
      window.alert(
        `메시지가 너무 깁니다. (${MAX_MESSAGE_LENGTH.toLocaleString()}자 이하)\n현재 ${content.length.toLocaleString()}자`,
      );
      return;
    }
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

  // 어떤 사이드 패널이든 열렸는지 — 채팅창/RoomList 슬라이드 트리거
  // (panel(인사 양식) 또는 preview(입력 미리보기) 둘 중 하나라도 open이면 true)
  const anyPanelOpen = panelOpen || previewOpen;

  return (
    <div className="relative h-[calc(100vh-11rem)] overflow-hidden">
      {/* 좌측 사이드바 — xl(1280px)+ 에서만 노출. 패널 열리면 왼쪽으로 슬라이드 아웃 + 페이드.
          overflow-hidden(부모) 덕에 -translate-x-full로 화면 밖으로 빠져나가도 clip됨. */}
      <aside
        className={`absolute right-[calc(50%+21rem)] top-0 hidden h-full w-72 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-300 ease-out xl:flex ${
          anyPanelOpen
            ? 'xl:pointer-events-none xl:-translate-x-[150%] xl:opacity-0'
            : ''
        }`}
      >
        <RoomList />
      </aside>

      {/* 채팅창 — 패널 열리면 xl에서 좌측으로 -12rem(=-translate-x-48) 이동.
          xl viewport 1280px에서 chat right edge가 정확히 panel xl:w-[32rem] left edge에 닿게 됨 → 가림 방지. */}
      <div
        className={`mx-auto flex h-full max-w-[40rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-transform duration-300 ease-out ${
          anyPanelOpen ? 'xl:-translate-x-48' : ''
        }`}
      >
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          aria-label="채팅 목록으로"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>뒤로</span>
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          {room?.type === 'DIRECT' ? (
            <UserIcon className="h-4 w-4" />
          ) : (
            <UsersIcon className="h-4 w-4" />
          )}
        </div>
        <h2 className="font-medium">{loading ? '…' : roomTitle(room, user?.id)}</h2>
        <span
          className={`ml-auto inline-flex items-center gap-1 text-xs ${
            isConnected ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          {isConnected ? (
            <DotFilledIcon className="h-3 w-3" />
          ) : (
            <DotOutlineIcon className="h-3 w-3" />
          )}
          <span>{isConnected ? '연결됨' : '연결 끊김'}</span>
        </span>
      </div>

      {/* 메시지 영역 — relative 래퍼: 스크롤 컨테이너 + "맨 아래로" 떠있는 버튼 anchor */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 space-y-2 overflow-y-auto p-4"
        >
          {/* 위로 스크롤 시 옛 메시지 페이징 trigger */}
          {nextCursor && (
            <div
              ref={topSentinelRef}
              className="py-2 text-center text-xs text-gray-400"
            >
              {loadingMore ? (
              '이전 메시지 불러오는 중…'
            ) : (
              <span className="inline-flex items-center gap-1">
                <ArrowUpIcon className="h-3 w-3" />
                <span>더 위로 스크롤하여 이전 메시지 보기</span>
              </span>
            )}
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
            (() => {
              // 카톡식 그룹 메타 — 같은 발신자 + 같은 분 burst의 진입점/마지막 위치 식별.
              // 매 render마다 O(N) 재계산되지만 N이 작아 비용 무시. useMemo로 묶지 않음.
              const groups = computeMessageGroups(messages);
              return messages.map((msg, i) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  myId={user?.id}
                  showName={groups[i].showName}
                  showTime={groups[i].showTime}
                  isEditing={editingId === msg.id}
                  editDraft={editDraft}
                  onEditDraftChange={setEditDraft}
                  onStartEdit={() => startEdit(msg)}
                  onSubmitEdit={submitEdit}
                  onCancelEdit={cancelEdit}
                  onDelete={() => handleDelete(msg)}
                  onReply={() => startReply(msg)}
                  onToggleReaction={(emoji) => toggleReaction(msg, emoji)}
                  unreadBy={computeUnreadBy(msg, room, user?.id, messages)}
                />
              ));
            })()}

          <div ref={messagesEndRef} />
        </div>

        {/* 맨 아래로 가기 버튼 — 카카오톡 패턴.
            메시지 영역 우상자만 우측 하단에 떠 있음. 사용자가 200px 이상 위로 스크롤하면 fade-in.
            클릭 시 smooth scroll → 자연스럽게 distance < threshold 되며 자동 사라짐 */}
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="맨 아래로 가기"
          title="맨 아래로 가기"
          className={`absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-lg transition-all duration-200 hover:bg-gray-50 hover:text-gray-900 ${
            showScrollToBottom
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      </div>

      {/* 타이핑 인디케이터 — 다른 멤버가 입력 중일 때만 노출. 입력창 바로 위 얇은 줄. */}
      {typingUserIds.size > 0 && room && (
        <div className="flex items-center gap-1 border-t border-gray-200 bg-gray-50 px-4 py-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-0.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-gray-400" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-gray-400 [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-gray-400 [animation-delay:300ms]" />
          </span>
          <span>
            {(() => {
              const names = Array.from(typingUserIds)
                .map(
                  (uid) =>
                    room.members.find((m) => m.userId === uid)?.user?.name ?? '상대방',
                )
                .filter(Boolean);
              if (names.length === 1) return `${names[0]}님이 입력 중...`;
              if (names.length === 2) return `${names[0]}, ${names[1]}님이 입력 중...`;
              return `${names[0]} 외 ${names.length - 1}명이 입력 중...`;
            })()}
          </span>
        </div>
      )}

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

      {/* 양식 트리거 — 메시지 0건 + context query 있을 때만 노출 (Phase A) */}
      {shouldShowTemplateTrigger && (
        <TemplateTrigger onClick={openTemplatePanel} />
      )}

      {/* 첨부 picker — drafts UI(progress chip) + hidden file input. form 바로 위에 */}
      <AttachmentPicker
        ref={pickerRef}
        roomId={roomId}
        disabled={!isConnected}
        onDraftsChange={setAttachmentCount}
      />

      {/* 입력 */}
      <form
        onSubmit={handleSend}
        onDragOver={(e) => {
          // drag-drop 영역으로 입력 form 전체 활용
          if (!isConnected) return;
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          if (!isConnected) return;
          const files = Array.from(e.dataTransfer.files);
          if (files.length === 0) return;
          e.preventDefault();
          pickerRef.current?.addFiles(files);
        }}
        className="flex items-end gap-2 border-t border-gray-200 bg-white p-4"
      >
        {/* multi-line 입력 — Enter=전송, Shift+Enter=줄바꿈 (Slack/Discord 표준).
            input → textarea로 바꾸면서 마크다운 본문(여러 줄 헤딩, 빈 줄, 표 등)이 정상 작성 가능.
            scrollHeight 기반 auto-resize (max 200px) — useEffect [draft]에서 갱신 */}
        {/* 클립 버튼 — 첨부 picker의 file input trigger */}
        <AttachmentClipButton picker={pickerRef} disabled={!isConnected} />
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            // 타이핑 인디케이터 — 빈 입력은 stop, 내용 있으면 첫 입력에 start + 2초 idle에 stop
            if (!isConnected) return;
            if (!next.trim()) {
              if (ownTypingEmittedRef.current) {
                emitTyping(roomId, false);
                ownTypingEmittedRef.current = false;
              }
              if (ownTypingIdleTimerRef.current) {
                clearTimeout(ownTypingIdleTimerRef.current);
                ownTypingIdleTimerRef.current = null;
              }
              return;
            }
            if (!ownTypingEmittedRef.current) {
              emitTyping(roomId, true);
              ownTypingEmittedRef.current = true;
            }
            if (ownTypingIdleTimerRef.current) {
              clearTimeout(ownTypingIdleTimerRef.current);
            }
            ownTypingIdleTimerRef.current = setTimeout(() => {
              emitTyping(roomId, false);
              ownTypingEmittedRef.current = false;
            }, 2000);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          onPaste={(e) => {
            if (!isConnected) return;
            // 클립보드에 파일(이미지 캡처 등)이 있으면 picker로 흘려보냄
            const items = Array.from(e.clipboardData.items);
            const files: File[] = [];
            for (const item of items) {
              if (item.kind === 'file') {
                const f = item.getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length > 0) {
              e.preventDefault();
              pickerRef.current?.addFiles(files);
            }
          }}
          placeholder={
            replyTo
              ? `${replyTo.sender.name}님에게 답글 작성…`
              : isConnected
                ? '메시지를 입력하세요... (Shift+Enter로 줄바꿈)'
                : '연결 대기 중…'
          }
          disabled={!isConnected}
          rows={1}
          className={`input-field flex-1 resize-none disabled:bg-gray-50 ${
            contentOverflows ? 'overflow-y-auto' : 'overflow-y-hidden'
          }`}
          style={{ maxHeight: '200px' }}
        />
        {/* 입력 미리보기 — 마크다운 렌더 결과를 슬라이딩 패널로. 토글 동작:
            - 닫힌 상태에서 클릭: open (단, draft 비어 있으면 비활성)
            - 열린 상태에서 클릭: close (draft 상관없이 — 패널 닫기 의도) */}
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          disabled={!previewOpen && !draft.trim()}
          aria-label={previewOpen ? '미리보기 닫기' : '입력 미리보기'}
          aria-pressed={previewOpen}
          title={previewOpen ? '미리보기 닫기' : '마크다운 미리보기'}
          className={`rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
            previewOpen
              ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <PreviewIcon />
        </button>
        <button
          type="submit"
          className="btn-primary disabled:opacity-50"
          disabled={
            !isConnected ||
            sending ||
            (draft.trim().length === 0 && attachmentCount === 0) ||
            draft.length > MAX_MESSAGE_LENGTH
          }
        >
          전송
        </button>
      </form>
      {/* 글자수 카운터 — 임계(3500자) 도달 시만 노출. 초과 시 빨강 + 에러 메시지.
          항상 노출하면 시각 노이즈 — 일반 입력엔 보일 필요 없음 */}
      {draft.length >= COUNTER_THRESHOLD && (
        <div
          className={`flex justify-end px-4 pb-2 text-xs ${
            draft.length > MAX_MESSAGE_LENGTH ? 'text-red-600' : 'text-gray-500'
          }`}
        >
          {draft.length > MAX_MESSAGE_LENGTH
            ? `메시지가 너무 깁니다. (${MAX_MESSAGE_LENGTH.toLocaleString()}자 이하) — 현재 ${draft.length.toLocaleString()}자`
            : `${draft.length.toLocaleString()} / ${MAX_MESSAGE_LENGTH.toLocaleString()}자`}
        </div>
      )}
      </div>

      {/* 양식 슬라이딩 패널 (Phase A) — RECRUIT_TEAM은 직군 선택부터 / 그 외 컨텍스트는 미리보기 직접 */}
      <SlidingPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={
          panelStep === 'role-select' ? '지원 분야 선택' : '인사 양식 미리보기'
        }
      >
        {panelStep === 'role-select' && (
          <RoleSelector
            roles={teamContact?.recruitingRoles ?? []}
            onSelect={handleRoleSelect}
          />
        )}
        {panelStep === 'preview' && (
          <TemplatePreview
            rendered={renderedTemplate}
            onSend={handleTemplateSend}
            disabled={!isConnected}
          />
        )}
      </SlidingPanel>

      {/* 입력 미리보기 슬라이딩 패널 — draft를 마크다운 렌더로 즉시 확인 (Stance B 정책 docs/chat/09).
          md 이상: 채팅창 좌측 이동 + 우측 슬라이드 인 (split-shift, no backdrop) /
          md 미만: fullscreen modal (SlidingPanel 자체가 반응형) */}
      <SlidingPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="입력 미리보기"
      >
        {draft.trim() ? (
          <MessageMarkdown content={draft} />
        ) : (
          <p className="text-sm text-gray-400">
            입력창에 텍스트를 입력하면 여기에 렌더 결과가 보여요.
          </p>
        )}
      </SlidingPanel>
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
  showName,
  showTime,
  isEditing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
  onReply,
  onToggleReaction,
  unreadBy,
}: {
  message: LocalMessage;
  myId: string | undefined;
  /** 그룹의 첫 메시지 — 발신자 이름 노출 여부 (타인 메시지에만 의미 있음) */
  showName: boolean;
  /** 그룹의 마지막 메시지 — 타임스탬프 노출 여부 (같은 분 연속 발화의 끝에서만 true) */
  showTime: boolean;
  isEditing: boolean;
  editDraft: string;
  onEditDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  onToggleReaction: (emoji: string) => void;
  /** 본인 메시지일 때, 아직 읽지 않은 다른 멤버 수 (카톡 "1" 패턴). 0이면 숨김. */
  unreadBy: number;
}) {
  const isMine = message.senderId === myId;
  const time = formatTime(message.createdAt);

  // 원문(raw 마크다운) 클립보드 복사. attachment 마커는 빼고 사용자가 보는 본문만 복사.
  const [copied, setCopied] = useState(false);
  const handleCopyRaw = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const parsedForCopy = parseAttachmentMarker(message.content);
    navigator.clipboard
      .writeText(parsedForCopy.cleanContent)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {
        // 권한 거부/non-secure context — silent fail.
      });
  }, [message.content]);

  if (message.deletedAt) {
    // 삭제된 메시지 — 시스템 라인 (그룹/이름 무관, 가운데 정렬)
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs italic text-gray-400">
          삭제된 메시지입니다
        </div>
      </div>
    );
  }

  // 편집 모드 — 본인 메시지 inline textarea (말풍선 유지)
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

  // 낙관적 UI 상태에 따른 시각 변형 — 말풍선/첨부 모두에 적용
  // ring은 element의 자체 border-radius를 따르므로, 적용 대상이 rounded 클래스를 갖고 있어야 함.
  // 말풍선(rounded-2xl), 첨부 wrapper(rounded-xl)에 각각 적용.
  const stateClass = message.__pending
    ? 'opacity-60'
    : message.__failed
      ? 'opacity-80 ring-2 ring-red-400'
      : '';

  const stateLabel: React.ReactNode = message.__pending ? (
    '전송 중…'
  ) : message.__failed ? (
    <span className="inline-flex items-center gap-1">
      <AlertTriangleIcon className="h-3 w-3" />
      <span>전송 실패</span>
    </span>
  ) : null;

  // 편집/삭제 가능 여부 — 본인 + 정상 상태(아직 미확정 메시지 X)
  const canMutate = isMine && !message.__pending && !message.__failed;
  const canReact = !message.__pending && !message.__failed;
  const groupedReactions = groupReactions(message.reactions, myId);

  // 본문 + 첨부 파싱. 텍스트가 있거나 답글 인용이 있으면 말풍선 렌더,
  // 첨부만 있으면 말풍선 없이 첨부만 단독 (KakaoTalk 스타일).
  const parsed = parseAttachmentMarker(message.content);
  const hasText = parsed.cleanContent.trim().length > 0;
  const hasAttachments = parsed.attachments.length > 0;
  const hasTextBubble = hasText || (!!message.parent && !hasAttachments);

  // 액션 버튼 묶음 — mine/non-mine 공통 (편집·삭제만 mine 한정 분기)
  const actionButtons = (
    <>
      {canReact && <ReactionPicker onPick={onToggleReaction} />}
      <button
        type="button"
        onClick={onReply}
        className="rounded p-[3px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="답글"
        title="답글"
      >
        <ReplyIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={handleCopyRaw}
        className="rounded p-[3px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="원문 복사 (마크다운 그대로)"
        title={copied ? '복사됨!' : '원문 복사 (마크다운 그대로)'}
      >
        {copied ? (
          <CheckIcon className="h-3 w-3 text-green-600" />
        ) : (
          <ClipboardIcon className="h-3 w-3" />
        )}
      </button>
      {canMutate && (
        <>
          <button
            type="button"
            onClick={onStartEdit}
            className="rounded p-[3px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="메시지 편집"
            title="편집"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-[3px] text-gray-400 hover:bg-gray-100 hover:text-red-600"
            aria-label="메시지 삭제"
            title="삭제"
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </>
      )}
    </>
  );

  // 타임스탬프/액션 슬롯 — 콘텐츠 옆 하단 정렬. 액션은 항상 hover 시 timestamp 위에 등장.
  // showTime 없으면 timestamp는 렌더 안 함 (액션만 hover로 노출).
  // pending/failed면 stateLabel이 timestamp 자리 차지.
  const timestampSlot = (
    <div
      className={`flex shrink-0 select-none flex-col self-end pb-0.5 ${
        isMine ? 'items-end' : 'items-start'
      }`}
    >
      {/* hover: 액션 버튼 (timestamp 위) */}
      <div className="pointer-events-none flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        {actionButtons}
      </div>
      {/* default: timestamp + unread + state (showTime일 때만) */}
      {showTime && (
        <div
          className={`flex items-center gap-1 whitespace-nowrap text-[0.7rem] leading-none text-gray-400 ${
            isMine ? 'flex-row-reverse' : ''
          }`}
        >
          {isMine && !stateLabel && unreadBy > 0 && (
            <span
              className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[0.6rem] font-semibold leading-none text-primary-700"
              aria-label={`안 읽은 사람 ${unreadBy}명`}
              title={`${unreadBy}명 안 읽음`}
            >
              {unreadBy}
            </span>
          )}
          {stateLabel ? (
            <span
              className={message.__failed ? 'font-semibold text-red-500' : ''}
            >
              {stateLabel}
            </span>
          ) : (
            <>
              {message.editedAt && <span>(편집됨)</span>}
              <span>{time}</span>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`group flex items-end gap-1.5 ${
        isMine ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* mine: timestamp/액션 슬롯이 말풍선 LEFT */}
      {isMine && timestampSlot}

      {/* 콘텐츠 컬럼 — 발신자 이름 + 말풍선/첨부 + 반응.
          min-w-0 필수 — flex 기본 min-width:auto가 자식 intrinsic width(긴 코드 줄 등)에
          밀려 max-w-[70%]를 무력화시키는 것을 막음. min-w-0이 있어야 내부 pre의
          overflow-x-auto가 정상 발동해 가로 스크롤바가 뜬다. */}
      <div
        className={`flex min-w-0 max-w-[70%] flex-col gap-1 ${
          isMine ? 'items-end' : 'items-start'
        }`}
      >
        {/* 타인일 때 발신자 이름 — 그룹 첫 메시지에만 (말풍선 위 왼쪽) */}
        {!isMine && showName && (
          <p className="ml-1 text-xs font-medium text-gray-500">
            {message.sender.name}
          </p>
        )}

        {/* 텍스트 말풍선 — 텍스트 있거나, 답글만 있는 경우(첨부 없음). 첨부만 있는 케이스는
            아래 mini-quote로 답글 표시하고 말풍선 미렌더. */}
        {hasTextBubble && (
          <div
            className={`min-w-0 rounded-2xl px-4 py-2 ${
              isMine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-900'
            } ${stateClass}`}
          >
            {message.parent && (
              <div
                className={`mb-2 border-l-2 pl-2 text-xs ${
                  isMine
                    ? 'border-primary-300 text-primary-100'
                    : 'border-gray-400 text-gray-500'
                }`}
              >
                <p className="flex items-center gap-1 truncate italic">
                  <ReplyIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {message.parent.deletedAt
                      ? '(삭제된 메시지)'
                      : message.parent.content}
                  </span>
                </p>
              </div>
            )}
            {hasText && <MessageMarkdown content={parsed.cleanContent} />}
          </div>
        )}

        {/* 첨부만 + 답글 있는 케이스 — 작은 인용 라벨을 첨부 위에 (말풍선 대신) */}
        {message.parent && !hasTextBubble && (
          <div className="flex items-center gap-1 text-[0.7rem] italic text-gray-500">
            <ReplyIcon className="h-3 w-3 shrink-0" />
            <span className="max-w-[16rem] truncate">
              {message.parent.deletedAt
                ? '(삭제된 메시지)'
                : message.parent.content}
            </span>
          </div>
        )}

        {/* 첨부 — 말풍선 없이 단독 렌더 (이미지/파일 테두리 제거) */}
        {parsed.attachments.map((a, i) => {
          const key = `${a.type}-${a.target}-${i}`;
          if (a.type === 'image') {
            return (
              <div key={key} className={`rounded-xl ${stateClass}`}>
                <ImageAttachment attachment={a} isMine={isMine} />
              </div>
            );
          }
          if (a.type === 'file') {
            return (
              <div key={key} className={`rounded-xl ${stateClass}`}>
                <FileAttachmentCard attachment={a} isMine={isMine} />
              </div>
            );
          }
          // 인앱 link 카드 (profile/portfolio/team/external) — 기존 그대로 (말풍선 분리)
          return (
            <div key={key} className={stateClass}>
              <AttachmentButton attachment={a} isMine={isMine} />
            </div>
          );
        })}

        {/* 반응 — 말풍선 밖, 콘텐츠 아래 */}
        {groupedReactions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {groupedReactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(r.emoji)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  r.mine
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                aria-label={`${r.emoji} 반응 ${r.count}개${r.mine ? ' (내가 추가함)' : ''}`}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* non-mine: timestamp/액션 슬롯이 말풍선 RIGHT */}
      {!isMine && timestampSlot}
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
        className="rounded p-[3px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="반응 추가"
        title="반응"
      >
        <SmilePlusIcon className="h-3 w-3" />
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
              className="rounded p-[3px] text-xs hover:bg-gray-100"
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

export default function ChatRoomPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-11rem)] items-center justify-center" />}>
      <ChatRoomPageContent params={params} />
    </Suspense>
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

/**
 * 카톡 "1" 패턴 — 본인 메시지가 아직 읽지 않은 다른 멤버 수 계산.
 *
 * 모델 C (lastReadMessageId만 저장) 기반 client-side 계산:
 *  - 본인 메시지가 아니면 0 (다른 사람 메시지엔 표시 안 함)
 *  - 다른 멤버의 lastReadMessageId가 이 메시지보다 더 최신(이후)이면 그 멤버는 읽었음
 *  - 그렇지 않으면 안 읽음 — 그 멤버 수 카운트
 *
 * DIRECT: 결과 0 또는 1. GROUP: 0..(멤버 수 - 1).
 *
 * messages 배열을 같이 받아 id → index map으로 비교 (createdAt 비교 대신 array index — 더 안정적).
 * pending/failed 메시지 (서버 미저장)는 unread 계산에서 제외.
 */
function computeUnreadBy(
  message: LocalMessage,
  room: ChatRoomWithMembers | null,
  myId: string | undefined,
  messages: LocalMessage[],
): number {
  if (!room || !myId) return 0;
  if (message.senderId !== myId) return 0;
  if (message.__pending || message.__failed) return 0;

  // 메시지 id → createdAt 비교용 timestamp
  const thisMsgTime = new Date(message.createdAt).getTime();

  // 다른 멤버들 중, lastReadMessageId가 이 메시지보다 옛 것이거나 null인 사람 수
  const others = room.members.filter((m) => m.userId !== myId);
  let unreadCount = 0;
  for (const other of others) {
    if (!other.lastReadMessageId) {
      // 한 번도 안 읽음
      unreadCount += 1;
      continue;
    }
    const lastReadMsg = messages.find((m) => m.id === other.lastReadMessageId);
    if (!lastReadMsg) {
      // 그 메시지를 모름 (페이징 등으로 fetch 안 됨) — 안 읽은 걸로 보수적 처리
      unreadCount += 1;
      continue;
    }
    if (new Date(lastReadMsg.createdAt).getTime() < thisMsgTime) {
      // 그 멤버의 마지막 읽은 메시지가 이 메시지보다 이전 — 안 읽음
      unreadCount += 1;
    }
  }
  return unreadCount;
}

/**
 * 카카오톡식 메시지 그룹화 메타데이터 — 같은 발신자 + 같은 분(HH:MM)으로 묶어
 * 발신자 이름과 타임스탬프를 그룹의 양 끝에만 노출하기 위한 정보.
 *
 *  - showName: 직전 메시지의 senderId가 다르거나 첫 메시지 → 그룹 진입점에서 한 번만
 *  - showTime: 다음 메시지의 senderId가 다르거나 분(HH:MM)이 다르거나 마지막 메시지
 *              → 같은 분 연속 발화의 끝에서 한 번만
 *
 * pending/failed 메시지(임시 tempId, 아직 서버 미저장)에 대해서도 안정적으로 동작 —
 * createdAt이 클라이언트 새로 찍어둔 값이라 minute 비교 그대로 사용 가능.
 */
function computeMessageGroups(
  messages: LocalMessage[],
): Array<{ showName: boolean; showTime: boolean }> {
  return messages.map((msg, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;

    const minuteOf = (m: LocalMessage) => {
      // YYYY-MM-DDTHH:MM 정밀도. ISO string 16자리 슬라이스로 비교 — TZ 동일 가정(서버가 UTC ISO 반환).
      return new Date(m.createdAt).toISOString().slice(0, 16);
    };

    const prevSameSender = !!prev && prev.senderId === msg.senderId;
    const nextSameSender = !!next && next.senderId === msg.senderId;

    const thisMin = minuteOf(msg);
    const nextSameMinute = !!next && minuteOf(next) === thisMin;

    // 삭제된 메시지는 senderId 익명화돼 별도 시스템 라인으로 렌더되니, 그룹 경계로 취급
    // (이전이 삭제 → 다음 메시지는 showName=true 강제)
    const prevDeleted = !!prev && !!prev.deletedAt;
    const nextDeleted = !!next && !!next.deletedAt;

    const showName = !prev || !prevSameSender || prevDeleted;
    const showTime = !next || !nextSameSender || !nextSameMinute || nextDeleted;

    return { showName, showTime };
  });
}
