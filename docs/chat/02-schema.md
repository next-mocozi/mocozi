
# DM 모듈 — Prisma Schema 명세

> **대상 파일**: `backend/prisma/schema.prisma`
> **변경 범위**: 그룹 ④ 채팅 영역 + User 모델 역참조 정정
> **마이그레이션 명령**: `docker compose exec backend pnpm prisma migrate dev --name chat_schema_overhaul`

---

## 1. 적용 위치

기존 schema의 **채팅 4개 모델 영역(약 line 194-230)을 통째로 교체**합니다. 그 외 영역(User, Team, RecruitPost 등)은 손대지 않습니다.

User 모델의 채팅 역참조 부분만 별도 정정 (아래 §3 참고).

---

## 2. 채팅 영역 — 전체 교체

```prisma
// =====================================================
// 그룹 ④ 채팅 (DM / 그룹 / 채널)
// =====================================================

enum ChatRoomType {
  DIRECT    // 1:1 DM
  GROUP     // N명 그룹 DM (Phase A에서 사용)
  CHANNEL   // 채널형 그룹 (Phase B 확장 시 사용)
}

enum ChatRoomMemberRole {
  MEMBER    // 일반 참여자
  ADMIN     // 관리자 (Phase B에서 활성화)
}

// -----------------------------------------------------
// 채팅방
// -----------------------------------------------------
model ChatRoom {
  id            String        @id @default(uuid())
  type          ChatRoomType  @default(DIRECT)

  // GROUP/CHANNEL 전용 (DIRECT면 null)
  name          String?
  description   String?
  creatorId     String?

  // 마지막 메시지 미리보기 (사이드바 표시용)
  lastMessage   String?
  lastMessageAt DateTime?     // 메시지 수신 시각 — updatedAt과 분리

  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt    // 방 메타데이터(이름·설명) 변경 시각

  creator       User?            @relation("CreatedChatRooms", fields: [creatorId], references: [id])
  members       ChatRoomMember[]
  messages      ChatMessage[]

  @@index([type])
  @@index([lastMessageAt])    // 사이드바 최신순 정렬용
  @@map("chat_rooms")
}

// -----------------------------------------------------
// 채팅방-사용자 연결 (멤버십)
// 모델명: ChatRoomUser → ChatRoomMember (의미 명확화)
// -----------------------------------------------------
model ChatRoomMember {
  id                String              @id @default(uuid())
  roomId            String
  userId            String

  role              ChatRoomMemberRole  @default(MEMBER)

  // 읽음 처리: 모델 C — 마지막으로 읽은 메시지 ID
  // 안 읽은 개수 = 이 ID 이후의 메시지 COUNT
  lastReadMessageId String?

  joinedAt          DateTime            @default(now())
  leftAt            DateTime?           // null: 활성 멤버, 값: 나간 멤버

  // onDelete: Cascade — 채팅방 삭제 시 멤버십 정리 (안전장치)
  // 다른 모델 컨벤션과 다른 예외. "방 폭파" 시 데이터 무결성 위해 채팅 영역만 적용
  room              ChatRoom            @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user              User                @relation(fields: [userId], references: [id])
  lastReadMessage   ChatMessage?        @relation("LastReadByMembers", fields: [lastReadMessageId], references: [id])

  @@unique([roomId, userId])
  @@index([userId])
  @@index([roomId, leftAt])
  @@map("chat_room_members")
}

// -----------------------------------------------------
// 메시지
// -----------------------------------------------------
model ChatMessage {
  id        String      @id @default(uuid())
  roomId    String
  senderId  String
  // content: 무제한 길이 (코드 블록 등). 첨부 마커도 본문에 inline.
  //   - 인앱 link: [[link:profile|portfolio|team|external:target|label]]
  //   - 파일:      [[file:storagePath|filename|size|mime]]   (§16, Phase A 첨부)
  //   - 이미지:    [[image:storagePath|alt|size|mime]]
  // 파싱·렌더링은 frontend `lib/messageTemplate.ts`가 담당. 모델 변경 없음.
  content   String      @db.Text

  parentId  String?                  // 답글 (자기참조)
  editedAt  DateTime?                // null: 미수정. 값: "(편집됨)" 표시
  deletedAt DateTime?                // 소프트 삭제. UI는 "삭제된 메시지" placeholder

  createdAt DateTime    @default(now())

  // onDelete: Cascade — 채팅방 삭제 시 메시지 정리 (안전장치)
  // 일반 운영에서는 deletedAt 소프트 삭제만 사용
  room          ChatRoom          @relation(fields: [roomId], references: [id], onDelete: Cascade)
  sender        User              @relation(fields: [senderId], references: [id])
  parent        ChatMessage?      @relation("MessageReplies", fields: [parentId], references: [id])
  replies       ChatMessage[]     @relation("MessageReplies")
  reactions     MessageReaction[]
  readByMembers ChatRoomMember[]  @relation("LastReadByMembers")

  @@index([roomId, createdAt])     // cursor-based 페이징 핵심 인덱스 (반드시 필요)
  @@index([senderId])
  @@index([parentId])
  @@map("chat_messages")
}

// -----------------------------------------------------
// 메시지 반응 (이모지)
// -----------------------------------------------------
model MessageReaction {
  id        String      @id @default(uuid())
  messageId String
  userId    String
  emoji     String                       // "👍", "❤️" 등
  createdAt DateTime    @default(now())

  message   ChatMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id])

  @@unique([messageId, userId, emoji])   // 같은 사람·같은 메시지·같은 이모지 중복 방지
  @@index([messageId])
  @@map("message_reactions")
}
```

---

## 3. User 모델 — 채팅 역참조 정정

**현재 상태** (`backend/prisma/schema.prisma:36-37` 부근):
```prisma
sentMessages  ChatMessage[]      // 이미 있음 — 유지
chatRooms     ChatRoomUser[]     // 이미 있음 — 모델명 변경에 따라 갱신 필요
```

**변경 후** (정확히 2줄 추가 + 1줄 rename):
```prisma
// 채팅 역참조
sentMessages     ChatMessage[]                                       // 유지
chatMemberships  ChatRoomMember[]                                    // 기존 chatRooms 이름 변경
createdChatRooms ChatRoom[]        @relation("CreatedChatRooms")     // 신규
reactions        MessageReaction[]                                   // 신규
```

**주의**: `ChatRoomUser` → `ChatRoomMember` 모델명 변경에 따라 `chatRooms` 필드는 자동으로 깨짐. 반드시 `chatMemberships`로 이름 변경해야 마이그레이션 통과.

---

## 4. 인덱스 설계 근거

| 인덱스 | 목적 | 없으면? |
|---|---|---|
| `chat_rooms.type` | "내가 속한 GROUP만 가져와" 같은 필터 | 풀 스캔 |
| `chat_rooms.lastMessageAt` | 사이드바 최신순 정렬 | 정렬 시마다 정렬 필요 |
| `chat_room_members.userId` | "내가 속한 모든 방" | 풀 스캔 |
| `chat_room_members.[roomId, leftAt]` | "활성 멤버만 필터" (left가 아닌) | 부분 인덱스 효과 없음 |
| **`chat_messages.[roomId, createdAt]`** | **cursor-based 페이징** | **메시지 10만건 넘으면 즉시 느려짐** |
| `chat_messages.senderId` | "이 사용자가 보낸 모든 메시지" | 메시지 검색 시 풀 스캔 |
| `chat_messages.parentId` | "이 메시지의 답글들" | 답글 조회 시 풀 스캔 |
| `message_reactions.messageId` | "이 메시지의 반응들" | 풀 스캔 |

**가장 중요한 인덱스**: `@@index([roomId, createdAt])`. 채팅 페이징의 핵심.

### 복합 인덱스 컬럼 순서 원칙

**규칙**: WHERE의 equality 컬럼 먼저, range 비교 컬럼 나중.

✅ `[equality, range]` — `@@index([roomId, createdAt])`
- `room_id = 'X'` (equality)
- `created_at < cursor.createdAt` (range)

❌ `[range, equality]` — `@@index([createdAt, roomId])`
- 같은 쿼리에 거의 도움 안 됨 (range 컬럼이 앞이면 인덱스 leaf가 createdAt 전역 분포로 흩어짐)

`chat_messages.[roomId, createdAt]`이 cursor 페이징의 tie-breaker (`id desc`)까지 인덱스로 처리하지는 않지만, 같은 ms timestamp 메시지는 매우 적어 추가 sort 비용이 무시 가능. 필요 시 `@@index([roomId, createdAt, id])`로 확장 가능 (현재는 미적용 — 인덱스 부담 대비 효과 작음).

### 인덱스 비용

인덱스는 무료가 아님. 추가 시 비용:
- 저장 공간 (테이블 크기의 30~50%)
- INSERT/UPDATE 시마다 인덱스 갱신 (쓰기 지연)
- 메모리 부담 (자주 쓰는 인덱스는 buffer cache에 상주)

→ **진짜 자주 쓰는 쿼리에만 인덱스 추가**. 새 인덱스 추가 시 위 원칙 적용.

성능 검증 방법 (EXPLAIN ANALYZE)은 [`07-perf-debugging.md`](./07-perf-debugging.md) 참고.

---

## 5. 마이그레이션 후 검증 체크리스트

마이그레이션 적용 후 다음을 확인:

- [ ] `chat_rooms`, `chat_room_members`, `chat_messages`, `message_reactions` 4개 테이블 생성됨
- [ ] 기존 `chat_room_users` 테이블 제거됨 (또는 데이터 손실 경고 확인)
- [ ] User 모델의 역참조 4개 (`sentMessages`, `chatMemberships`, `createdChatRooms`, `reactions`) 모두 정상 동작
- [ ] `pnpm prisma generate` 성공 — Prisma Client에 신규 타입 반영
- [ ] `shared/types/chat.ts`도 함께 갱신됨 ([`03-shared-types.md`](./03-shared-types.md) 참고)

---

## 6. 데이터 마이그레이션 — 기존 데이터 보존 여부

**현재 결정**: Phase A 시작 단계로 운영 데이터 없음. **마이그레이션 시 기존 채팅 데이터 손실 허용**.

운영 시작 후 schema 변경이 필요할 경우 별도 데이터 마이그레이션 스크립트 작성 (`prisma/migrations/<name>/migration.sql`에 수동 SQL 추가).