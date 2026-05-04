# DM 모듈 — 현재 상태

> **마지막 업데이트**: 2026-05-04 (Day 6 종료 시점)
> **담당**: 김동균
> **일정**: 13일 (Day 1~13)

## 한 줄 요약

모코지의 채팅 모듈 개편이 **Day 6 종료 시점에 백엔드 핵심 기능 모두 완료**. 그룹 DM(Phase A) 형태의 schema·service·gateway·DTO·WsJwtGuard 신설, 모델 C 기반 unread count, cursor 페이징(tie-breaking 포함), 인앱 알림 broadcast, 메시지 수정/삭제(소프트)까지 가동 중. **답글은 백엔드 동작 중이며 프론트 UI만 남음**. 다음 단계는 baseline migration 정리(즉시) → Day 7 verify 스크립트 확장 + Day 8 반응 앞당기기 → Day 8~12 프론트엔드 통합.

## 진행 단계

### 완료 (Day 1~6)

- [x] **Day 1**: 설계 결정 — 그룹 형태(A→B), ID 전략(UUID), 수정/삭제 정책, 읽음 모델(C)
- [x] **Day 2 오전**: schema 초안 작성 + 팀원 1차 검토
- [x] **Day 2 오후**: 검토 피드백 반영 schema v2, 인증 인터페이스 명세 v2
- [x] **Day 2 마무리 1**: API 명세 작성 (`05-api-spec.md`)
- [x] **Day 2 마무리 2**: 인앱 알림 Phase A 포함 결정 + 모든 문서에 반영
- [x] **Day 2 종료**: 팀원 합의 사항 확정 + access 1h/refresh 30d 채택
- [x] **Day 3**: schema DB 동기화(db push), shared/types/chat.ts 갱신, WsJwtGuard 신설, 기본 REST 엔드포인트 (POST/GET 채팅방, GET 메시지)
- [x] **Day 4**: chat.gateway.ts 보안 패치 (`@UseGuards(WsJwtGuard)` + 수동 verify 이중 안전망), conversation:join/leave, message:send/read, dual broadcast (방 + 사용자 글로벌)
- [x] **Day 5**: cursor 페이징 Pattern A (base64url + tie-breaking), Pattern B unread count 최적화, Pattern C 자동 읽음 처리, WsAllExceptionFilter, scripts/verify 자동화 75/75 통과
- [x] **Day 6**: message:edit / message:delete (소프트), PATCH/DELETE REST 엔드포인트, edit-message.dto.ts
- [x] **Day 7 (압축)**: baseline migration 생성, 답글 verify (20/20), 반응 백엔드 + verify (28/28). Day 8 작업 모두 완료
- [x] **Day 8**: useSocket 훅 + useNotifications + onConnect 콜백 + 채팅 타입 동기화
- [x] **Day 9**: SocketProvider Context + ToastContainer + Header unread 빨간 점 + chat/page 실데이터 연동
- [x] **Day 10**: 채팅방 화면 5단위 — 초기 로드, 낙관적 UI, 수정/삭제, 답글/반응, 무한 스크롤 + 자동 스크롤 가드
- [x] **Day 11**: 사용자 검증 라운드 + 발견 이슈 패치 (api 인터셉터, NewChatModal, SocketProvider token tracking, /login 배선, 표시명/답글 인용 sync/자동 읽음)
- [x] **Day 12**: 1000 메시지 페이징 성능 측정 (cursor 비율 0.33×) + 재연결 자동화 (12/12) + 전체 회귀 **135/135** ← **현재 여기**

### 진행 중 / 예정 (Day 13)

- [ ] **Day 13**: 데모 준비 — docs 최종 갱신, CLAUDE.md 4.5/5절 갱신, 데모 시나리오 리허설, Phase B 이연 항목 정리
- [ ] **Day 9**: useSocket 훅 갱신 (auth 핸드셰이크, 토큰 만료 시 refresh, 글로벌 알림 리스너)
- [ ] **Day 10**: 채팅방 목록 페이지 (unreadCount 뱃지, 사이드바 빨간 점, 무한 스크롤)
- [ ] **Day 11**: 채팅방 화면 (메시지 페이징·낙관적 UI·답글 UI·편집/삭제 컨텍스트 메뉴·반응 피커·다른 방 메시지 토스트)
- [ ] **Day 12**: 통합 테스트 + 버그 수정 (E2E 시나리오, 인앱 알림 시나리오, 만료 토큰, 재연결 동기화, 1000건 페이징 성능)
- [ ] **Day 13**: 데모 준비 (문서 최종 갱신, CLAUDE.md 4.5절·5절 업데이트, 데모 시나리오 리허설)

## 오늘의 작업 (Day 8 — 프론트엔드 통합 시작)

Day 7 압축으로 1.5일 여유 확보 → Day 8부터 useSocket 훅 작업 시작 (원래 Day 9).

1. **useSocket 훅 갱신**
   - `auth: { token }` 핸드셰이크 적용
   - `sendMessage`에서 `senderId` 인자 제거 (서버가 토큰에서 추출)
   - Socket 이벤트 타입 (`SocketEvents`) 적용
   - 토큰 만료 시 refresh + 재연결 로직 (인증 모듈 refresh 작업 진행 중이면 mock 인터페이스로)
2. **글로벌 알림 리스너**
   - 사용자별 `user:<userId>` room의 `notification:newMessage` 수신
   - 토스트 트리거·사이드바 unreadCount 갱신 핵
3. **재연결 시나리오 점검**
   - 의도적 끊김 후 메시지 누락 여부 확인 (REST `?cursor=`로 catch-up)

## 보류 중인 외부 의존성

- [ ] **인증**: `jwt.strategy.ts:12` `'fallback_secret'` 폴백 제거 — 운영 배포 전 필수
- [ ] **인증**: refresh token 시스템 도입 — Phase A에 포함하기로 했으나 인증 담당자 작업 일정 미정. DM 모듈은 access 검증만 가정하고 진행 가능

## 알아야 할 최근 결정

- **모델 C 채택** — 메시지 readBy 배열 → ChatRoomMember.lastReadMessageId 단일 컬럼 (적용 완료)
- **UUID 통일** — 기존 모코지 DB와 일관 (적용 완료)
- **소프트 삭제 + 답글** — deletedAt + parentId 자기참조 (적용 완료)
- **토큰 정책** — access 1시간 + refresh 30일 (인증 모듈 측 작업 대기)
- **WsJwtGuard 신설** — DM 담당이 만들었고 위치는 `auth/guards/` (적용 완료, 이중 안전망)
- **@@map 컨벤션 유지** — 기존 모델과 일관 (적용 완료)
- **인앱 알림 Phase A 포함** — unreadCount 뱃지 + 다른 방 메시지 토스트. 백엔드 broadcast 완료, 프론트 UI는 Day 10~11
- **Cursor Pattern A** — base64url 인코딩 + (createdAt, id) tie-breaking (적용 완료)
- **테스트 전략** — Postman 수동 테스트 → `scripts/verify/` 자동화로 대체. Day 7 답글, Day 8 반응 모두 verify 확장 필수

자세한 결정 근거는 [`01-decisions.md`](./01-decisions.md) 참고.

## 닫힌 보안 결함

| 결함 | 상태 | 비고 |
|---|---|---|
| WebSocket senderId 위조 (`chat.gateway.ts:60`) | ✅ 닫힘 | Day 4 — `WsJwtGuard` + `client.data.user.id` 사용. 클라이언트 senderId 신뢰 제거 |
| `'fallback_secret'` 폴백 (`jwt.strategy.ts:12`) | ⚠️ 미해결 | 인증 담당자 작업. 운영 배포 전 필수 |

## 미해결 기술 부채

| 항목 | 우선순위 | 처리 시점 |
|---|---|---|
| ~~`prisma/migrations/` baseline migration 누락~~ | ~~높음~~ | ✅ Day 7 완료 (`20260504061319_chat_schema_overhaul`) |
| 인증 모듈 fallback_secret 제거 | **높음** | 인증 담당자 일정 |
| 인증 모듈 refresh token 도입 | 중간 | 인증 담당자 일정 |
| ~~답글 verify 스크립트 부재~~ | ~~중간~~ | ✅ Day 7 완료 (test-ws-reply.js, 20/20) |
| ~~반응(reaction) 백엔드 미구현~~ | ~~중간~~ | ✅ Day 7 완료 (test-ws-reaction.js, 28/28) |
| Dockerfile.dev CMD `db push --skip-generate` | 낮음 | Phase B 운영 배포 직전. dev 워크플로우엔 영향 없음 |

## 다음 작업 시작 시 진입 명령

Claude Code 새 세션 시작 시:

```
@CLAUDE.md
@.claude/commit-rules.md
@docs/chat/00-overview.md
@docs/chat/01-decisions.md
@docs/chat/06-13day-plan.md

오늘 Day [N] 작업 시작할게.
```

특정 작업 시 추가 파일:
- schema 적용 → `@docs/chat/02-schema.md @docs/chat/03-shared-types.md`
- 인증 통합 → `@docs/chat/04-auth-interface.md`
- API 구현 → `@docs/chat/05-api-spec.md`

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-03 | 초안 작성 (Day 2 종료 시점) |
| 2026-05-04 | Day 6 완료 반영, Day 7 압축 일정 적용, baseline migration 이슈 명시 |
| 2026-05-04 | Day 7 완료 (압축 1일 안에 baseline migration + 답글 verify + 반응 백엔드 + 반응 verify 모두 처리). 누적 verify 123/123. Day 8부터 프론트 통합 (1.5일 앞당김) |