# Phase B 이연 항목 정책

> Phase A(13일) 동안 의도적으로 미루기로 결정한 항목들의 통합 목록.
> 각 항목은 **이유**, **영향**, **착수 트리거**, **착수 시 해야 할 일**을 명시한다.
> 이 문서는 Phase A 종료 후 Phase B 진입 시 첫 진입점이 된다.
>
> 마지막 갱신: 2026-05-09

---

## 분류 — 카테고리별 우선순위

| 카테고리 | 항목 수 | 평균 부담 | 우선순위 |
|---|---|---|---|
| 🔐 인증/보안 (외부 의존성) | 2 | 외부 일정 | ⭐⭐⭐ 운영 배포 전 필수 |
| 🚀 운영/배포 | 3 | 중 | ⭐⭐ Phase B 초기 |
| 💬 DM 모듈 진화 | 8 | 중·대 | ⭐⭐ 기능 확장 시 |
| 🎨 UX 개선 (작은 작업) | 4 | 작음 | ⭐ 시간 될 때 |
| 🧪 품질/회귀 | 3 | 중 | ⭐ 안정화 시 |

---

## 🔐 인증/보안 — 운영 배포 전 필수

### B-AUTH-1. `jwt.strategy.ts:12`의 `'fallback_secret'` 폴백 제거

| 항목 | 내용 |
|---|---|
| **위치** | `backend/src/auth/strategies/jwt.strategy.ts:12` — `process.env.JWT_SECRET \|\| 'fallback_secret'` |
| **이유** | Phase A 검증 편의 + 인증 담당자 작업 일정 분리. 운영 배포 시 명시적 secret 보장 |
| **영향** | 환경변수 누락 시 토큰 위조 가능 → **운영 배포 전 반드시 처리** |
| **착수 트리거** | 운영 환경 본격 도입 또는 인증 담당자 작업 시점 |
| **착수 시 작업** | 1) `\|\| 'fallback_secret'` 제거, 2) JWT_SECRET 미설정 시 startup fail, 3) 모든 환경(dev/stage/prod)에 강한 secret 명시 |
| **참고** | `.claude/projects/-Users-Kimdonggyun/memory/mocozi_fallback_secret_protected.md` — 자동 정리 작업에서 임의 제거 금지 정책 |

### B-AUTH-2. Refresh Token 시스템 정식 도입

| 항목 | 내용 |
|---|---|
| **현재 상태** | access token만 사용. 만료 1시간. 만료 시 사용자 재로그인 필요 |
| **이유** | DM 모듈은 access 검증만 가정하고 진행. 인증 담당자 작업 일정 미정 |
| **영향** | UX — 1시간 후 자동 로그아웃. 모바일 PWA에서 더 두드러짐 |
| **착수 트리거** | 인증 담당자 작업 완료 |
| **착수 시 작업** | 1) `/api/auth/refresh` 엔드포인트, 2) `useSocket`에 토큰 만료 감지 + 자동 refresh, 3) `lib/api.ts`의 401 분기에서 refresh 시도 (이미 구조 있음) |

---

## 🚀 운영/배포

### B-OPS-1. `prisma migrate deploy`로 전환 (`db push` 폐기)

| 항목 | 내용 |
|---|---|
| **현재 상태** | dev/prod 모두 `prisma db push` 사용. Schema 변경 시 Supabase SQL Editor에서 수동 SQL 실행 |
| **이유** | Phase A는 빠른 iteration 우선. baseline migration은 만들어졌지만 정식 마이그레이션 워크플로우 미운영 |
| **영향** | Schema 변경 추적 어려움, rollback 어려움, 팀원 환경 동기화 부담 |
| **착수 트리거** | 운영 배포 직전 또는 schema 변경 빈도 ↓ 시점 |
| **착수 시 작업** | 1) 모든 schema 변경을 `prisma migrate dev`로 migration 파일 생성, 2) Dockerfile에 `prisma migrate deploy` 호출 (단 Supabase pooler 한도 고려), 3) 수동 SQL 적용 워크플로우 폐기, 4) `manual_*.sql` 파일들 정리 |

### B-OPS-2. Supabase Transaction Mode 검토

| 항목 | 내용 |
|---|---|
| **현재 상태** | Session mode (port 5432, connection 한도 15) + `?connection_limit=5&pool_timeout=20` 적용 |
| **이유** | 무료 plan 제약. 다인 동시 사용 시 한도 도달 위험 |
| **영향** | Connection 한도 초과 시 500 에러 (Phase A 동안 PR #26으로 완화) |
| **착수 트리거** | 동시 사용자 ↑ 또는 EMAXCONNSESSION 재발 |
| **착수 시 작업** | 1) DATABASE_URL을 `:6543/?pgbouncer=true&connection_limit=1`로 변경, 2) Prisma transaction patterns 호환 검증, 3) 일부 prepared statement 영향 검토 |

### B-OPS-3. 진단 로그(`console.info`) production 빌드 제거

| 항목 | 내용 |
|---|---|
| **현재 상태** | `useNotifications.ts`, `useSocket.ts`에 `console.info('[ws] ...')` 출력 — broadcast 도달 진단용 |
| **이유** | Phase A 동안 socket 흐름 디버깅 필요 |
| **영향** | production 빌드에서 콘솔 노이즈 + 미세 성능 |
| **착수 트리거** | 실시간 broadcast 안정화 검증 끝난 후 |
| **착수 시 작업** | `if (process.env.NODE_ENV === 'development')` 가드 또는 logger 추상화 도입 |

---

## 💬 DM 모듈 진화

### B-DM-1. 컨텍스트 의미 재설계 — RECRUIT_INDIVIDUAL vs SCOUT_FROM_TEAM

| 항목 | 내용 |
|---|---|
| **현재 상태** | RECRUIT_INDIVIDUAL = "개인 → 개인 단순 연결". 보내는 사람 프로필 첨부 |
| **이슈** | recruit 페이지의 채팅하기 = 사용자 의도상 "팀 → 인재 영입"이 더 정합. 자기 프로필 첨부는 어색 (사용자 보고) |
| **이유** | 양식 시스템이 컨텍스트 1개로 시작. 두 의미 분리는 schema/data/UI 모두 영향 |
| **착수 트리거** | 사용자 의도 분리 명확히 결정된 후 |
| **착수 시 작업** | 1) `MessageContext` enum에 `SCOUT_FROM_TEAM` 추가 + Supabase SQL `ALTER TYPE`, 2) `template.service.buildDefault('SCOUT_FROM_TEAM', ...)` — 본인 팀 정보(팀명·기획서·모집 직군) 합성, 3) 사용자가 팀에 안 속해있을 때 fallback 정책 결정, 4) recruit 페이지의 "채팅하기" 진입을 SCOUT_FROM_TEAM으로 라우팅 (또는 사용자 선택), 5) attachment 마커 `[[link:team:teamId\|...]]` 처리 |

### B-DM-2. 다른 사람이 사용자를 새 방에 초대 시나리오

| 항목 | 내용 |
|---|---|
| **현재 상태** | RoomList의 `onNewMessage`에서 `idx === -1` 시 무시 (PR #31 결정) |
| **이슈** | Phase B에서 누군가 사용자를 그룹에 추가 시 — 첫 메시지 도착해도 사이드바에 안 보임 |
| **착수 트리거** | 그룹 채팅 초대 기능 도입 시 |
| **착수 시 작업** | 1) backend에 `notification:roomCreated` 같은 신규 이벤트 — 사용자가 새 방의 멤버가 됐을 때 broadcast, 2) RoomList에서 그 이벤트 받아 단일 방 fetch + setRooms (전체 reload X) |

### B-DM-3. 방 폭파(Hard Delete) — Creator 전용

| 항목 | 내용 |
|---|---|
| **현재 상태** | "나가기"(leftAt 갱신) + "숨기기"(hiddenAt) 두 가지. 방 자체 삭제 기능 X |
| **이유** | Phase A는 사용자별 의도 분리에 집중. 방 폭파는 모든 멤버 영향 큼 — 신중 |
| **착수 시 작업** | 1) `DELETE /api/chat/rooms/:id` (creator만), 2) cascade — chat_room_members + chat_messages + reactions 모두 삭제, 3) 모든 멤버에게 `notification:roomDeleted` broadcast, 4) frontend RoomList에서 즉시 제거, 5) 다이얼로그에 "복구 불가" 명시 |

### B-DM-4. 다시 들어가기 (re-invite) — `leftAt = null` 복원

| 항목 | 내용 |
|---|---|
| **현재 상태** | "나가기"는 영구. 다시 들어가려면 schema 직접 update 필요 |
| **착수 트리거** | "친구 다시 추가" 또는 re-invite 흐름 도입 시 |
| **착수 시 작업** | 1) DIRECT 방의 경우 — 양쪽 leftAt 다시 null로 복원, 2) GROUP 방의 경우 — 다른 멤버의 invite 액션 필요, 3) 옛 메시지 보존 여부 정책 결정 |

### B-DM-5. 새 메시지 도착 시 자동 unhide 옵션

| 항목 | 내용 |
|---|---|
| **현재 상태** | hidden 방의 새 메시지 도착해도 hidden 유지 (사용자 의도 존중, PR #25 결정) |
| **대안 패턴** | 인스타 DM처럼 — 의도적 숨김이지만 새 활동 있으면 다시 노출 |
| **착수 시 작업** | 1) ChatRoomMember에 `autoUnhideOnNewMessage` boolean 또는 사용자 설정, 2) hideRoom 시 사용자가 옵션 선택 |

### B-DM-6. 빈 방(메시지 0개) 누적 정리 — Cron 삭제

| 항목 | 내용 |
|---|---|
| **현재 상태** | Phase A에서 frontend RoomList 필터로 시각적으로만 숨김 (양쪽 멤버 동일). DB에는 빈 방이 그대로 누적 (`docs/chat/01-decisions.md` §15 참조). |
| **착수 트리거** | 운영 환경 DB 부담 ↑ 또는 Supabase row 한도 근접 / 분석 쿼리 성능 저하 |
| **이유** | 컨텍스트 진입 후 미발화한 빈 방이 시간 누적되면 ChatRoom row 수 ↑. 시각적으론 안 보이지만 인덱스/쿼리 비용 ↑. |
| **착수 시 작업** | 1) Backend NestJS Cron(`@nestjs/schedule`) 또는 Supabase Edge Function으로 N일(예: 30일) 이상 메시지 0개 방 hard delete, 2) cascade로 ChatRoomMember 같이 삭제, 3) 운영 통계 로깅 (삭제 row 수) |
| **고려사항** | draft localStorage는 클라이언트에 있으니 backend가 모름. 30일+ 빈 방은 사용자도 의도 잃었을 가능성 높아 안전. 더 보수적이면 90일. |
| **연관** | `docs/chat/01-decisions.md` §15 빈 방 자동 숨김 정책 (Phase A 시각 정리), B-DM-3 방 폭파 (다른 의도) |

### B-DM-8. 스카우트 응답 UX — 수락 빠른 응답 칩 + RoomList 미리보기 + 무응답=거절

| 항목 | 내용 |
|---|---|
| **배경** | Phase A에서 recruit 카드의 "스카우트" modal flow를 채팅 시작으로 통합(SCOUT_FROM_TEAM). 받는 사람이 응답을 쉽게 표현할 수 있는 UX 필요. 사용자 의도: "거절은 무응답으로, 수락만 명시 액션". |
| **현재 상태** | 받는 사람이 채팅창 진입 후 자유 텍스트로만 응답 가능. 보내는 사람이 결과 추적할 방법 없음 (이전 `Scout.status` PENDING/ACCEPTED/DECLINED는 폐기 가능성). |
| **착수 시 작업** | 1) **RoomList 미리보기**: 채팅방 카드에 "기획서 보기" / "프로필 보기" 인라인 액션. 받는 사람이 채팅 진입 없이 핵심 정보 확인. 2) **빠른 응답 칩**: 채팅 첫 메시지 수신 시 입력창 위에 `[수락]` 버튼 한 개만. 거절은 별도 액션 없이 무응답 = 거절 (사용자 의도 정합). 3) **자동 응답**: 수락 클릭 시 "수락했습니다!" 정형 메시지 + Scout 트래킹 row(존재 시) ACCEPTED. 4) **무응답 만료**: 7일 무응답이면 보내는 사람 RoomList에 "응답 대기 중 (D+N)" / "응답 시간 만료" 시각 신호. 5) **Scout 모델 처리 결정**: 채팅으로 통합 후 Scout 모델은 (a) 폐기 / (b) 받은 스카우트 통계용 유지 / (c) trackingOnly로 ACCEPTED만 기록. |
| **고려사항** | 수신자가 "수락" 칩이 부담돼서 누르지 않고 무응답으로 두고 싶을 수도 — 채팅 자유 응답이 항상 가능해 칩은 보조 수단. 보내는 사람의 "응답 시간 만료" 표시는 약한 신호 — 강한 표시(채팅방 자동 hide 등)는 사용자 거부 의향을 정확히 안 알아 위험. |
| **연관** | `docs/chat/01-decisions.md` §17 진입 컨텍스트 색 점 (SCOUT_FROM_TEAM 분류), B-DM-1 컨텍스트 의미 재설계 (Phase A에서 통합 완료) |

---

### B-DM-7. 첨부 파일 묶음 정리 — Storage Cron

| 항목 | 내용 |
|---|---|
| **현재 상태** | Phase A 첨부 정책(`docs/chat/01-decisions.md` §16)에서 메시지 deletedAt이어도 storage 파일은 보존 (`hasAttachments` 메시지의 path는 marker에 그대로). sign endpoint가 deletedAt 검증으로 접근만 차단. → storage row 누적 |
| **착수 트리거** | Supabase Storage 용량 한도 근접 / 청구액 ↑ |
| **이유** | 메시지 삭제·방 삭제 후에도 storage 파일이 남으면 시간 누적으로 비용·관리 부담 ↑. 참조 메시지가 모두 deletedAt이거나 30일+ 묻혀있으면 사실상 죽은 파일 |
| **착수 시 작업** | 1) NestJS Cron 또는 Supabase Edge Function으로 다음 조건 파일 hard delete: (a) 모든 참조 메시지가 deletedAt && 삭제 후 30일 경과, OR (b) 참조 메시지 자체가 없음(고아 — 업로드 완료 후 메시지 전송 실패 케이스), 2) backend `StorageService.deleteObject(path)` 일괄 호출, 3) 운영 통계 로깅 |
| **고려사항** | 메시지 content에 path가 inline 마커로 있으므로 storage 파일과 메시지의 관계 추적은 별도 메타 테이블이 더 효율적일 수 있음. Phase B 착수 시 `Attachment` 모델 도입 검토 (messageId + storagePath + createdAt) — 그러면 cron 쿼리도 단순 |
| **연관** | `docs/chat/01-decisions.md` §16 첨부 정책 (Phase A), B-DM-6 빈 방 정리 (유사 패턴) |

---

## 🎨 UX 개선 (작은 작업)

### B-UX-1. NewChatModal 재활용 — 팔로우/친구 시스템

| 항목 | 내용 |
|---|---|
| **현재 상태** | RoomList에서 "+ 새 채팅" 버튼 hide (PR #25). NewChatModal 코드는 보존 |
| **이유** | 빈 검색에서 모르는 사람 DM 안티패턴 |
| **착수 트리거** | 팔로우/친구 시스템 도입 시 |
| **착수 시 작업** | 1) "내 친구 목록"에서 채팅 시작 진입, 2) NewChatModal을 친구 검색용으로 변형 또는 재활용, 3) `SHOW_NEW_CHAT_BUTTON = true` 토글 |

### B-UX-2. Optimistic UI 실패 시 toast 알림

| 항목 | 내용 |
|---|---|
| **현재 상태** | hide/leave/mute 등 실패 시 `console.error`만 |
| **이유** | dev 단계에서 빈도 작음 |
| **착수 시 작업** | 1) Toast 시스템 도입 (또는 latestNotification 같은 패턴), 2) API 실패 시 사용자에게 알림 + 자동 rollback |

### B-UX-3. Draft 영속화 — 30일 TTL cleanup

| 항목 | 내용 |
|---|---|
| **현재 상태** | `chat-draft-${roomId}` localStorage 무한 보존. 사용자 액션으로만 정리 |
| **착수 시 작업** | 1) `{ content, ts }` JSON으로 저장, 2) 마운트 시 prefix 매칭 + 30일 미사용 키 일괄 제거 |

### B-UX-4. Draft 영속화 — `replyTo` / `editDraft` 보존

| 항목 | 내용 |
|---|---|
| **현재 상태** | 본문(draft)만 영속화. replyTo / editDraft는 휘발 |
| **이유** | replyTo는 그 사이 메시지 삭제 위험. editDraft는 사용자 액션 시작점 |
| **착수 시 작업** | 1) replyTo 영속화 시 — mount 시 그 메시지가 여전히 존재 + deletedAt: null인지 확인 후 복원, 2) editDraft 영속화 시 — 같은 메시지 + 작성자 본인 + deletedAt: null 검증 |

---

## 🧪 품질/회귀

### B-QA-1. mute 시나리오 회귀 테스트 추가

| 항목 | 내용 |
|---|---|
| **현재 상태** | `scripts/verify/`에 mute/hide/leave 시나리오 없음. 누적 135 assertion 모두 PR #28 이전 |
| **착수 시 작업** | 1) `test-ws-room-state.js` (가칭) 신규, 2) hide → 토스트 안 옴 검증, 3) mute → 토스트 안 옴 + unreadCount 정상 검증, 4) leave → 메시지 수신 안 됨 검증, 5) ~150 assertion 추가 |

### B-QA-2. Cache invalidation — `client.data.activeRoomIds` (leave 시)

| 항목 | 내용 |
|---|---|
| **현재 상태** | 사용자가 leave한 방의 entry가 socket cache에 잔존 가능 |
| **영향** | 매우 작음. 다음 conversation:join에서 자연 갱신 |
| **착수 시 작업** | leaveRoom service에서 socket 캐시 invalidate (gateway에 hook) |

### B-QA-3. mute 멤버 broadcast 제외 (서버 측 최적화)

| 항목 | 내용 |
|---|---|
| **현재 상태** | backend는 모든 멤버에게 broadcast (mute 무관). 클라이언트 측에서 filter |
| **장점** | unreadCount 등 데이터 정상 동기화 |
| **단점** | 트래픽 측면 비효율 (mute 멤버에게도 push) |
| **착수 트리거** | 트래픽 ↑ 또는 사용자 수 ↑ |
| **착수 시 작업** | 1) `notification:newMessage`는 그대로, 2) `notification:newMessage`에 mute 정보 포함 또는 분리 채널, 3) 트래픽 측정 후 효익 비교 |

---

## 사용 흐름

### Phase B 시작 시
1. 이 문서 읽기 → 카테고리별 우선순위 검토
2. 외부 의존성 항목 (B-AUTH-*) 먼저 — 인증 담당자와 일정 협의
3. 운영 배포 (B-OPS-*) — 보안 점검 후
4. 사용자 가치 큰 항목 (B-DM-*) 선택적으로
5. UX 개선 (B-UX-*) 시간 될 때

### 항목 추가/이동
- 새 발견된 이연 항목은 카테고리 분류해서 추가
- 착수해서 완료한 항목은 항목 자체 삭제 또는 PR 링크 + 완료 표시

### 항목 삭제 기준
- 더 이상 의미 없음 (예: 외부 라이브러리 변경으로 자동 해결)
- 다른 항목으로 통합됨
- Phase A 결정 변경으로 무관해짐

---

## 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-09 | 최초 작성 — Phase A 진행 중 발견된 16개 이연 항목 통합 정리 |
