# DM 모듈 수동 검증

Day 4·5에서 적용한 보안 패치 + 인앱 알림 + 자동 읽음 + 멀티 디바이스 동기화 동작 검증 스크립트.

## 사전 준비

1. Docker Compose가 실행 중이어야 함 (`cd ~/mocozi-develop && docker compose up -d`)
2. 백엔드 헬스체크: `curl http://localhost:8080/api/auth/login -X POST -H 'Content-Type: application/json' -d '{}'` → 4xx 응답이 와야 함 (살아있다는 신호)
3. `node` 18+ (Node 20 권장)
4. (선택) `jq` — 없으면 `python3` 자동 사용

## 한 번에 실행

```bash
cd scripts/verify
chmod +x setup.sh test-rest.sh
npm install                # socket.io-client만 설치
npm run test:all           # setup → REST → WS 전부
```

## 단계별 실행

### 1. 사용자 등록 + 로그인

```bash
./setup.sh
```

매 실행마다 새 timestamp 이메일로 Alice/Bob 두 명 등록. 결과 토큰은 `.tokens.json`에 저장됨.

### 2. REST 시나리오 (9개 검증)

```bash
./test-rest.sh
```

확인 항목:
- DIRECT 방 생성
- find-or-create 멱등성 (같은 호출 → 같은 방)
- 채팅방 목록 조회
- 방 상세 조회 (양쪽 멤버 접근 가능)
- 401 미인증 차단
- 빈 방 메시지 페이징 (length=0, nextCursor=null)
- GROUP 방 생성
- 잘못된 cursor → 400 (decodeCursor 검증)

### 3. Socket 시나리오 (Day 4~7 핵심)

```bash
npm install
node test-ws.js                # Day 4-5 dual broadcast / 자동 읽음
node test-ws-edge.js           # senderId 위조·비-멤버·exception 형식
node test-ws-edit-delete.js    # Day 6 수정/삭제
node test-ws-reply.js          # Day 7 답글(parentId)
node test-ws-reaction.js       # Day 7후반 반응(emoji)
node test-ws-reconnect.js      # Day 12 재연결·catch-up
```

### 4. 성능 측정 (Day 12-1)

```bash
node test-perf-pagination.js   # 1000 메시지 cursor walk + EXPLAIN ANALYZE
```

확인 항목:
- **[보안] 토큰 없으면 즉시 disconnect** (보안 결함 §2-2 패치 검증)
- **[보안] 잘못된 토큰도 disconnect**
- Alice + Bob + BobTab2(멀티 탭) 동시 연결
- **[Day 4] dual broadcast**: 방 안에 있는 사람은 `message:new`, 글로벌 room의 다른 멤버는 `notification:newMessage`
- 방 밖에 있는 Bob이 `notification:newMessage`를 받음 (인앱 알림)
- **[Day 5 / Pattern C] 자동 읽음**: Bob이 방 입장하면 unreadCount=0
- **[Day 5] 멀티 디바이스 unread 동기화**: BobTab2도 `unreadCountChanged` 수신
- 방 안에서 새 메시지 도착 → Bob은 두 이벤트 모두 받음
- Bob `message:read` → BobTab2 사이드바 즉시 갱신

## 사용자가 직접 확인해야 할 부분

스크립트가 자동 검증하는 항목 외에 **사람이 눈으로 봐야 할 것**:

| 항목 | 어떻게 확인 |
|---|---|
| 백엔드 로그에서 ChatGateway가 새 이벤트 이름으로 등록됐는지 | `docker compose logs backend \| grep "subscribed to"` — 가장 최근 부팅 로그에 `conversation:join`, `conversation:leave`, `message:send`, `message:read` 4개 보여야 함 (옛 부팅 기록의 `joinRoom/leaveRoom/sendMessage`는 무시) |
| DB에 방·메시지가 실제로 저장됐는지 | `docker compose exec db psql -U mocozi -d mocozi_db -c 'SELECT type, name, "lastMessage" FROM chat_rooms;'` ← 컬럼명이 camelCase라 **반드시 큰따옴표** 필요 (Postgres가 unquoted identifier를 lowercase로 변환하기 때문). `chat_messages`, `chat_room_members`도 같은 방식 |

## 트러블슈팅

| 증상 | 원인 |
|---|---|
| `setup.sh: ✗ 백엔드 응답 안 함` | docker 다운 또는 backend 컨테이너 죽음 |
| `register 시 학교 이메일 사용해주세요` | 이메일이 `.ac.kr`로 끝나야 함. 스크립트는 `@test.ac.kr` 자동 사용 |
| `test-ws.js: 토큰 없으면 disconnect` 실패 | WsJwtGuard 또는 handleConnection의 토큰 검증이 안 됨. backend/src/auth/guards/ws-jwt.guard.ts 확인 |
| `Bob notification 안 받음` | `user:<id>` 글로벌 room 가입이 안 된 것. handleConnection 로그 확인 |
| `unreadCount` 값이 예상과 다름 | `getUnreadCount` 쿼리 확인. `senderId: { not: userId }` + `deletedAt: null` 누락 의심 |

## 결과 해석

```
═══════════════════════════════
  REST 시나리오 ✓ 11/11 통과
═══════════════════════════════
═══════════════════════════════
  Socket 시나리오 ✓ 26/26 통과
═══════════════════════════════
═══════════════════════════════
  Edge Case ✓ 13/13 통과
═══════════════════════════════
═══════════════════════════════
  Day 6 (수정/삭제) ✓ 25/25 통과
═══════════════════════════════
═══════════════════════════════
  Day 7 (답글) ✓ 20/20 통과
═══════════════════════════════
═══════════════════════════════
  Day 7후반 (반응) ✓ 28/28 통과
═══════════════════════════════
```

총 135/135 통과 + 성능 측정 (1000 메시지 / 21 페이지 / 평균 6ms / 비율 0.33×) 정상이면 Day 4~12 변경 사항 모두 의도대로 동작.

## 검증된 핵심 동작 한눈에

| 항목 | 어디서 검증 |
|---|---|
| **보안 §2-2** 토큰 없는/잘못된 ws 연결 차단 | test-ws.js [0], [0b] |
| **보안 §2-2** senderId 위조 시도 무효화 (whitelist + 토큰 추출) | **test-ws-edge.js [1]** |
| **Day 4** 비-멤버 conversation:join 차단 (Forbidden) | **test-ws-edge.js [2]** |
| **Day 4** dual broadcast (방 안 → message:new, 방 밖 → notification만) | test-ws.js [3] |
| **Day 5 Pattern C** 자동 읽음 (방 입장 시 unreadCount=0) | test-ws.js [4] |
| **Day 5** 멀티 디바이스 unread 동기화 | test-ws.js [4], [6] |
| **WsAllExceptionFilter** {code, message, payload} 페이로드 형식 | **test-ws-edge.js [3], [4]** |
| **Pattern A** 잘못된 cursor → 400 BadRequest | test-rest.sh [9] |
| **Pattern A** find-or-create 멱등성 | test-rest.sh [2] |
| **Day 6** 본인 메시지 수정 + room broadcast (`message:edited`) | test-ws-edit-delete.js [1] |
| **Day 6** 남의 메시지 수정/삭제 차단 (Forbidden) | test-ws-edit-delete.js [2], [4] |
| **Day 6** 소프트 삭제 + room broadcast (`message:deleted`) | test-ws-edit-delete.js [3] |
| **Day 6** 삭제된 메시지 수정 → NotFound | test-ws-edit-delete.js [5] |
| **Day 6** 삭제 멱등성 (재호출 시 OK) | test-ws-edit-delete.js [6] |
| **Day 6** REST PATCH/DELETE 동등 동작 + 403 | test-ws-edit-delete.js [7] |
| **Day 7** 답글 parent 미리보기 (id/content/senderId/deletedAt) | test-ws-reply.js [1], [2] |
| **Day 7** 부모 소프트 삭제 후 답글 row 보존 | test-ws-reply.js [3], [4] |
| **Day 7** 답글의 parent 필드는 부모 deletedAt까지 노출 | test-ws-reply.js [5] |
| **Day 7** 잘못된/다른 방 parentId → BadRequest | test-ws-reply.js [6] |
| **Day 7후반** 반응 추가/제거 + room broadcast | test-ws-reaction.js [1], [4] |
| **Day 7후반** 같은 (msg, user, emoji) 중복 → Conflict | test-ws-reaction.js [2] |
| **Day 7후반** 다른 emoji는 같은 메시지에 추가 가능 | test-ws-reaction.js [3] |
| **Day 7후반** 반응 제거 멱등 + REST 동등 | test-ws-reaction.js [5], [6] |
| **Day 7후반** 비-멤버 반응 차단 (Forbidden) | test-ws-reaction.js [7] |
| **Day 7후반** 삭제된 메시지에 반응 불가 (NotFound) | test-ws-reaction.js [8] |
| **Day 7후반** GET /messages 응답에 reactions 배열 포함 | test-ws-reaction.js [9] |
