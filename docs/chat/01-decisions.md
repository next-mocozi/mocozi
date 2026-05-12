# DM 모듈 — 확정된 설계 결정

> 이 문서는 **결정의 결과**만 담습니다. 비교·토론 과정은 제외하되, 각 결정의 핵심 근거 1~2줄을 함께 기록합니다.

---

## 1. 그룹 DM 형태 — 단계적 확장

| Phase | 형태 | 설명 |
|---|---|---|
| **A** (현재) | 단순 N명 DM | 카톡 단톡방 형태. 멤버 추가/나가기 자유, 이름 선택 |
| **B** (추후) | 채널형 그룹 | Slack 채널 형태. 관리자 권한, 공개 설정 등 |

**구조적 결정**: 두 단계 모두 **같은 `ChatRoom` 테이블**에 `type` enum으로 구분 (`DIRECT` / `GROUP` / `CHANNEL`). 메시지·멤버십 로직이 사실상 동일해서 테이블 분리는 코드 중복만 만듦.

---

## 2. ID 전략 — UUID

**선택**: 모든 채팅 모델의 PK는 `String @id @default(uuid())`.

**근거**:
- 기존 모코지 DB가 전부 UUID로 통일 (User, Team, RecruitPost 등). 일관성 유지
- 클라이언트가 `crypto.randomUUID()`로 메시지 ID를 미리 생성 가능 → 낙관적 UI 패턴 지원

---

## 3. 메시지 수정 / 삭제 정책

| 항목 | 정책 |
|---|---|
| **수정** | 시간 제한 **없음**. `editedAt` 필드로 표시. UI에서 "(편집됨)" 표기 |
| **삭제** | **소프트 삭제**. `deletedAt` 필드로 마킹, "삭제된 메시지입니다" placeholder 렌더 |
| **답글** | `parentId` 자기참조. 부모가 소프트 삭제돼도 답글은 보존 |

**근거**: 답글 기능 때문에 하드 삭제 시 부모-자식 관계가 끊어짐. 소프트 삭제로 데이터 무결성 유지.

---

## 4. 읽음 처리 — 모델 C 채택

**선택**: `ChatRoomMember.lastReadMessageId` (멤버십 row에 단일 컬럼)

**대안 비교**:
| 모델 | 저장 위치 | 단점 |
|---|---|---|
| A. 마지막 읽은 시각 | Member 컬럼 | 시계 동기화 문제 |
| B. 메시지마다 readBy 배열 | Message 배열 | 메시지 N × 멤버 M 부피, 인덱싱 어려움, 한 번 읽음 처리에 N개 update |
| **C. 마지막 읽은 메시지 ID** | Member 컬럼 | 정밀도 낮으나 채팅 UX엔 충분 ← **채택** |

**근거**:
- 카톡/텔레그램/디스코드 표준
- "안 읽은 개수" 쿼리가 단순 COUNT로 끝남 (`WHERE roomId AND createdAt > ?`)
- 멤버십 1행 update로 다 읽음 처리 완료 (B는 N개 메시지 update)

**현재 코드 변경 영향**:
- `backend/prisma/schema.prisma:223` — `readBy String[]` 제거
- `backend/src/chat/chat.service.ts:41` — `readBy: [senderId]` 제거
- `shared/types/chat.ts:19` — `readBy: string[]` 제거
- (신규) `markAsRead(roomId, userId, messageId)` 메서드 추가

---

## 5. 토큰 정책 — access 1시간 + refresh 30일

**선택**: Phase A 동안 도입 (Phase B로 미루지 않음).

| 토큰 | 수명 | 역할 |
|---|---|---|
| **access** | 1시간 | 매 요청 검증용. 도난 시 1시간 후 자동 무효화 |
| **refresh** | 30일 | access 갱신용. DB 저장 → revoke 가능 |

**근거**:
- access 1일은 도난 시 위험 노출 시간이 너무 김 (업계 표준 15분~1시간)
- refresh 7일은 사용자 경험 나쁨 (매주 강제 로그인)
- 1시간 + 30일은 보안과 UX의 균형점. AWS·Google 패턴과 유사

**현재 코드 변경**:
- `backend/src/auth/auth.module.ts:13` — `expiresIn: '7d'` → `'1h'`
- `backend/src/auth/auth.service.ts:64-65` — refresh sign + DB 저장 추가
- `backend/.env.example` — `JWT_REFRESH_SECRET` 변수 추가
- 신규: `POST /api/auth/refresh` 엔드포인트

→ 인증 담당자 책임. DM 담당은 인터페이스만 가정하고 진행.

---

## 6. 데이터베이스 컨벤션

### @@map (snake_case 테이블명) 유지

기존 모든 모델이 `@@map("snake_case")` 컨벤션을 따름. 채팅 모델도 동일하게:
- `chat_rooms`, `chat_room_members`, `chat_messages`, `message_reactions`

### onDelete: Cascade — 채팅 영역만 예외 사용

기존 다른 모델(Team, RecruitPost 등)은 cascade를 쓰지 않음. 그러나 채팅에는:
- `ChatRoom → ChatRoomMember`: cascade
- `ChatRoom → ChatMessage`: cascade
- `ChatMessage → MessageReaction`: cascade

**근거**: "방 폭파" 시 데이터 무결성을 위한 안전장치. 일반 운영에서는 메시지를 소프트 삭제(`deletedAt`)하므로 cascade가 발동할 일 거의 없음. 코드 주석으로 예외 사유 명시.

---

## 7. WsJwtGuard 신설 — 위치는 `auth/guards/`

**선택**: `backend/src/auth/guards/ws-jwt.guard.ts` 신규 생성. DM 담당이 만들지만 인증 폴더에 위치.

**근거**:
- 향후 알림 모듈·협업 화면 공유 등에서 WebSocket 재사용 가능성
- 인증 관련 가드는 한 위치에 모여 있는 게 발견성 높음
- 만드는 사람과 위치하는 폴더가 다를 수 있다는 점은 PR 설명에 명시

---

## 8. 모노레포 동기화 원칙

이 프로젝트는 pnpm workspace 모노레포(`@mocozi/backend`, `@mocozi/frontend`, `@mocozi/shared`).

**불변 규칙**: 다음은 **반드시 같은 PR**에 묶여야 함.

| 변경 | 동시 갱신 대상 |
|---|---|
| Prisma schema 채팅 영역 | `shared/types/chat.ts` (타입 동기화) |
| 채팅 service/gateway | DTO 파일들, shared types |
| API 명세 변경 | `docs/chat/05-api-spec.md` 갱신 |

**위반 시**: 한쪽만 머지되면 빌드 깨짐 (frontend가 옛 타입으로 새 schema 호출 등).

---

## 9. PR 분할 전략

| PR | 범위 | 비고 |
|---|---|---|
| **PR1+2 통합** | schema + shared types + service + gateway + DTO + WsJwtGuard | 한 덩어리. 분리 시 빌드 깨짐 |
| **PR3** | 프론트엔드 (`useSocket`, chat 페이지) | 백엔드 머지 후 별도 진행 |
| **별개** | 인증 fallback_secret 제거 | 한 줄 수정. 의존성 0 |
| **별개** | refresh token 도입 | 인증 담당자 작업. DM과 무관 |

**근거**: PR1과 PR2를 분리하면 머지 사이에 백엔드가 옛 schema 가정 코드 + 새 schema로 동작 → 빌드 실패. 같이 가야 안전.

---

## 10. 인앱 알림 — Phase A에 포함 (채팅 모듈 통합)

**선택**: 별도 알림 모듈 만들지 않고 **채팅 모듈에 통합**해서 인앱 알림 구현.

**범위 명확화**:
- ✅ **인앱 알림 (Phase A)**: 앱이 켜져 있는 상태에서의 화면 내 알림
- ❌ **푸시 알림 (Phase B 이연)**: 앱이 꺼져 있어도 OS 차원에서 뜨는 알림 (APNs/FCM 필요)

**Phase A에 포함되는 인앱 알림 기능**:

| 기능 | 구현 위치 | 설명 |
|---|---|---|
| 안 읽은 메시지 카운트 | 채팅방 목록 API의 `unreadCount` 필드 | `lastReadMessageId` 기반 COUNT 쿼리 |
| 사이드바 빨간 점 | 프론트엔드 `chat/page.tsx` | `unreadCount > 0`일 때 표시 |
| 다른 방 메시지 토스트 | 프론트엔드 글로벌 socket 리스너 | 현재 방 아닌 곳에서 메시지 도착 시 화면 위 토스트 |
| 메시지 도착 사운드 (선택) | 프론트엔드 | 사용자 설정에 따라 |

**근거**:
- 알림 없이 채팅만 있으면 사용자가 메시지 도착을 모르고 방치 → 서비스 신뢰도 하락
- 인앱 알림은 채팅 모듈의 자연스러운 확장 (`lastReadMessageId` 이미 존재)
- 별도 알림 모듈 만들 필요 없음. 추가 작업 4~5시간 수준

**Phase A에 포함하지 않는 것**:
- 푸시 알림 (모바일 앱 전제. 모코지가 PWA·웹 위주라 의미 작음)
- 알림 센터 페이지 (종 모양 아이콘으로 보는 알림 목록 — 채팅 외 알림 늘면 그때 도입)
- 알림 설정 페이지 (방별 음소거 등)

---

## 11. 읽음 처리 시점 정책 (Phase A)

클라이언트가 서버에 "여기까지 읽었어요"를 알려주는 시점. 후보 3가지 중 **①+② 조합** 채택.

| 후보 | 트리거 | Phase A 채택 |
|---|---|---|
| ① 채팅방 진입 시 자동 | `conversation:join` → 그 시점의 last 메시지로 lastReadMessageId 갱신 | ✅ 채택 |
| ② 새 메시지 수신 시 즉시 | 그 방을 보고 있다면 `message:read` 이벤트 즉시 발사 | ✅ 채택 |
| ③ 스크롤·뷰포트 디바운스 | 메시지가 화면에 들어올 때마다, 디바운스 적용 | ❌ Phase B 검토 |

**근거**:
- 후보 ① 단독: 방에 들어와 한참 머물면서 새 메시지가 도착해도 unread 안 줄어듦. 사이드바에 unreadCount가 남아있는 버그처럼 보임
- 후보 ② 단독: 진입 시점부터 누적된 unread는 안 사라짐. 방 들어가도 뱃지 안 사라짐
- 후보 ③: 정밀하지만 클라이언트 IntersectionObserver + 디바운스 + 다중 메시지 일괄 처리 등 구현 복잡. Phase A 단순성 희생 큼
- ①+②는 서로 보완적. 진입 시 일괄 catch-up + 머무는 동안 실시간 read

**서버 구현**:
- `conversation:join` (`chat.gateway.ts`) — assertMembership + room 가입 + `markRoomAsReadToLatest` + `notification:unreadCountChanged` broadcast
- `message:read` (`chat.gateway.ts`) — `markAsRead` + `notification:unreadCountChanged` broadcast

**다중 디바이스 동기화**:
- 두 정책 모두 broadcast 대상은 본인 `user:<userId>` glob room
- 한쪽 디바이스에서 읽으면 다른 쪽 사이드바도 즉시 갱신

**Day 11 진화 가능성**:
- 사용자 테스트에서 ①+② 조합의 한계가 드러나면 후보 ③(디바운스)로 진화 검토
- 단, Phase A는 단순성 우선

---

## 13. 채팅 latency 최적화 (Phase A 후반)

Railway(싱가포르) + Supabase(서울) 환경에서 메시지 전송 ack 1-2초 → ~0.5-0.7초로 단축. PR #10·#11·#12 누적.

### 문제

운영 환경에서 한 메시지 전송 시 클라이언트가 ack 받기까지 1-2초 — 사용자가 "전송중..." 상태로 길게 머묾. 분해:

```
클라 → Railway(싱가포르)         ~130ms
Railway → Supabase(서울) RTT × 3
  ① assertMembership                ~130ms
  ② chatMessage.create (with include) ~150ms
  ③ chatRoom.update (lastMessage)   ~130ms
Railway → 클라 (ack/broadcast)    ~130ms
─────────────────────────────────
합계                               ~670ms+
```

### 결정 1 — `chatRoom.update` fire-and-forget (PR #10)

**선택**: 트랜잭션에서 분리. INSERT만 await, lastMessage는 background 비동기 처리.

**근거**:
- 사용자 ack에 critical 아님 — broadcast 페이로드에 메시지 정보 이미 포함, 사이드바도 즉시 갱신
- 갱신 실패 시 다음 메시지 또는 GET /rooms 시점에 자동 일관성 회복
- ack에서 RTT 1개(~130ms) 제거

**대안 검토**:
- 트랜잭션 유지 (atomicity 강화) — latency 증가
- chatRoom.update를 별도 background job으로 큐에 — 인프라 추가, 학생 환경 부담

**안전망 (PR #12)**:
- exponential backoff retry (1s → 2s → 4s, 최대 3회)
- `updateMany` + `WHERE lastMessageAt < messageCreatedAt` 조건부 — out-of-order 보호 (옛 retry가 새 메시지 덮어쓰기 방지)
- 최종 실패 시 `logger.error` — 운영에서 모니터링 알람 설정

**Phase B 재검토 항목**:
- 트랜잭션 복원 vs fire-and-forget 유지 — 운영 부하 측정 후 결정
- nightly 동기화 background job 추가 검토

### 결정 2 — `assertMembership` socket 단위 캐싱 (PR #11)

**선택**: Socket connection에 `Map<roomId, joinedAtMs>` 캐시. `conversation:join` 통과 시 timestamp 기록, `message:send`에서 cache hit이면 DB 검증 skip.

**근거**:
- 사용자가 한 번 conversation:join 통과하면 그 socket 동안 활성 멤버 (Phase A에서 강퇴/leftAt 갱신 기능 없음)
- 매 메시지마다 chat_room_members 조회는 redundant
- ack에서 RTT 1개(~130ms) 제거

**대안 검토**:
- Redis cache — 인프라 추가, 학생 환경 부담
- 짧은 in-memory cache (1분 TTL) — 효과 작음

**안전망 (PR #12)**:
- 5분 TTL — Phase B에서 강퇴 기능 도입 시 stale 윈도우 최대 5분으로 제한
- Cache miss 또는 TTL 만료 시 자동 DB fallback

**Phase B 재검토 항목**:
- 강퇴/leftAt 도입 시 stale 윈도우 5분이 허용 가능한지 평가
- 후보 1: TTL 단축 (30초)
- 후보 2: Redis pub/sub 기반 cross-socket invalidate
- 후보 3: 강퇴 시 socket 강제 disconnect (가장 단순)

### 누적 측정

| 단계 | ack latency |
|---|---|
| PR #10 전 | ~1초+ |
| PR #10 후 | ~0.85초 |
| PR #11 후 (현재) | **~0.5-0.7초** |

PR #12는 안전망이라 latency 영향 0.

---

## 14. 메시지 삭제 placeholder 익명화 (카카오톡 스타일)

삭제된 메시지를 채팅창에 표시할 때 누가 보낸/삭제한 메시지인지 위치·이름으로 노출하지 않음. 단체방에서 삭제 시 사회적 부담 감소가 주 목적.

### 결정

**선택**: 채팅 흐름 가운데 정렬 + 시스템 메시지 스타일 + 익명 placeholder.

```tsx
if (message.deletedAt) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full bg-gray-100 px-3 py-1 text-xs italic text-gray-400">
        삭제된 메시지입니다
      </div>
    </div>
  );
}
```

### 카카오톡 정책 비교

| 항목 | 카카오톡 | Phase A 채택 |
|---|---|---|
| 익명 placeholder | ✅ | ✅ 채택 |
| 가운데 정렬 (위치 익명화) | ✅ | ✅ 채택 |
| **시간 제한 5분** | ✅ | ❌ 미채택 (옵션 B로 이연) |
| **\"내 화면에서만 삭제\" 분기** | ✅ | ❌ 미채택 (옵션 C로 이연) |
| 답글 인용에서도 \"(삭제된 메시지)\" | ✅ | ✅ 이미 구현 |

### 옵션 B (시간 제한 5분) 미채택 근거

- Phase A는 단순성 우선 — `01-decisions.md` §3 \"수정/삭제 정책: 시간 제한 없음\"
- 학생 팀 데모 환경 — 사용자 학습 비용 낮추는 게 우선
- 옛 메시지 대량 삭제로 대화 맥락 파괴되는 사례 관찰되면 Phase B에서 도입

**도입 시 변경**:
- backend `chat.service.deleteMessage`에 `Date.now() - createdAt > 5min` 체크
- frontend: 5분 지난 메시지 삭제 버튼 hide

### 옵션 C (\"내 화면에서만 삭제\") 미채택 근거

- DB 부담 — `user_hidden_messages` 테이블 신설 필요
- 동기화 복잡도 — 멀티 디바이스에서 hidden 상태 일관성 유지 비용
- Phase A 트래픽엔 사용자별 hide 요구 발생 가능성 낮음

**도입 시 변경**:
- DB: `user_hidden_messages (userId, messageId, hiddenAt)` 테이블 신설
- backend: GET /messages 응답에서 본인 hidden 필터링
- frontend: 우클릭 메뉴에 \"모두에게 삭제\" / \"내 화면에서만 삭제\" 분기
- broadcast 영향 없음 (로컬 hide)

### Phase B 재검토 트리거

- B: \"옛 메시지를 5분 후에도 삭제해서 대화 맥락이 깨진다\"는 사용자 피드백
- C: \"내 화면에서만 정리하고 싶다\"는 사용자 피드백
- 둘 다 `docs/chat/06-13day-plan.md` Phase B 이연 항목에 등록됨

---

## 15. 빈 방(메시지 0개) 자동 숨김 정책

**문제**: 사용자가 컨텍스트(채용글/프로필/팀 등) "채팅하기" 버튼으로 진입 → backend가 `POST /api/chat/rooms` 자동 호출하여 ChatRoom 생성. 사용자가 메시지 한 줄도 안 보내고 나가면, **양쪽 멤버의 RoomList에 빈 방이 남아 시각 노이즈**.

**선택**: Frontend RoomList에서 조건부 표시 (= 필터링). 데이터는 보존, 뷰만 정리.

**표시 조건** (셋 중 하나라도 만족):
| 조건 | 의미 |
|---|---|
| `room.lastMessage` 존재 (alive 메시지 1개 이상) | 진짜 대화 시작됨 — 표시 |
| `localStorage['chat-draft-${roomId}']` 비어있지 않음 | 본인이 작성 중 — 의도 보존, 본인에게만 표시 |
| `pathname === /chat/${room.id}` (현재 보고 있는 방) | 사용자가 열어둔 방이 list에서 사라지면 혼란 — 본인 한정 표시 |

셋 다 아니면 RoomList에서 숨김 (양쪽 멤버 동일 — 상대도 같은 필터로 빈 방 안 보임).

**예외**: "숨긴 채팅" 화면(`showingHidden=true`)에선 필터 우회. 명시 숨김한 방은 메시지 유무 무관 표시.

**정렬 기준** (필터 통과 후 frontend client-side sort):
우선순위 `lastMessageAt > sessionStorage 'chat-entered-${roomId}' > createdAt` DESC.

- 메시지 있는 방: `lastMessageAt`
- 빈 방 + 본인 진입 이력 있음: **진입 시점** (chat/[roomId] mount 시 sessionStorage 기록)
- 빈 방 + 진입 이력 없음: `createdAt` fallback

**진입 시점이 별도 필요한 이유**: DIRECT find-or-create로 옛 빈 방이 재사용된 경우
`createdAt`은 처음 만들 때 시각이라 옛 자리에 박힘. 사용자 의도("방금 진입한 방을 지금
시점에 timeline 끼움")와 다름. sessionStorage 기반 진입 timestamp로 해결.

backend `getUserRooms`는 `lastMessageAt DESC NULLS LAST`라 빈 방을 모두 가장 아래로
밀지만, frontend 정렬 보정으로 진입 시점 기준 우선. (backend 변경 없음)

**근거**:
- **삭제 vs 숨김 비교 시 "삭제" 불필요**: backend는 DIRECT 방에 find-or-create 패턴이라 같은 멤버 조합으로 재진입 시 기존 방 재사용. 메시지 0개 방을 list에서 숨겨도 재진입 동작 동일.
- **양쪽 일관성**: 본인만 숨기는 hiddenAt 방식은 상대 화면엔 여전히 빈 방 남음 → 상대도 더러워 보임. 양쪽 모두 필터 적용해야 깔끔.
- **draft 보존**: 입력창에 글 쓰다 나간 사용자에게 list에서 방이 사라지면 의도 파괴. 본인 localStorage에 draft 있으면 본인 한정으로 list 유지.
- **"숨긴 채팅" 의미 보존**: hiddenAt은 사용자가 명시 숨김한 경우만. 자동 숨김에 hiddenAt 쓰면 "숨긴 채팅" 화면에 의도하지 않은 방이 섞임.

**구현 위치**: `frontend/src/components/chat/RoomList.tsx` 렌더링 시 `visibleRooms` 필터 (rooms.filter 인라인).

**연관 미해결 — Phase B 이연**:
- DB에 빈 방이 누적되는 정리 문제. 시각적으론 안 보이지만 DB 부담 ↑ → Phase B에서 cron으로 N일(예: 30일) 이상 메시지 0개 방 자동 삭제 검토. 자세한 내용은 `docs/chat/08-phase-b-policy.md` 참조.

---

## 16. 첨부 정책 (파일/이미지)

채팅에 이미지/파일 전송 기능을 추가. 인앱 link 마커 시스템(`[[link:profile:id|label]]`)을 확장한 형태.

### 마커 형식

| Type | 마커 | 비고 |
|---|---|---|
| 파일 | `[[file:storagePath\|filename.pdf\|123456\|application/pdf]]` | path / 이름 / 크기(bytes) / mime |
| 이미지 | `[[image:storagePath\|alt.jpg\|123456\|image/png]]` | inline preview 분기용 (file과 별도 type) |

ChatMessage 모델 변경 없음 — 마커가 본문 content TEXT에 inline. parse는 frontend `parseMessage()`가 통합 처리.

### 크기 한도 (초과 시 frontend가 차단)

| 종류 | 한도 | 근거 |
|---|---|---|
| 이미지 (jpg/png/webp/gif) | **20MB** | 캡처·일반 사진 충분 |
| PDF | **50MB** | 일반 자료·논문·스캔본 |
| Office (.docx/.xlsx/.pptx) | **30MB** | 일반 문서 + 큰 PPT |
| zip | **50MB** | 포트폴리오/소스 묶음. Free plan 한도와 일치. 본격 운영 시 Pro plan으로 100MB+ 확장 검토 |

### 허용 MIME (화이트리스트)

`image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), `application/vnd.openxmlformats-officedocument.presentationml.presentation` (.pptx), `application/zip`.

화이트리스트 외 MIME(예: `.exe`, `.sh`, `.html`)은 backend에서 reject. SVG는 inline script 위험으로 화이트리스트에서 제외.

### Access 제어 — Signed URL with TTL

- Storage 버킷 `chat-attachments`는 **private**. service role key 없이는 접근 불가
- 업로드: backend `POST /api/chat/rooms/:roomId/attachments/upload-url` → presigned PUT URL 발급 (10분 TTL) → 클라이언트가 직접 Supabase에 PUT (backend 트래픽 0)
- 저장: 메시지 마커에는 **URL이 아닌 storage path** (예: `rooms/{roomId}/{uuid}.png`)
- 표시/다운로드: 메시지 렌더 시 frontend가 `POST /api/chat/attachments/sign-url` 호출(path 배치) → backend가 채팅방 멤버 검증 + message.deletedAt 검증 후 signed URL 발급(1h TTL)
- frontend는 발급된 URL을 path별 캐시(`Map<path, {url, expiresAt}>`)로 1h 재사용. 만료 후 자동 재-sign

### 삭제 / 보존 정책

- 메시지 삭제(`deletedAt`) 시 storage 파일은 **보존**. sign endpoint가 메시지 deletedAt 검증으로 403 → 사실상 접근 차단
- 30일 이상 묻힌 (참조 메시지 모두 deletedAt) 첨부 파일은 cron으로 정리. Phase B 항목 — `08-phase-b-policy.md` **B-DM-7** 참조

### 다중 첨부 + 진입점

- 한 메시지에 다중 파일 첨부 가능 (마커 여러 개를 본문에 줄바꿈으로 나열)
- 진입점 모두 지원: 클립 버튼(`<input type="file" hidden multiple>`), 클립보드 paste(textarea `onPaste` → image item), drag-drop(입력 영역 `onDrop`)
- 업로드 진행 중 메시지는 `__uploading: true` flag + per-file progress bar 노출. 모두 완료되어야 socket send 트리거

### 구현 위치

- backend: `chat/storage.service.ts`, `chat/storage.controller.ts`, `chat/chat.service.ts` 마커 검증
- frontend: `lib/messageTemplate.ts` 마커 union 확장, `lib/chat/attachmentUpload.ts`, `lib/chat/signAttachmentUrls.ts`, `components/chat/AttachmentPicker.tsx`, `FileAttachmentCard.tsx`, `ImageAttachment.tsx`

### Phase B 이연

- Supabase image transformation (Pro plan) 도입 후 자동 thumbnail
- 30일+ 묻힌 첨부 정리 cron (B-DM-7)
- PDF in-app viewer
- 모바일 카메라 직접 촬영 (`capture="environment"`)
- virus scan / rate limiting

---

## 17. 채팅방 진입 컨텍스트 태그 (RoomList 색 점)

채팅방이 어떤 페이지/맥락에서 시작됐는지 RoomList에서 시각적으로 즉시 인식할 수 있게
아바타 좌상단에 작은 색 점 + hover tooltip + 헤더 (?) 색 범례.

### 저장

`ChatRoom.context MessageContext?` 필드 — nullable (옛 방 호환).
DIRECT find-or-create 시 **첫 컨텍스트 값 유지** — 같은 두 명이 다른 페이지에서 다시 채팅
시작해도 원본 컨텍스트 보존 ("이 방이 어떻게 시작됐는가" 원점 의미).

### 색 매핑 (Phase A — RECRUIT 2종)

| 컨텍스트 | enum | 색 | 라벨 |
|---|---|---|---|
| 구인 (개인) | `RECRUIT_INDIVIDUAL` | `bg-blue-500` 🔵 | 구인 |
| 팀 합류 | `RECRUIT_TEAM` | `bg-amber-500` 🟡 | 팀 |
| 포트폴리오 (5종) | `PORTFOLIO_*` | `bg-emerald-500` 🟢 | 포트폴리오 |
| 옛 방 (context=null) | — | (점 없음) | — |

Phase A에선 RECRUIT 2종만 실제 진입점 코드 wired. Phase B 진입(포트폴리오 페이지) 도입 시
schema/backend는 enum 그대로 동작, frontend도 색·라벨 매핑 이미 등록돼 있어 자동 작동.

### UI

- 위치: 아바타 좌상단 (compact 모드 unread 우상단 점과 분리)
- 크기: `h-2.5 w-2.5` (10px) + `ring-2 ring-white` (배경 분리)
- 정보 노출:
  - `title` HTML attribute hover (desktop 표준)
  - 헤더 우측 (?) 아이콘 클릭 → popover 색 범례
  - 모바일 long-press는 Phase B 후속

### 구현 위치

- backend: `chat/dto/create-room.dto.ts` (DTO), `chat/chat.service.ts` (createRoom),
  `chat/chat.service.ts` (roomInclude / shapeRoom)
- frontend: `types/chat.ts` (ChatRoom.context), `components/chat/RoomList.tsx` (점 + 범례),
  `app/chat/page.tsx` (createRoom POST body에 context 전송)

---

## 18. 결정 변경 이력

| 날짜 | 결정 | 변경 사유 |
|---|---|---|
| 2026-05-03 | ID 전략: CUID → **UUID** | 기존 모코지 DB 컨벤션 일관성 |
| 2026-05-03 | JWT payload: `{sub, email, name}` → **`{sub, email}`** | name은 변경 가능 필드. JwtStrategy.validate()가 DB 조회로 채워줌 |
| 2026-05-03 | refresh: Phase B로 미룸 → **Phase A에 도입** | 7일 access 단일 운영의 데모 사고 위험 (만료로 강제 로그아웃) |
| 2026-05-03 | access/refresh: 1d/7d 검토 → **1h/30d** | 업계 표준 + 보안 우위 |
| 2026-05-03 | 인앱 알림: Phase B 이연 → **Phase A 포함** | 알림 없이 채팅만 있으면 사용자가 메시지 방치. 채팅 모듈 통합으로 추가 비용 작음 |
| 2026-05-03 | 읽음 처리 시점 정책 추가 (§11) — 후보 ①+② 채택 | 후보 ① 단독은 머무는 동안 새 메시지 unread 누적 / 후보 ② 단독은 진입 시 catch-up 누락. 결합으로 양쪽 시나리오 모두 커버 |
| 2026-05-03 | Cursor 페이징을 단순 `createdAt` → **`(createdAt, id)` 복합 + base64url opaque** | JS Date의 ms 정밀도와 Postgres microsecond 정밀도 격차로 같은 ms INSERT 시 페이지 경계에서 메시지 영구 누락. tie-breaking으로 방어 |
| 2026-05-12 | 응답 만료 임계: 7일 → **3일** (§B-DM-8) | 활성 플랫폼 기준 3일이 합리적. 사용자 피드백 빠른 회수 |
| 2026-05-12 | Scout 흐름 B-DM-1 → **C 안** (§19) | 메시지 작성을 채팅방 인사양식 패널로 통일 — UX 일관성. 팝업은 팀 선택만 |
| 2026-05-12 | Scout 모델·API **즉시 폐기** (§20) | B-DM-1 통합 후 `/api/scout/*` 호출 0건. dead code 비용 > 통계 보존 가치 |

---

## 19. Scout 흐름 C 안 (Phase B-DM-8)

**배경**: B-DM-1 통합 단계에서 recruit 카드 → 스카우트 modal이 "팀 선택 + 메시지 입력"으로 받아 첫 메시지를 즉시 보냈음. 인사양식 미리보기 패널은 별도 진입.

**문제**: 메시지를 두 곳(modal textarea / 양식 패널)에서 쓸 수 있어 UX 분산.

**결정**: **C 안 채택** — 모달은 팀 선택만 받고, 메시지 작성은 채팅방 인사양식 패널에서 통일.

**흐름**:
1. recruit 카드 "스카우트" → modal (팀 picker만)
2. 확인 → `POST /api/chat/rooms` (context=SCOUT_FROM_TEAM, contextTargetId=teamId, **firstMessage 없음**)
3. 빈 채팅방 진입 → `shouldShowTemplateTrigger` 조건 만족 → 인사양식 패널 자동 열림 (`autoOpenedRef`로 한 번만)
4. 사용자가 양식 보면서 편집 → 보내기 → 첫 메시지 발송

**Empty room guard 상호작용**: 빈 방이 의도적이라, 사용자가 양식 없이 나가면 guard의 confirm dialog가 발화 — "메시지를 안 보냈는데 정말 나가시겠습니까?" → 스카우트 의지 재확인 UX.

**대체 안 (검토했으나 거부)**:
- A안 (modal에 양식 미리주입): 메시지 편집 위치가 modal/패널 양쪽으로 분산 — 일관성 약화
- B안 (modal=확인만, 양식에서 팀+메시지 모두): 빈 방 context 잡힐 때 teamId 없음 — convoluted

---

## 20. Scout 모델·API 폐기 (Phase B-DM-8)

**배경**: B-DM-1 통합 전엔 `POST /api/scout/:targetUserId`로 스카우트 row를 만들고 후속 수락/거절 흐름을 가졌음. 통합 후 모든 진입이 `POST /api/chat/rooms`로 전환.

**조사 결과** (2026-05-12 grep):
- frontend grep으로 `/api/scout` fetch 0건
- backend `src/scout/` 폴더의 controller/service/dto 모두 호출 없음
- production DB의 `scouts` 테이블: 1 row (테스트 데이터로 추정)

**결정**: **즉시 폐기**
- `backend/src/scout/` 통째 삭제 (git rm)
- `prisma/schema.prisma`에서 `model Scout`, `enum ScoutStatus`, `User.SentScouts/ReceivedScouts`, `Team.scouts` relation 제거
- `pnpm prisma db push --accept-data-loss` → `scouts` 테이블 drop
- `app.module.ts`에서 ScoutModule import 제거

**향후 통계 필요 시**: `chat_rooms.context` (SCOUT_FROM_TEAM)로 충분히 추적 가능.

---

## 21. 응답 만료 시각 신호 (Phase B-DM-8)

**배경**: B-DM-1 흐름에서 보낸 사람이 답장을 못 받은 채 방치되는 채팅방이 누적 가능. 어느 시점부터 "응답 만료"로 시각화해 사용자가 다른 채널을 시도하도록 유도.

**임계**: **3일** (§18 변경 이력 참고).

**판정 조건** (모두 만족 시 `responseExpired = true`):
- `room.context`가 응답 기대 컨텍스트 — SCOUT_FROM_TEAM, RECRUIT_*, PORTFOLIO_*, COMMUNITY_PRIVATE_NOTE
- creator 첫 메시지가 보내진 적 있음 (Scout C 안에서 빈 방 상태로 3일은 만료 X)
- 그 첫 메시지가 3일 이전
- 받는 사람(non-creator)이 한 번도 답장 안 함

**Backend**: `ChatService.computeResponseExpiredBatch` 배치 판정 (PostgreSQL DISTINCT ON으로 방별 첫 메시지 + Prisma distinct로 답장 존재 확인, 쿼리 2회). `shapeRoom`이 `responseExpired: boolean` 반환.

**Frontend**:
- RoomList: 카드 `opacity-60` + 아바타 우하단 ⏰ overlay + preview 옆 `· 응답 만료` 라벨
- 채팅창 헤더 아래: amber-50 banner "⏰ 3일 동안 응답이 없는 상태입니다..."

받는 사람이 답장하면 다음 mount 때 서버 컴퓨트 결과 변경 → 자연 사라짐.

---

## 22. RoomList 인라인 액션 (기획서/프로필 보기, Phase B-DM-8)

**배경**: 채팅방 진입 전에 상대/팀 정보를 빠르게 확인할 방법 부재. 본인이 메시지 받았을 때 "이게 누구지/어떤 팀이지" 파악에 시간 소요.

**결정**: RoomList 카드 hover 시 우측에 작은 아이콘 버튼 노출 — context별 분기.

| context | 아이콘 |
|---|---|
| SCOUT_FROM_TEAM | 📄 기획서 + 👤 프로필 |
| RECRUIT_TEAM | 📄 기획서 |
| RECRUIT_INDIVIDUAL | 👤 프로필 |
| PORTFOLIO_* | 👤 프로필 |
| null / 옛 방 | 표시 안 함 |

**타겟 ID 추출**:
- 프로필: `room.members[].userId` 중 본인 아닌 사람 (DIRECT)
- 팀: `room.contextTargetId` (신규 schema 컬럼). 옛 방은 null → 기획서 버튼 graceful 숨김

**미리보기 컴포넌트**: `RoomPreviewPanel.tsx` 신규. 우측에서 슬라이드 인. `GET /api/teams/:id` 또는 `GET /api/users/:id` 호출. 하단 "자세히 보기"로 정식 페이지 이동.

---

## 23. 알림센터 — 헤더 자리 잡기 (Phase B-DM-8 placeholder)

**배경**: 채팅 외 알림(스카우트/지원/팀 변동 등)을 한 곳에 모을 진입점 필요. 실제 알림 모델·socket 이벤트 wiring은 별도 plan이지만, 헤더 자리는 미리 확보.

**결정**: `NotificationCenter` 컴포넌트 신규 (`frontend/src/components/layout/`)
- 헤더 데스크톱: 프로필 아바타 왼쪽
- 헤더 모바일: 사이드바에 "알림" 항목
- 임시 아이콘: `https://img.icons8.com/windows/32/12B886/notification-center--v2.png` (사용자 지정. 추후 SVG 교체)
- dropdown 콘텐츠 (현 phase 한정): `totalUnread > 0`이면 "안 읽은 채팅 메시지 N개" link, 아니면 "아직 알림이 없어요"

**향후 추가될 알림 카테고리** (Notification 모델·socket 이벤트 wiring 시):
1. 채팅 요청 받음 (recruit/scout/portfolio 첫 메시지)
2. 채팅 답장 받음
3. 응답 만료
4. 지원 접수
5. 지원 처리 결과
6. 팀 멤버 변경
7. (후속) 포트폴리오 인터랙션