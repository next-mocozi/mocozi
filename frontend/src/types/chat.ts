// =====================================================
// 프론트엔드 채팅 타입 (shared/types/chat.ts와 동기)
//
// docker-compose.yml이 ./frontend만 마운트해서 @mocozi/shared 직접 import 불가.
// shared/types/chat.ts와 의미적으로 1:1 동기화. 변경 시 양쪽 모두 갱신 필수.
// Phase B에서 docker 마운트 통합되면 이 파일은 re-export 한 줄로 단순화 예정.
// =====================================================

// =====================================================
// Enum
// =====================================================

export type ChatRoomType = 'DIRECT' | 'GROUP' | 'CHANNEL';
export type ChatRoomMemberRole = 'MEMBER' | 'ADMIN';

// =====================================================
// 기본 모델 (Prisma 모델과 1:1)
// =====================================================

export interface ChatRoom {
  id: string;
  type: ChatRoomType;
  name: string | null;
  description: string | null;
  creatorId: string | null;
  /**
   * 진입 컨텍스트 — 어떤 페이지/맥락에서 시작된 방인지 (§17, RoomList 색 점).
   * 옛 방은 null. DIRECT find-or-create 시 첫 값 유지.
   */
  context: MessageContext | null;
  lastMessage: string | null;
  lastMessageAt: string | null; // JSON 직렬화 시 ISO string
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: ChatRoomMemberRole;
  lastReadMessageId: string | null;
  joinedAt: string;
  leftAt: string | null;
  hiddenAt: string | null;
  mutedAt: string | null;
  user?: {
    id: string;
    name: string;
    profileImage: string | null;
  };
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  parentId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

// =====================================================
// 화면 표시용 확장
// =====================================================

export interface ChatRoomWithMembers extends ChatRoom {
  members: ChatRoomMember[];
  unreadCount: number;
  /** 본인 멤버십 메타 — shapeRoom이 자동 합성 */
  mutedAt: string | null;
  hiddenAt: string | null;
}

export interface ChatMessageWithSender extends ChatMessage {
  sender: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  reactions: MessageReaction[];
  parent?: {
    id: string;
    content: string;
    senderId: string;
    deletedAt: string | null;
  } | null;
}

// =====================================================
// API 요청/응답
// =====================================================

export interface CreateRoomRequest {
  type: 'DIRECT' | 'GROUP';
  name?: string;
  description?: string;
  memberIds: string[];
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
  parentId?: string;
}

export interface EditMessagePayload {
  messageId: string;
  content: string;
}

export interface MarkAsReadPayload {
  roomId: string;
  messageId: string;
}

export interface ReactionPayload {
  messageId: string;
  emoji: string;
}

export interface MessagesPageResponse {
  messages: ChatMessageWithSender[];
  nextCursor: string | null;
}

export interface RoomsPageResponse {
  rooms: ChatRoomWithMembers[];
  nextCursor: string | null;
}

// =====================================================
// 인앱 알림 페이로드
// =====================================================

export interface NewMessageNotification {
  roomId: string;
  roomName: string | null;
  senderName: string;
  preview: string;
  unreadCount: number;
}

export interface UnreadCountChangedNotification {
  roomId: string;
  unreadCount: number;
}

// =====================================================
// Socket 이벤트 매핑 (서버 → 클라이언트)
// =====================================================

export interface ServerToClientEvents {
  // 방 단위 broadcast
  'message:new': (msg: ChatMessageWithSender) => void;
  'message:edited': (msg: ChatMessageWithSender) => void;
  'message:deleted': (data: {
    messageId: string;
    roomId: string;
    // 삭제로 lastMessage가 갱신된 경우만 포함. null이면 사이드바 갱신 X
    roomLastMessage?: {
      lastMessage: string | null;
      lastMessageAt: string | null;
    } | null;
  }) => void;
  'reaction:added': (r: MessageReaction & { roomId?: string }) => void;
  'reaction:removed': (data: {
    messageId: string;
    userId: string;
    emoji: string;
  }) => void;
  'member:joined': (data: { roomId: string; member: ChatRoomMember }) => void;
  'member:left': (data: { roomId: string; userId: string }) => void;
  'typing:update': (data: {
    roomId: string;
    userId: string;
    isTyping: boolean;
  }) => void;

  // 사용자 글로벌 broadcast (인앱 알림)
  'notification:newMessage': (n: NewMessageNotification) => void;
  'notification:unreadCountChanged': (n: UnreadCountChangedNotification) => void;
  // 메시지 삭제 등으로 방의 lastMessage가 변경됐을 때 — 사이드바(RoomList) 동기화용
  'notification:roomLastMessageChanged': (n: {
    roomId: string;
    lastMessage: string | null;
    lastMessageAt: string | null;
  }) => void;

  // 에러
  exception: (err: { code: string; message: string; payload?: unknown }) => void;
}

// =====================================================
// Socket 이벤트 매핑 (클라이언트 → 서버)
//
// 서버 핸들러가 ack 콜백을 통해 결과를 즉시 반환하는 경우, 클라이언트는
// emit의 마지막 인자로 콜백을 넘긴다. socket.io의 timeout 적용도 가능.
// =====================================================

export interface ClientToServerEvents {
  'conversation:join': (
    data: { roomId: string },
    ack?: (res: { ok: boolean; roomId: string; unreadCount: number }) => void,
  ) => void;
  'conversation:leave': (
    data: { roomId: string },
    ack?: (res: { ok: boolean; roomId: string }) => void,
  ) => void;
  'message:send': (
    data: SendMessagePayload,
    ack?: (msg: ChatMessageWithSender) => void,
  ) => void;
  'message:edit': (
    data: EditMessagePayload,
    ack?: (msg: ChatMessageWithSender) => void,
  ) => void;
  'message:delete': (
    data: { messageId: string },
    ack?: (res: { ok: boolean; messageId: string; roomId: string }) => void,
  ) => void;
  'message:read': (
    data: MarkAsReadPayload,
    ack?: (res: { ok: boolean; unreadCount: number }) => void,
  ) => void;
  'reaction:add': (
    data: ReactionPayload,
    ack?: (r: MessageReaction & { roomId: string }) => void,
  ) => void;
  'reaction:remove': (
    data: ReactionPayload,
    ack?: (res: {
      ok: boolean;
      messageId: string;
      userId: string;
      emoji: string;
      roomId: string;
    }) => void,
  ) => void;
}

// =====================================================
// 채팅 첫 메시지 양식 시스템 (Phase A)
// =====================================================

/** Backend Prisma enum과 일치 */
export type MessageContext =
  | 'RECRUIT_INDIVIDUAL'
  | 'RECRUIT_TEAM'
  | 'SCOUT_FROM_TEAM'
  | 'PORTFOLIO_COFFEE_CHAT'
  | 'PORTFOLIO_FRIENDSHIP'
  | 'PORTFOLIO_INQUIRY'
  | 'PORTFOLIO_COLLAB'
  | 'PORTFOLIO_PRAISE'
  | 'COMMUNITY_PRIVATE_NOTE'
  | 'RANDOM_MATCH';

export type ApplicationContactType = 'LEADER' | 'MEMBER' | 'TEAM_CHAT';

/** GET /api/templates 응답 */
export interface MessageTemplate {
  context: MessageContext;
  content: string;
  /** false면 default 합성, true면 사용자가 PUT으로 영구화한 양식 */
  isPersisted: boolean;
}

/** GET /api/teams/:id/contact 응답 */
export interface TeamApplicationContact {
  type: 'DIRECT' | 'GROUP';
  recipientUserIds: string[];
  teamName: string;
  recruitingRoles: string[];
  /** TEAM_CHAT일 때만 */
  suggestedRoomName?: string;
}
