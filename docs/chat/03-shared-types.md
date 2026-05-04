# DM 모듈 — Shared Types 명세

> **대상 파일**: `shared/types/chat.ts`
> **현재 상태**: 모델 B 기준으로 작성됨 (`readBy: string[]` 포함)
> **변경 범위**: 전면 교체

---

## 1. 동시 갱신 원칙

이 파일은 [`02-schema.md`](./02-schema.md)와 **반드시 같은 PR에 묶여야 함**. 한쪽만 머지되면:
- schema만 바뀌고 타입 그대로 → frontend가 옛 타입으로 새 schema 호출 → 런타임 에러
- 타입만 바뀌고 schema 그대로 → backend가 새 타입으로 옛 schema 쿼리 → Prisma 에러

---

## 2. 전체 코드 — 그대로 교체

```typescript
// shared/types/chat.ts

// =====================================================
// Enum 타입 (Prisma enum과 동기화)
// =====================================================

export type ChatRoomType = 'DIRECT' | 'GROUP' | 'CHANNEL';
export type ChatRoomMemberRole = 'MEMBER' | 'ADMIN';

// =====================================================
// 기본 모델 타입 (Prisma 모델과 1:1 대응)
// =====================================================

export interface ChatRoom {
  id: string;
  type: ChatRoomType;
  name: string | null;
  description: string | null;
  creatorId: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: ChatRoomMemberRole;
  lastReadMessageId: string | null;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  parentId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

// =====================================================
// 화면 표시용 확장 타입 (관계 포함)
// =====================================================

export interface ChatRoomWithMembers extends ChatRoom {
  members: ChatRoomMember[];
  unreadCount: number;          // 인앱 알림: 안 읽은 메시지 수
}

export interface ChatMessageWithSender extends ChatMessage {
  sender: {
    id: string;
    name: string;
    profileImage: string | null;
  };
  reactions: MessageReaction[];
  parent?: ChatMessage | null;   // 답글일 때 부모 미리보기 (없으면 null)
}

// =====================================================
// API 요청/응답 타입
// =====================================================

export interface CreateRoomRequest {
  type: 'DIRECT' | 'GROUP';     // CHANNEL은 Phase B
  name?: string;                  // GROUP일 때만 필요
  description?: string;
  memberIds: string[];            // 초대할 사용자들 (creator 제외)
}

export interface SendMessageRequest {
  roomId: string;
  content: string;
  parentId?: string;              // 답글일 때만
}

export interface EditMessageRequest {
  messageId: string;
  content: string;
}

export interface MarkAsReadRequest {
  roomId: string;
  messageId: string;              // 마지막으로 읽은 메시지 ID
}

export interface AddReactionRequest {
  messageId: string;
  emoji: string;
}

export interface MessagesPageResponse {
  messages: ChatMessageWithSender[];
  nextCursor: string | null;      // 다음 페이지의 createdAt (ISO string), null이면 더 없음
}

// =====================================================
// 인앱 알림 페이로드 타입
// =====================================================

export interface NewMessageNotification {
  roomId: string;
  roomName: string | null;        // DIRECT면 null (UI에서 상대방 이름으로 표시)
  senderName: string;
  preview: string;                // 메시지 내용 (긴 경우 잘림)
  unreadCount: number;            // 갱신된 카운트
}

export interface UnreadCountChangedNotification {
  roomId: string;
  unreadCount: number;
}

// =====================================================
// Socket 이벤트 페이로드 타입
// =====================================================

export interface SocketEvents {
  // 클라이언트 → 서버
  'conversation:join': { roomId: string };
  'conversation:leave': { roomId: string };
  'message:send': SendMessageRequest;
  'message:edit': EditMessageRequest;
  'message:delete': { messageId: string };
  'message:read': MarkAsReadRequest;
  'reaction:add': AddReactionRequest;
  'reaction:remove': { messageId: string; emoji: string };
  'typing:start': { roomId: string };
  'typing:stop': { roomId: string };

  // 서버 → 클라이언트 (방 단위 — 그 방을 보고 있는 사람들에게)
  'message:new': ChatMessageWithSender;
  'message:edited': ChatMessageWithSender;
  'message:deleted': { messageId: string; roomId: string };
  'reaction:added': MessageReaction;
  'reaction:removed': { messageId: string; userId: string; emoji: string };
  'member:joined': { roomId: string; member: ChatRoomMember };
  'member:left': { roomId: string; userId: string };
  'typing:update': { roomId: string; userId: string; isTyping: boolean };

  // 서버 → 클라이언트 (사용자 글로벌 — 인앱 알림)
  'notification:newMessage': NewMessageNotification;
  'notification:unreadCountChanged': UnreadCountChangedNotification;
}
```

---

## 3. 변경 사항 정리 (현재 → 변경 후)

| 항목 | 현재 (`shared/types/chat.ts:2-20`) | 변경 후 |
|---|---|---|
| `ChatRoom.participants` | `string[]` | **제거** (멤버는 `ChatRoomMember` 별도 타입) |
| `ChatRoom.type` | 없음 | `ChatRoomType` 추가 |
| `ChatRoom.name`, `description` | 없음 | 추가 (DIRECT는 null) |
| `ChatRoom.creatorId` | 없음 | 추가 (Phase B 대비) |
| `ChatRoom.lastMessageAt` | 없음 | 추가 (사이드바 최신순) |
| `ChatRoom.createdAt` | 없음 | 추가 |
| `ChatMessage.readBy` | `string[]` | **제거** (모델 C로 전환) |
| `ChatMessage.parentId` | 없음 | 추가 (답글) |
| `ChatMessage.editedAt`, `deletedAt` | 없음 | 추가 |
| `ChatRoomMember` 타입 | 없음 | **신규 추가** |
| `MessageReaction` 타입 | 없음 | **신규 추가** |
| `ChatRoomWithMembers.unreadCount` | 없음 | **신규 추가 (인앱 알림)** |
| 확장 타입 (`*WithSender` 등) | 없음 | **신규 추가** |
| API 요청/응답 타입 | 없음 | **신규 추가** |
| 인앱 알림 타입 (`NewMessageNotification` 등) | 없음 | **신규 추가** |
| Socket 이벤트 타입 | 없음 | **신규 추가** |

---

## 4. 영향 받는 파일들

이 타입 변경은 다음 파일들에 연쇄 영향을 줍니다. 같은 PR에서 모두 갱신:

### Backend
- `backend/src/chat/chat.service.ts` — `readBy` 관련 로직 제거, 신규 메서드 시그니처
- `backend/src/chat/chat.gateway.ts` — Socket 이벤트 페이로드 타입 적용, 사용자 글로벌 broadcast 추가
- `backend/src/chat/dto/*.dto.ts` — 위 API 요청 타입과 정합

### Frontend (별도 PR)
- `frontend/src/hooks/useSocket.ts` — Socket 이벤트 시그니처 변경, 글로벌 알림 리스너
- `frontend/src/app/chat/page.tsx` — `ChatRoom` 사용 부분, `unreadCount` 뱃지
- `frontend/src/app/chat/[roomId]/page.tsx` — `ChatMessage` 사용 부분
- `frontend/src/app/layout.tsx` — 글로벌 토스트 영역

---

## 5. shared/index.ts 갱신 확인

`shared/index.ts`에서 다음과 같이 re-export 되어 있는지 확인:

```typescript
// shared/index.ts
export * from './types/chat';
// ... 기타 export
```

이미 `export *`로 되어 있으면 신규 타입들이 자동 노출됨. 이름 명시 export면 위 신규 타입(`ChatRoomMember`, `MessageReaction`, `ChatRoomMemberRole`, `NewMessageNotification` 등)을 추가해야 함.

---

## 6. Date 타입 vs string 처리

`Date` 타입 필드들은 **JSON 직렬화 시 string**이 됨. 클라이언트에서 다룰 때:

```typescript
// 서버 응답 받은 직후 (string 상태)
const message: ChatMessage = await api.get('/messages/...');
console.log(typeof message.createdAt);  // "string"

// Date 객체로 변환 필요한 경우
const createdAt = new Date(message.createdAt as unknown as string);
```

**권장**: API 인터셉터에서 자동 변환하거나, 화면 표시 시점에만 `new Date()`로 변환. 타입 자체는 `Date`로 두는 게 코드 가독성 좋음.