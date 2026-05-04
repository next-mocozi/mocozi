# DM 모듈 — API 명세

> **대상**: 백엔드 ↔ 프론트엔드 통신 인터페이스
> **베이스 URL**: `http://localhost:8080/api` (REST), `http://localhost:8080` (Socket.IO)
> **인증**: 모든 엔드포인트·이벤트는 JWT 필요 (예외 없음)

---

## 1. REST 엔드포인트

### 1-1. 채팅방 (ChatRoom)

#### `POST /api/chat/rooms` — 채팅방 생성

```typescript
// Request
{
  "type": "DIRECT" | "GROUP",   // CHANNEL은 Phase B
  "name"?: string,               // GROUP일 때만 필수
  "description"?: string,
  "memberIds": string[]          // 초대할 사용자 ID들 (creator 제외)
}

// Response 201
{
  "id": "uuid",
  "type": "GROUP",
  "name": "디자인 팀",
  "description": null,
  "creatorId": "uuid",
  "lastMessage": null,
  "lastMessageAt": null,
  "createdAt": "2026-05-03T...",
  "updatedAt": "2026-05-03T...",
  "members": [
    { "userId": "uuid", "role": "MEMBER", ... }
  ]
}
```

**비즈니스 규칙**:
- DIRECT: `memberIds` 길이 정확히 1 (상대방 한 명). 이미 존재하면 기존 방 반환
- GROUP: `memberIds` 길이 2 이상, `name` 필수
- creator는 자동으로 멤버에 추가, `role: 'MEMBER'` (Phase A에서는 ADMIN 미사용)

#### `GET /api/chat/rooms` — 내가 속한 채팅방 목록

```typescript
// Query params (모두 optional)
?type=DIRECT|GROUP|CHANNEL    // 필터
?limit=20                     // 기본 20
?cursor=<lastMessageAt-ISO>   // 무한 스크롤

// Response 200
{
  "rooms": [
    {
      "id": "uuid",
      "type": "GROUP",
      "name": "디자인 팀",
      "lastMessage": "내일 회의 시간 변경됐어요",
      "lastMessageAt": "2026-05-03T14:30:00Z",
      "unreadCount": 3,                  // ← 인앱 알림 핵심 필드
      "members": [...]
    }
  ],
  "nextCursor": "2026-05-02T..." | null
}
```

**정렬**: `lastMessageAt DESC`. null인 방(메시지 없는 방)은 `createdAt DESC`로 폴백.

**`unreadCount` 계산 로직** (백엔드, Prisma):

```typescript
async getUnreadCount(roomId: string, userId: string): Promise<number> {
  // 1) 멤버십과 lastReadMessage.createdAt을 한 번에 (include로 LEFT JOIN)
  const member = await this.prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    include: { lastReadMessage: { select: { createdAt: true } } },
  });
  if (!member) return 0;

  // 2) 카운트
  return this.prisma.chatMessage.count({
    where: {
      roomId,
      deletedAt: null,                     // 소프트 삭제 메시지 제외
      senderId: { not: userId },           // 내가 보낸 메시지는 unread 아님
      ...(member.lastReadMessage && {
        createdAt: { gt: member.lastReadMessage.createdAt },
      }),
    },
  });
}
```

핵심 포인트:
- `senderId: { not: userId }` 필수 — 내가 방금 보낸 메시지가 즉시 "안 읽음 1"로 잡히면 사용자 혼란
- `deletedAt: null` 필수 — 소프트 삭제된 메시지는 카운트 제외
- `lastReadMessage`가 null이면(한 번도 안 읽음) 모든 미삭제·타인 메시지 카운트
- 멤버십 + lastReadMessage를 `include`로 한 쿼리에 결합하여 라운드트립 절감

채팅방 목록(getUserRooms)에서는 위 메서드를 `Promise.all`로 방마다 병렬 호출. N+1 회피.

**프론트 활용**: 사이드바 빨간 점, 채팅방 옆 숫자 뱃지.

#### `GET /api/chat/rooms/:roomId` — 채팅방 상세

```typescript
// Response 200
{
  "id": "uuid",
  "type": "GROUP",
  ...,
  "members": [...]   // 모든 활성 멤버 (leftAt: null)
}

// 403: 멤버가 아니면 접근 불가
```

#### `PATCH /api/chat/rooms/:roomId` — 채팅방 수정

```typescript
// Request (모두 optional)
{
  "name"?: string,
  "description"?: string
}

// Response 200: 수정된 ChatRoom
// 403: GROUP/CHANNEL의 creator/ADMIN만 가능 (Phase A는 모든 멤버 허용)
```

#### `DELETE /api/chat/rooms/:roomId` — 채팅방 나가기 / 삭제

```typescript
// 동작:
// - 일반 멤버: 자신의 ChatRoomMember.leftAt 설정 (나가기)
// - DIRECT의 양쪽이 모두 나가면 → 방 자동 삭제 (cascade)
// - GROUP creator: 방 자체 삭제 (모든 멤버·메시지 cascade)

// Response 204
```

### 1-2. 메시지 (ChatMessage)

#### `GET /api/chat/rooms/:roomId/messages` — 메시지 페이징

```typescript
// Query params
?limit=50                    // 기본 50, 최대 100
?cursor=<createdAt-ISO>      // 이 시각 이전 메시지 가져오기 (무한 스크롤)

// Response 200
{
  "messages": [
    {
      "id": "uuid",
      "roomId": "uuid",
      "senderId": "uuid",
      "content": "안녕하세요",
      "parentId": null,
      "editedAt": null,
      "deletedAt": null,
      "createdAt": "2026-05-03T...",
      "sender": {
        "id": "uuid",
        "name": "김동균",
        "profileImage": null
      },
      "reactions": [
        { "emoji": "👍", "userId": "uuid" }
      ],
      "parent": null              // 답글이면 부모 메시지 일부
    }
  ],
  "nextCursor": "2026-05-02T..." | null   // null이면 더 이상 메시지 없음
}
```

**중요**:
- 정렬: `createdAt DESC` (최신이 먼저)
- 클라이언트가 표시할 때는 reverse해서 시간순으로
- `deletedAt: not null` 메시지도 응답에 포함됨 — 클라이언트가 "삭제된 메시지" placeholder 렌더

#### `PATCH /api/chat/messages/:messageId` — 메시지 수정

```typescript
// Request
{ "content": "수정된 내용" }

// Response 200: 수정된 메시지 (editedAt 갱신됨)
// 403: senderId !== current user
// 404: deletedAt !== null
```

**비즈니스 규칙**: 시간 제한 없음. 본인 메시지만 가능.

#### `DELETE /api/chat/messages/:messageId` — 메시지 삭제 (소프트)

```typescript
// Response 204
// 동작: deletedAt 설정만. 실제 row는 보존 (답글 보존 위해)
// 403: senderId !== current user
```

### 1-3. 읽음 처리

#### `POST /api/chat/rooms/:roomId/read` — 읽음 표시

```typescript
// Request
{ "messageId": "uuid" }   // 마지막으로 읽은 메시지 ID

// Response 204
// 동작: ChatRoomMember.lastReadMessageId 갱신
// 부수 효과: 사이드바 unreadCount가 0으로 갱신됨 (다음 GET 시 반영)
```

**참고**: 보통 이 작업은 Socket 이벤트 (`message:read`)로 더 자주 호출됨. REST는 폴백/배치 용도.

### 1-4. 반응 (Reaction)

#### `POST /api/chat/messages/:messageId/reactions`

```typescript
// Request
{ "emoji": "👍" }

// Response 201: MessageReaction
// 409: 이미 같은 이모지 반응 존재
```

#### `DELETE /api/chat/messages/:messageId/reactions/:emoji`

```typescript
// 본인 반응만 삭제 가능
// Response 204
```

---

## 2. Socket 이벤트

연결 URL: `http://localhost:8080`
인증: handshake 시 `auth: { token: '<JWT>' }`

### 2-1. 연결 흐름

```typescript
// 클라이언트
const socket = io('http://localhost:8080', {
  auth: { token: localStorage.getItem('accessToken') },
});

socket.on('connect', () => {
  // 서버가 WsJwtGuard로 토큰 검증 완료
  // 서버는 자동으로 user:<userId> 글로벌 room에 가입시킴 (인앱 알림용)

  // 채팅방 진입 시
  socket.emit('conversation:join', { roomId: 'uuid' });
});

socket.on('connect_error', (err) => {
  // 토큰 만료/오류
  if (err.message === 'Unauthorized') {
    // refresh 시도 후 재연결
  }
});
```

### 2-2. Room 가입 구조 (인앱 알림 포함)

각 사용자의 socket은 **두 종류의 room**에 가입:

| Room 종류 | 형식 | 가입 시점 | 용도 |
|---|---|---|---|
| **사용자 글로벌 room** | `user:<userId>` | 연결 직후 자동 | 인앱 알림 (다른 방 메시지 알림 등) |
| **채팅방 room** | `room:<roomId>` | 채팅방 화면 진입 시 (`conversation:join`) | 그 방의 실시간 메시지 수신 |

**Broadcast 패턴**:
- 새 메시지 도착 → 서버는 **두 가지 broadcast 동시 수행**
  - `io.to('room:<roomId>').emit('message:new', ...)` — 그 방을 보고 있는 사람들에게
  - `io.to('user:<멤버UserId>').emit('notification:newMessage', ...)` — 방 멤버 각각의 글로벌 room에 (사이드바 갱신·토스트용)
- 클라이언트는 두 이벤트를 분리해서 처리:
  - `message:new` → 현재 채팅방 화면에 메시지 추가
  - `notification:newMessage` → 사이드바 unreadCount 갱신 + 다른 방이면 토스트 띄움

### 2-3. 클라이언트 → 서버 이벤트

| 이벤트 | 페이로드 | 동작 |
|---|---|---|
| `conversation:join` | `{ roomId }` | 해당 방 room 참여 + **lastReadMessageId 자동 갱신** + `notification:unreadCountChanged` broadcast (Phase A 정책 — `01-decisions.md` §12) |
| `conversation:leave` | `{ roomId }` | room 떠나기 (논리적 leftAt 갱신은 별도 REST) |
| `message:send` | `{ roomId, content, parentId? }` | 메시지 저장 + 두 종류 broadcast |
| `message:edit` | `{ messageId, content }` | 메시지 수정 + `message:edited` 브로드캐스트 |
| `message:delete` | `{ messageId }` | 소프트 삭제 + `message:deleted` 브로드캐스트 |
| `message:read` | `{ roomId, messageId }` | `lastReadMessageId` 갱신. unreadCount 변화는 다음 GET에서 반영 |
| `reaction:add` | `{ messageId, emoji }` | 반응 추가 + `reaction:added` 브로드캐스트 |
| `reaction:remove` | `{ messageId, emoji }` | 반응 제거 + `reaction:removed` 브로드캐스트 |
| `typing:start` | `{ roomId }` | `typing:update` 브로드캐스트 (DB 저장 안 함) |
| `typing:stop` | `{ roomId }` | `typing:update` 브로드캐스트 |

**중요**: 모든 이벤트에서 `senderId`/`userId`는 클라이언트가 보내지 않음. 서버가 `client.data.user.id`에서 추출.

### 2-4. 서버 → 클라이언트 이벤트

#### 방 단위 broadcast (`room:<roomId>`)

방의 모든 활성 멤버 (그 방 화면을 보고 있는 사용자)에게:

| 이벤트 | 페이로드 | 트리거 |
|---|---|---|
| `message:new` | `ChatMessageWithSender` | 새 메시지 도착 |
| `message:edited` | `ChatMessageWithSender` | 메시지 수정됨 |
| `message:deleted` | `{ messageId, roomId }` | 메시지 소프트 삭제됨 |
| `reaction:added` | `MessageReaction` | 반응 추가됨 |
| `reaction:removed` | `{ messageId, userId, emoji }` | 반응 제거됨 |
| `member:joined` | `{ roomId, member }` | 새 멤버 참여 |
| `member:left` | `{ roomId, userId }` | 멤버 나감 |
| `typing:update` | `{ roomId, userId, isTyping }` | 타이핑 상태 변경 |

#### 사용자 글로벌 broadcast (`user:<userId>`) — 인앱 알림

각 멤버의 글로벌 room에 개별 broadcast:

| 이벤트 | 페이로드 | 트리거 |
|---|---|---|
| `notification:newMessage` | `{ roomId, roomName, senderName, preview, unreadCount }` | 그 사용자가 멤버인 방에 새 메시지 도착 |
| `notification:unreadCountChanged` | `{ roomId, unreadCount }` | 다른 디바이스에서 읽어서 카운트 변화 |

**프론트 처리**:
- `notification:newMessage` 수신 시:
  - 사이드바의 해당 방 `unreadCount` +1
  - **현재 보고 있는 방이 아니면** 화면 우측 상단에 토스트 (3초 자동 사라짐, 클릭 시 그 방으로 이동)
  - **현재 보고 있는 방이면** 토스트 안 띄움 (어차피 메시지가 화면에 보임)

### 2-5. 에러 응답

서버는 에러 시 다음 형식으로 응답:

```typescript
// 클라이언트
socket.on('exception', (err) => {
  console.error(err.message);  // "Unauthorized", "Forbidden", "NotFound"
});
```

| 에러 | 발생 조건 |
|---|---|
| `Unauthorized` | 토큰 없음/만료/위조 |
| `Forbidden` | 멤버가 아닌 방에 접근, 본인 메시지 아닌 걸 수정/삭제 |
| `NotFound` | 존재하지 않는 roomId/messageId |
| `BadRequest` | 페이로드 형식 오류 |

---

## 3. 페이징 전략 — Cursor-based with Tie-breaking

### 왜 offset이 아닌 cursor?

**Offset 페이징**의 문제:
```sql
-- 페이지 100 (offset 5000)
SELECT * FROM chat_messages WHERE roomId = 'X' ORDER BY createdAt DESC OFFSET 5000 LIMIT 50;
```
- offset이 클수록 느려짐 (DB가 5000개를 세서 버려야 함)
- 페이징 중 새 메시지 추가되면 결과가 어긋남 (메시지 중복/누락)

**Cursor 페이징**: `@@index([roomId, createdAt])` 활용 → 즉시. 새 메시지 추가돼도 결과 어긋나지 않음.

### Tie-breaking이 필요한 이유

단순 `createdAt`만 cursor로 쓰면 같은 millisecond에 도착한 두 메시지가 페이지 경계에 걸릴 때 한 메시지가 영구 누락된다. 원인:
- PostgreSQL `timestamp`는 microsecond 정밀도지만 JavaScript `Date`는 millisecond
- 직렬화/역직렬화 과정에서 microsecond가 잘림
- `WHERE createdAt < cursor` 조건이 같은 ms 메시지를 일관되게 처리 못 함

**해결**: cursor를 `(createdAt, id)` 복합 키로. 정렬도 `[createdAt desc, id desc]`로 두 단계.

### Cursor는 opaque token (base64url)

클라이언트는 cursor 내부 구조 알 필요 없음. 서버만 인코딩/디코딩.

```
GET /api/chat/rooms/:roomId/messages?cursor=eyJjcmVhdGVkQXQiOiIyMDI2LTA1LTAzVDEwOjAwOjAwLjAwMFoiLCJpZCI6Ii4uLiJ9
```

장점:
- 서버가 cursor 구조를 변경해도 클라이언트 코드 무수정
- URL-safe (base64url은 `+`, `/`, `=` 미사용)

### 서버 구현 (Prisma)

```typescript
interface MessageCursor {
  createdAt: string;  // ISO 8601
  id: string;         // UUID
}

async getMessages(
  roomId: string,
  userId: string,
  opts: { cursor?: string; limit?: number },
): Promise<MessagesPageResponse> {
  await this.assertMembership(roomId, userId);

  const limit = Math.min(opts.limit ?? 50, 100);
  const decoded = opts.cursor ? this.decodeCursor<MessageCursor>(opts.cursor) : null;

  const messages = await this.prisma.chatMessage.findMany({
    where: {
      roomId,
      ...(decoded && {
        OR: [
          // 명백히 이전 시각의 메시지
          { createdAt: { lt: new Date(decoded.createdAt) } },
          // 같은 시각이면 id로 tie-break
          {
            AND: [
              { createdAt: new Date(decoded.createdAt) },
              { id: { lt: decoded.id } },
            ],
          },
        ],
      }),
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },     // ← tie-breaker
    ],
    take: limit,
    include: {
      sender: { select: { id: true, name: true, profileImage: true } },
      reactions: true,
      parent: { select: { id: true, content: true, senderId: true, deletedAt: true } },
    },
  });

  const last = messages[messages.length - 1];
  const nextCursor = messages.length === limit
    ? this.encodeCursor<MessageCursor>({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      })
    : null;

  return { messages, nextCursor };
}

private encodeCursor<T>(payload: T): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

private decodeCursor<T>(token: string): T {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf-8')) as T;
  } catch {
    throw new BadRequestException('잘못된 cursor 형식입니다.');
  }
}
```

### 클라이언트 사용 패턴

```typescript
// 첫 호출 (cursor 없음)
const { messages, nextCursor } = await api.get(`/chat/rooms/${roomId}/messages?limit=50`);

// 위로 스크롤 시 더 가져오기
if (nextCursor) {
  const { messages: older, nextCursor: nc2 } = await api.get(
    `/chat/rooms/${roomId}/messages?limit=50&cursor=${nextCursor}`
  );
}
```

### 같은 패턴이 적용된 곳

- `getMessages(roomId, userId, opts)` — cursor: `(createdAt, id)`
- `getUserRooms(userId, opts)` — cursor: `(lastMessageAt, id)`. null lastMessageAt 방은 cursor 영역 밖(nulls last)이라 페이지 끝에 도달

### 인덱스 의존

`@@index([roomId, createdAt])`이 핵심. 복합 인덱스의 컬럼 순서 원칙(equality 먼저, range 나중)을 따름:
- `room_id = 'X'` (equality)
- `created_at < cursor.createdAt` (range)

→ `[roomId, createdAt]` 순서가 정확. 역순(`[createdAt, roomId]`)은 거의 무용지물.

성능 검증은 [`07-perf-debugging.md`](./07-perf-debugging.md) 참고.

---

## 4. 권한 매트릭스

| 작업 | DIRECT | GROUP (Phase A) | CHANNEL (Phase B) |
|---|---|---|---|
| 방 생성 | 본인이 일방적 | 누구나 | ADMIN만 |
| 방 정보 수정 | 불가 | 모든 멤버 (Phase A) | ADMIN만 |
| 멤버 초대 | 불가 (양자 고정) | 모든 멤버 | ADMIN만 |
| 멤버 추방 | 불가 | 불가 (Phase A) | ADMIN만 |
| 메시지 전송 | 멤버만 | 멤버만 | 멤버만 |
| 메시지 수정 | 본인만 | 본인만 | 본인만 |
| 메시지 삭제 | 본인만 | 본인만 | 본인 + ADMIN |
| 방 삭제 | 양쪽 모두 나가면 자동 | creator만 | ADMIN만 |

---

## 5. Rate Limit (추후 적용)

Phase A에서는 미적용. Phase B 진입 전:
- `message:send` — 사용자당 초당 5건
- `reaction:add` — 사용자당 초당 10건
- 위반 시 `RateLimitExceeded` 에러

---

## 6. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-03 | 초안 작성 (Day 2) |
| 2026-05-03 | 인앱 알림 항목 추가 — `unreadCount` 필드, 사용자 글로벌 room, `notification:*` 이벤트 (§2-2, 2-4) |
| 2026-05-03 | §3 페이징 전략을 tie-breaking 버전으로 교체 — base64url opaque cursor + `(createdAt, id)` 복합 키. §1-1 unreadCount 계산을 의사 SQL → 실제 Prisma 코드로. §2-3 `conversation:join`에 자동 읽음 처리 명시 (Day 5 패턴 적용 반영) |