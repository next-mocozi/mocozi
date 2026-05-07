# DM 모듈 — 13일 일정 진행 체크리스트

> 매일 작업 시작 시 이 파일 확인. 작업 완료 시 체크박스 갱신.

---

## Day 1~2: 설계 고정 (완료)

### Day 1
- [x] 영상 핵심 2구간 시청 (Channel Container + Create Channel) — 감만 잡기
- [x] 모노레포 구조 파악 (pnpm workspace, shared 패키지)
- [x] 기존 채팅 코드 1차 검토 (`schema.prisma`, `chat.service.ts`, `chat.gateway.ts`, `useSocket.ts`)
- [x] 설계 결정 5가지 확정 (그룹 형태·ID 전략·수정삭제·읽음 모델·토큰 정책)

### Day 2
- [x] Prisma schema 초안 (모델 C 채택, `ChatRoomMember` 신설, 답글·반응 추가)
- [x] 팀원 1차 검토 받기 (`@@map`, User 역참조, 보안 결함 발견)
- [x] schema v2 + shared types v2 작성 (`02-schema.md`, `03-shared-types.md`)
- [x] 인증 인터페이스 명세 v2 작성 (`04-auth-interface.md`)
- [x] API 명세 작성 (`05-api-spec.md`)
- [x] 인앱 알림 Phase A 포함 결정 (`01-decisions.md` §10)
- [x] 팀원 합의 사항 7가지 확정 (모델 B→C 동의, PR1+2 통합, WsJwtGuard 위치, payload 동결, expiresIn, fallback_secret 일정, refresh 일정)

---

## Day 3~6: MVP 백엔드 (완료)

### Day 3 — 기본 셋업

- [x] **schema DB 동기화** — Docker `prisma db push`로 schema → DB sync 완료
  ⚠️ **migration 파일은 미생성** — Day 7 시작 시 baseline 생성 필요
- [x] shared/types/chat.ts 갱신 (156 lines, 모든 신규 타입 포함, `readBy` 완전 제거)
- [x] `shared/index.ts` re-export 확인 (`export *`로 자동 노출)
- [x] WsJwtGuard 신설 (`backend/src/auth/guards/ws-jwt.guard.ts`)
- [x] chat.module.ts에 WsJwtGuard provide 추가 + JwtModule.register
- [x] 기본 REST 엔드포인트 구현
  - [x] `POST /api/chat/rooms` — 채팅방 생성 (DIRECT find-or-create / GROUP)
  - [x] `GET /api/chat/rooms` — 내 채팅방 목록 (unreadCount 포함)
  - [x] `GET /api/chat/rooms/:roomId` — 채팅방 상세 (멤버십 검증)
  - [x] `GET /api/chat/rooms/:roomId/messages` — 메시지 페이징

### Day 4 — Socket Gateway

- [x] **chat.gateway.ts 보안 패치**
  - [x] 클래스 레벨 `@UseGuards(WsJwtGuard)` 적용
  - [x] handleConnection에서 토큰 수동 verify (이중 안전망)
  - [x] `client.data.user` 주입
  - [x] 모든 핸들러에서 `senderId` 클라이언트 신뢰 제거 (`requireUserId(client)` 사용)
  - [x] 사용자별 글로벌 room (`user:<userId>`) 자동 가입
- [x] `conversation:join` 이벤트 — 멤버십 검증 + Socket room 가입
- [x] `conversation:leave` 이벤트 — Socket room 떠나기
- [x] `message:send` 이벤트 — saveMessage + dual broadcast (방 + 사용자별)
- [x] `message:read` 이벤트 — `lastReadMessageId` 갱신 + unreadCountChanged broadcast

### Day 5 — 페이징·에러·인앱 알림

- [x] **Cursor Pattern A** — base64url 인코딩 + (createdAt, id) tie-breaking
- [x] **Pattern B 최적화** — unread count 쿼리 single include로 통합 (3 → 2 query)
- [x] **Pattern C 자동 읽음** — conversation:join 시점에 마지막 메시지로 lastReadMessageId 갱신
- [x] **에러 핸들링** — `WsAllExceptionFilter` (Forbidden/NotFound/BadRequest/Unauthorized 매핑)
- [x] **DTO 4개**
  - [x] `edit-message.dto.ts` (Day 6에 실제 생성됨)
  - [x] `create-room.dto.ts`
  - [x] `mark-as-read.dto.ts`
  - [ ] ~~`add-reaction.dto.ts`~~ → Day 7 후반 (Day 8 작업 앞당김)
- [x] **인앱 알림 백엔드**
  - [x] 채팅방 목록 API의 `unreadCount` 계산 (`Promise.all` 병렬)
  - [x] 사용자별 글로벌 room (`user:<userId>`) 가입
  - [x] `message:send` 핸들러 dual broadcast: `to(room:roomId)` + `to(user:<멤버Id>)` 멤버별
- [x] **테스트** — Postman 수동 테스트 → `scripts/verify/` **자동화로 대체 (75/75 통과)**
  - 자산: Day 7~ 신규 기능에 verify 확장 필수 (회귀 안전망 유지)

### Day 6 — 메시지 수정/삭제

- [x] `message:edit` 이벤트 + `PATCH /api/chat/messages/:id` (본인/삭제여부 검증, editedAt 갱신)
- [x] `message:delete` 이벤트 + `DELETE /api/chat/messages/:id` (소프트 삭제, 멱등 처리)
- [ ] **deletedAt placeholder 렌더 확인** → 프론트엔드 작업으로 이연 (Day 11)

---

## Day 7~8: 답글 마무리 + 반응 + 프론트 통합 시작 (압축 일정)

> **압축 사유**: 답글 백엔드는 Day 4 `message:send`에서 `parentId` 옵션으로 이미 구현됨. messageInclude에 parent 미리보기도 이미 포함. 따라서 Day 7은 verify 스크립트 추가만 필요 → 절감된 시간으로 Day 8 반응 작업을 Day 7 후반에 앞당김.

### Day 7 (완료 — 압축 1일 안에 모두 처리)

- [x] **baseline migration 생성** — `20260504061319_chat_schema_overhaul`
  - shadow DB(임시 postgres:17-alpine 컨테이너) + `migrate diff` + `migrate resolve --applied`로 처리
  - 기존 4개 마이그레이션도 함께 resolve (db push만으로 적용된 흔적 정리)
  - `prisma migrate status` → "Database schema is up to date!"
- [x] **답글 verify 스크립트 추가** (`scripts/verify/test-ws-reply.js`, 20/20)
  - [x] `parentId` 포함 메시지 → 응답에 `parent` 미리보기 (id/content/senderId/deletedAt)
  - [x] 부모 소프트 삭제 후 자식 답글 row 보존 + parent 필드 deletedAt 노출
  - [x] 잘못된 parentId → BadRequest
- [x] **반응 백엔드 신설** (Day 8에서 앞당김)
  - [x] `add-reaction.dto.ts` (AddReactionDto + ReactionEventDto)
  - [x] service.addReaction / removeReaction
  - [x] REST POST/DELETE `/api/chat/messages/:messageId/reactions(/:emoji)`
  - [x] Socket `reaction:add` / `reaction:remove` + `reaction:added` / `reaction:removed` broadcast
  - [x] `@@unique` 위반 시 P2002 → ConflictException 변환
- [x] **반응 verify 스크립트** (`scripts/verify/test-ws-reaction.js`, 28/28)
  - [x] 추가/제거 broadcast 검증
  - [x] 중복 추가 → Conflict
  - [x] 비-멤버 차단 (Forbidden) / 삭제된 메시지에 반응 불가 (NotFound)
  - [x] REST 동등 동작 + 멱등 + GET 응답에 reactions 배열 포함

### Day 8 — useSocket 훅 시작 (1.5일 앞당겨짐)

- [ ] **useSocket 훅 갱신**
  - [ ] `auth: { token }` 핸드셰이크 적용
  - [ ] `sendMessage`에서 `senderId` 인자 제거 (서버가 토큰에서 추출)
  - [ ] Socket 이벤트 타입 (`SocketEvents`) 적용
  - [ ] 토큰 만료 시 refresh + 재연결 로직 (인증 모듈 작업 진행 중이면 mock으로)
- [ ] **글로벌 알림 리스너 (Day 9 일부 앞당김)**
  - [ ] `notification:newMessage` 핸들러 (사이드바·토스트 트리거)
  - [ ] `notification:unreadCountChanged` 핸들러 (멀티 디바이스 동기화)
- [ ] **재연결 시나리오 점검**
  - [ ] 의도적 끊김 → 재연결 시 메시지 누락 여부 (REST cursor catch-up)

---

## Day 9~11: 프론트엔드 통합

### Day 9 — useSocket 훅 마무리 + 글로벌 알림

- [ ] **`frontend/src/hooks/useSocket.ts` 마무리** (Day 8에서 시작분 이어서)
  - [ ] 토큰 만료 시 refresh + 재연결 로직
  - [ ] **글로벌 알림 리스너** — 사용자별 room의 `notification:newMessage` 수신 → 토스트/뱃지 트리거
  - [ ] 재연결 시 누락 메시지 동기화 (`?after=<lastReadMessageId>`)
- [ ] **재연결 시 동기화 시나리오 테스트** — 의도적 끊김 후 메시지 복구 확인

### Day 10 — 채팅방 목록 페이지 + 인앱 알림 UI

- [ ] **`frontend/src/app/chat/page.tsx`**
  - [ ] 하드코딩 더미 데이터 제거
  - [ ] `GET /api/chat/rooms` 연동
  - [ ] `lastMessageAt` 포맷팅 (today/yesterday/날짜)
  - [ ] **`unreadCount` 뱃지 표시** ← 인앱 알림
  - [ ] 무한 스크롤 (cursor 기반) — IntersectionObserver
- [ ] **사이드바 빨간 점 표시** — 어떤 방이든 `unreadCount > 0`이면 표시

### Day 11 — 채팅방 화면 + 토스트 알림

- [ ] **`frontend/src/app/chat/[roomId]/page.tsx`**
  - [ ] 메시지 목록 페이징 (위로 스크롤 시 옛날 메시지)
    - [ ] **스크롤 위치 보정** (옛날 메시지 추가 시 점프 방지)
    - [ ] **자동 스크롤 가드** (사용자가 맨 아래에 있을 때만)
  - [ ] 메시지 전송 (낙관적 UI: 클라이언트가 `crypto.randomUUID()` 미리 생성)
  - [ ] **답글 UI** (부모 메시지 인용 표시·답글 모드)
  - [ ] 편집/삭제 컨텍스트 메뉴
  - [ ] **`deletedAt` placeholder 렌더링** ("삭제된 메시지입니다") — Day 6에서 이연된 항목
  - [ ] 반응 이모지 피커
- [ ] **다른 방 메시지 토스트** ← 인앱 알림
  - [ ] `frontend/src/app/layout.tsx`에 글로벌 토스트 영역
  - [ ] 현재 보고 있는 방 외에서 메시지 오면 우측 상단 토스트 (3초 자동)
  - [ ] 토스트 클릭 시 해당 방으로 이동

---

## Day 12~13: 마무리

### Day 12 — 통합 테스트 + 버그 수정 (완료)

- [x] **E2E 시나리오 테스트** — verify 스크립트 다수 (REST/WS/Edge/Edit-Delete/Reply/Reaction) + 사용자 manual 검증으로 커버
- [x] **인앱 알림 시나리오 테스트** — test-ws.js [3]·[4]·[6] (dual broadcast / 자동 읽음 / 멀티 디바이스 sync) + 사용자 brower 검증
- [ ] **만료 토큰 시나리오 테스트** — 인증 담당자 refresh 작업 완료 후 가능 (외부 의존, Phase A에서 보류)
- [x] **연결 끊김 → 재연결 시 메시지 동기화 확인** — test-ws-reconnect.js (12/12). 자동화 + docs 반영
- [x] **메시지 1000건 페이징 성능 측정** — test-perf-pagination.js. 결과: 1000 메시지/21 페이지/평균 5.9ms/마지막 페이지 비율 0.33-0.5× (cursor 페이징 결정적 효과 입증). EXPLAIN ANALYZE에서 `Index Scan Backward using chat_messages_roomId_createdAt_idx` 확인
- [x] **scripts/verify 전체 회귀 실행** — 누적 **135/135** 통과
  - REST 11 / Socket 26 / Edge 13 / Edit-Delete 25 / Reply 20 / Reaction 28 / Reconnect 12

### Day 12 추가 발견 — 사용자 검증 라운드 패치 (이미 머지됨)

- [x] DIRECT 방 표시명 본인 제외 (`roomDisplayName` myId 인자) — 커밋 `311e40c`
- [x] 부모 메시지 소프트 삭제 시 자식 답글의 `parent.deletedAt` 즉시 갱신 — 같은 커밋
- [x] 머무는 동안 새 메시지 자동 읽음 (Phase A 정책 ②) — 같은 커밋

### Day 13 — 데모 준비

- [ ] **`docs/chat/00-overview.md` 최종 갱신**
- [ ] **`docs/chat/05-api-spec.md` 변경된 사항 반영**
- [ ] **`CLAUDE.md` 4.5절·5절 갱신** (`ChatRoomMember`, `MessageReaction` 모델 반영)
- [ ] **데모 시나리오 리허설**
- [ ] **알려진 이슈 목록 작성** (Phase B로 이연되는 항목들)

---

## Phase B 이연 항목 (13일 이후)

- [ ] 채널형 그룹 (`ChatRoomType.CHANNEL`)
- [ ] ADMIN 권한 시스템
- [ ] 멤버 추방 / 권한 위임
- [ ] 파일/이미지 첨부
- [ ] 메시지 검색 (전문 검색)
- [ ] 읽지 않은 메시지로 점프
- [ ] **푸시 알림** (앱 꺼진 상태 — APNs/FCM, 모바일 앱 전제)
- [ ] **알림 센터** (종 모양 아이콘으로 보는 알림 목록)
- [ ] **알림 설정** (방별 음소거, 사운드 on/off, 키워드 알림 등)
- [ ] **읽음 표시 정책 진화** — 후보 ① → 후보 ③ (디바운스/배치) 검토 (사용자 테스트 결과 후)
- [ ] Rate limiting
- [ ] 메시지 신고/관리자 검토

### Phase A 후반 latency fix 안전성 재검토 (PR #10·#11·#12 결과)

Phase A 운영 환경에서 메시지 전송 1-2초 → 0.5-0.7초로 단축한 두 fix가 안전성 트레이드오프를 동반함. 강퇴/leftAt 등 Phase B 기능 도입 시 재검토 필요.

- [ ] **`chatRoom.lastMessage` fire-and-forget + retry (PR #10·#12) 재평가**
  - 현재: INSERT만 await, lastMessage는 background + 1s/2s/4s exponential backoff 3회 재시도
  - 트랜잭션 atomicity 약화 → 3회 모두 실패 시 chat_rooms.lastMessage stale (다음 메시지가 자동 회복)
  - **운영 시 액션**: `logger.error('chatRoom.lastMessage update final failure ...')` 모니터링 알람 설정
  - **대안**: 운영 부하가 충분히 낮으면 fire-and-forget 해제하고 트랜잭션 복원 (latency +130ms vs 강한 일관성)
  - **혹은**: nightly background job으로 chat_rooms.lastMessage = (가장 최신 chat_messages) 동기화 추가

- [ ] **socket 멤버십 캐시 cross-socket invalidate (PR #11·#12)**
  - 현재: socket 단위 5분 TTL 캐시. message:send 시 DB 검증 skip
  - **Phase B에서 강퇴/leftAt 갱신 도입 시 위험**: 강퇴된 사용자의 socket이 최대 5분 동안 메시지 보낼 수 있음 (TTL 안전망이 최대 윈도우 제한)
  - **해결 옵션**:
    1. **TTL 단축** — 5분 → 30초. 강퇴 인지 윈도우 짧아짐, DB 쿼리는 약간 늘어남
    2. **Redis pub/sub** — leftAt 갱신 시 모든 backend 인스턴스에 invalidate 발사. 정밀하지만 인프라 추가
    3. **강퇴 시 socket 강제 disconnect** — leftAt 갱신 후 그 사용자의 모든 socket 종료. 가장 단순
  - 강퇴 기능 구현 PR과 함께 결정

### 메시지 삭제 정책 강화 (PR #14·#15 후속)

Phase A에서는 **카카오톡 스타일 익명 placeholder** (UI만)로 마감. 시간 제한·내 화면에서만 삭제 등 추가 정책은 사용자 피드백 후 도입 검토.

- [ ] **시간 제한 5분 도입 검토 (옵션 B)**
  - 현재: 무제한 삭제 가능 (Phase A 단순성 우선 — `01-decisions.md` §3)
  - 카카오톡 정책: 전송 후 5분 이내만 모두에게 삭제. 그 후엔 회수 불가
  - **도입 시 변경**:
    - backend `chat.service.deleteMessage` — `Date.now() - createdAt > 5min`이면 BadRequestException
    - frontend — 5분 지난 메시지의 삭제 버튼 hide 또는 disable
  - **결정 트리거**: 사용자가 옛 메시지 대량 삭제로 대화 맥락 깨는 사례 발생 시
  - **반대 의견**: 학생 팀 데모 환경에선 자유로운 삭제가 사용자 학습 비용 낮음

- [ ] **\"내 화면에서만 삭제\" 분기 도입 검토 (옵션 C)**
  - 현재: 삭제 = 모두에게 삭제 (소프트 삭제 broadcast)
  - 카카오톡 정책: 두 옵션 분기
    1. \"모두에게 삭제\" — 5분 이내, 모든 참여자 placeholder
    2. \"내 화면에서만 삭제\" — 시간 무관, 본인 디바이스에서만 hide
  - **도입 시 변경 (큰 작업)**:
    - DB: `user_hidden_messages` 테이블 신설 (`userId`, `messageId`, `hiddenAt`)
    - backend: GET /messages 응답에서 본인 hidden 항목 필터링
    - frontend: 우클릭 메뉴에 두 옵션 분기 + UI
    - broadcast 영향 없음 (로컬 hide니까)
  - **결정 트리거**: 사용자가 \"옛 메시지를 내 화면에서만 정리하고 싶다\" 요청 발생 시
  - **반대 의견**: DB 부담 + 동기화 복잡도 증가, Phase B 인프라 부담

---

## 일정 위험 지표 (DAILY 모니터링)

| 신호 | 임계값 | 대응 |
|---|---|---|
| baseline migration 미처리 | Day 7 종료 시 | 인증 담당자에게 staging 배포 보류 통보, hotfix 티켓 |
| 인증 fallback_secret 미패치 | Day 12 종료 시 | DM 모듈만이라도 머지, 데모는 별도 환경 |
| refresh token 도입 지연 | Day 12 종료 시 | Day 12 만료 토큰 시나리오 테스트는 access only로 진행 |
| 프론트엔드 통합 지연 | Day 11 종료 시 메시지 송수신 미동작 | 단순화: 답글·반응·인앱 토스트 이연, 뱃지만 유지 |
| 인앱 알림 시간 부족 | Day 5 종료 시 unreadCount 미동작 | (이미 통과 — 위험 해소) |

---

## 매일 작업 종료 시 갱신 항목

작업 종료 전 다음을 갱신:

1. **이 파일의 체크박스** — 완료된 항목 [x]로
2. **`00-overview.md`의 진행 단계 + 오늘의 작업** — 다음날 할 일
3. **`00-overview.md`의 보류 중인 외부 의존성** — 진행 상태 갱신
4. (변경 있으면) **`01-decisions.md`** — 새 결정 기록
5. (변경 있으면) **`05-api-spec.md` 변경 이력** — API 변경 기록

---

## 일정 시작 명령

작업 시작 시 Claude Code에 다음 입력:

```
@CLAUDE.md
@.claude/commit-rules.md
@docs/chat/00-overview.md
@docs/chat/06-13day-plan.md

오늘 Day [N] 작업 시작할게.
[오늘 할 일 한 줄 요약]
```

특정 작업이 필요한 경우 추가 컨텍스트:
- schema·shared types 작업 → `@docs/chat/02-schema.md @docs/chat/03-shared-types.md`
- 인증 통합 → `@docs/chat/04-auth-interface.md`
- API 구현 → `@docs/chat/05-api-spec.md`