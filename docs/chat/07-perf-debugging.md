# DM 모듈 — 성능 디버깅 레시피

> 채팅 쿼리가 느려졌다고 의심될 때 사용하는 진단·검증 레시피.
> 코드 명세가 아닌 **운영·디버깅 가이드**.

---

## 1. EXPLAIN ANALYZE로 인덱스 사용 확인

쿼리 성능 의심 시 `EXPLAIN ANALYZE`로 실행 계획을 먼저 본다.

```bash
docker compose exec db psql -U mocozi -d mocozi_db
```

```sql
EXPLAIN ANALYZE
SELECT * FROM chat_messages
WHERE room_id = 'abc-123-...'
  AND created_at < '2026-05-03T10:00:00Z'
ORDER BY created_at DESC
LIMIT 50;
```

### ✅ 정상 출력 패턴

```
Limit  (cost=... rows=50 ...)
  ->  Index Scan Backward using chat_messages_roomId_createdAt_idx on chat_messages
        Index Cond: ((room_id = 'abc-123-...') AND (created_at < '2026-05-03 10:00:00+00'::timestamp))
        ...
Planning Time: 0.X ms
Execution Time: 0.X ms
```

핵심 신호:
- `Index Scan Backward using ...` — 인덱스가 정렬 방향까지 활용됨 (DESC + LIMIT 최적화)
- `Index Cond: ((room_id = ...) AND (created_at < ...))` — equality + range가 인덱스로 처리됨
- `actual rows = 50` — LIMIT만큼만 정확히 반환
- 실행 시간 1ms 이내 (Phase A 데이터 규모에서)

### ❌ 비정상 출력 패턴

| 신호 | 의미 | 대응 |
|---|---|---|
| `Seq Scan` | 인덱스 안 먹는 중 (전체 테이블 풀 스캔) | 인덱스 누락 또는 통계 오래됨 → `ANALYZE chat_messages;` |
| 별도 `Sort` 단계 등장 | 인덱스로 정렬 못 하는 중 | orderBy가 인덱스 컬럼 순서와 불일치. 복합 인덱스 컬럼 순서 검토 |
| `actual rows = 50050` 등 LIMIT 초과 | OFFSET 같은 비효율 패턴 | cursor 페이징 적용 누락. WHERE 절 점검 |
| `BitmapAnd` (단일 인덱스 결합) | 복합 인덱스 부재 신호 — 두 단일 인덱스를 AND로 합쳐서 처리 중 | 복합 인덱스 추가 검토 (단, 비용 ↔ 효과 평가 필요) |

---

## 2. 통계 갱신

PostgreSQL 쿼리 플래너는 테이블 통계 기반으로 인덱스 사용 여부를 결정. 통계가 오래되면 잘못된 계획을 세울 수 있음.

```sql
-- 테이블 통계 갱신
ANALYZE chat_messages;
ANALYZE chat_room_members;

-- 자동 ANALYZE 설정 확인
SHOW autovacuum_analyze_scale_factor;   -- 기본 0.1 (10% 변경 시 자동)
```

대량 INSERT 후엔 수동 `ANALYZE` 권장.

---

## 3. 실측 — 1,000개 메시지 페이징 (Day 12-1 결과)

자동화 스크립트 `scripts/verify/test-perf-pagination.js`로 측정한 실측치.

### 시나리오
- DIRECT 방에 1,000 메시지 bulk insert (alice 발신, createdAt 1초 간격)
- ANALYZE 후 cursor로 모든 페이지 walk (50개씩 → 21 페이지)
- 각 페이지의 HTTP RT 측정
- EXPLAIN ANALYZE 첫 페이지 vs 마지막 페이지 cursor 쿼리

### 결과 표

| 메시지 수 | 페이지 크기 | 페이지 수 | 평균 RT | 첫 페이지 | 마지막 페이지 | 비율 |
|---|---|---|---|---|---|---|
| 1,000 | 50 | 21 | 5.9ms | 9ms | 3ms | **0.33×** |

→ **마지막 페이지가 첫 페이지보다 빠름**. cursor 페이징의 결정적 증거.
   offset 페이징이라면 비율 10~20× 예상 (선형 증가).

### EXPLAIN ANALYZE — 첫 페이지

```
Limit  (cost=0.41..8.74 rows=50 width=188) (actual time=0.075..0.085 rows=50)
  Buffers: shared hit=28
  ->  Incremental Sort  (cost=0.41..333.96 rows=2003 width=188)
        Sort Key: "createdAt" DESC, id DESC
        Presorted Key: "createdAt"
        ->  Index Scan Backward using "chat_messages_roomId_createdAt_idx"
              Index Cond: ("roomId" = '...')
              Buffers: shared hit=19
Planning Time: 0.639 ms
Execution Time: 0.112 ms
```

핵심 신호:
- ✅ `Index Scan Backward` — DESC 정렬을 인덱스 후방 스캔으로 (별도 sort 불필요)
- ✅ `Presorted Key: createdAt` — 인덱스 순서가 ORDER BY와 일치
- ✅ Execution 0.112ms — 1,000건 중 50개 fetch

### EXPLAIN ANALYZE — 마지막 페이지 (cursor 적용)

```
Limit  (cost=20.95..20.96 rows=3) (actual time=0.058..0.059)
  Buffers: shared hit=11
  ->  Sort Key: "createdAt" DESC, id DESC
        ->  Bitmap Heap Scan on chat_messages
              Recheck Cond:
                ("roomId" = '...' AND "createdAt" < '...')
                OR ("roomId" = '...' AND "createdAt" = '...')
              Filter: tie-breaking 조건
              ->  BitmapOr
                    ->  Bitmap Index Scan on "chat_messages_roomId_createdAt_idx"
                    ->  Bitmap Index Scan on "chat_messages_roomId_createdAt_idx"
Execution Time: 0.114 ms
```

핵심 신호:
- ✅ 두 Bitmap Index Scan — cursor의 `OR (lt) AND (eq AND id<)` 분기 모두 인덱스로 처리
- ✅ Execution 0.114ms — 깊은 페이지인데 첫 페이지와 동일한 양의 시간
- ✅ HTTP RT 3ms 중 대부분 네트워크 오버헤드 (DB는 0.1ms)

### 재실행 방법

```bash
cd scripts/verify
npm run test:perf
```

setup.sh로 alice/bob 토큰을 미리 만들어두면 됨.

---

## 4. 인덱스 비용 점검

인덱스가 너무 많아지면 쓰기 지연. 추가 전 영향 평가.

```sql
-- 현재 chat_messages 인덱스 목록
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'chat_messages';

-- 테이블 크기 대비 인덱스 총합
SELECT
  pg_size_pretty(pg_relation_size('chat_messages')) AS table_size,
  pg_size_pretty(pg_indexes_size('chat_messages')) AS indexes_size;
```

가이드라인:
- 인덱스 총 크기가 테이블의 **30~50% 이내**가 정상
- 그 이상이면 자주 안 쓰이는 인덱스 후보 식별 (`pg_stat_user_indexes.idx_scan`이 0인 것)

---

## 5. unread COUNT 쿼리 성능

채팅방 목록 페이지 로드 시 N+1 (방마다 1개 count 쿼리)이 발생. 방이 많은 사용자(50개+)에서 느리면 의심.

### 측정

```sql
-- 단일 방 unread count (멤버 한 명 기준)
EXPLAIN ANALYZE
SELECT COUNT(*) FROM chat_messages
WHERE room_id = '<roomId>'
  AND deleted_at IS NULL
  AND sender_id != '<userId>'
  AND created_at > '<lastReadCreatedAt>';
```

기대값:
- `Index Scan` (`chat_messages_roomId_createdAt_idx`) + `Filter`로 deleted/sender 처리
- 1ms 이내

### 만약 느리다면

옵션 1 — 부분 인덱스 추가 (자주 deleted=null 필터하므로):

```sql
CREATE INDEX idx_chat_messages_active
ON chat_messages (room_id, created_at)
WHERE deleted_at IS NULL;
```

옵션 2 — raw SQL 단일 쿼리로 N+1 회피 (Phase B):

```sql
-- 한 번에 모든 방의 unread count
SELECT
  cr.id,
  COUNT(cm.id) FILTER (
    WHERE cm.deleted_at IS NULL
      AND cm.sender_id != $userId
      AND (lrm.created_at IS NULL OR cm.created_at > lrm.created_at)
  ) AS unread_count
FROM chat_rooms cr
JOIN chat_room_members crm ON crm.room_id = cr.id AND crm.user_id = $userId
LEFT JOIN chat_messages lrm ON lrm.id = crm.last_read_message_id
LEFT JOIN chat_messages cm ON cm.room_id = cr.id
WHERE crm.left_at IS NULL
GROUP BY cr.id;
```

Phase A는 Promise.all 병렬로 충분. 위 raw SQL은 방 수가 100+ 이상으로 늘 때 검토.

---

## 6. 자주 보는 함정

### 함정 1 — `paths`가 도커에서 안 먹음

`backend/tsconfig.json`의 `paths: { "@shared/*": ["../shared/*"] }`는 호스트 실행 전제. Docker 컨테이너는 `./backend`만 마운트하므로 컨테이너 내부에서 `@shared/*` resolve 실패. 백엔드 코드에서 shared 타입을 직접 import하면 빌드 깨짐.

→ 백엔드는 service-local 타입을 정의하고 의미만 shared와 동기화. 추후 docker-compose에 shared 마운트 추가 시 일괄 정리.

### 함정 2 — Prisma Client 캐시

`prisma db push --skip-generate` (Dockerfile.dev CMD)는 DB 스키마만 갱신하고 TypeScript 타입(@prisma/client)은 그대로. schema 변경 후 컴파일 에러 시:

```bash
docker compose exec backend pnpm prisma generate
```

watch 모드가 자동 재컴파일.

### 함정 3 — `lastMessageAt` null 처리

채팅방 목록에서 `lastMessageAt`이 null인 방(메시지 없는 새 방)이 cursor 페이징과 충돌하기 쉬움. 현재 정책: `nulls last`로 끝에 위치, cursor는 null 영역까지 진입하지 않음 (마지막 페이지 도달로 처리). Phase B에서 null 영역도 페이징 필요해지면 별도 cursor 모드 추가.

---

## 7. 재연결·동기화 시나리오 (Day 12-2 자동화)

자동화 스크립트 `scripts/verify/test-ws-reconnect.js`로 12개 assertion 검증됨.

### 시나리오 흐름

```
1. Alice + Bob 모두 socket connect, conversation:join
2. Bob → msg1 → Alice의 첫 socket이 message:new 수신 ✓
3. Alice socket.disconnect() 의도적 종료
4. Bob → msg2 (Alice 오프라인) → Alice의 dead socket 미수신 (정상)
5. Alice 새 io() 인스턴스로 같은 토큰 재연결
6. conversation:join 재발사 (서버 socket room 멤버십 재구성)
7. Bob → msg3 → Alice 새 socket이 수신 ✓
8. REST GET /messages?cursor=... → msg2 catch-up 가능 ✓
```

### 검증된 동작
- ✅ socket.disconnect() 후 새 인스턴스로 정상 재연결
- ✅ 오프라인 동안 broadcast된 메시지는 socket 미수신 (예상 — server엔 retain 큐 없음)
- ✅ 재연결 후 conversation:join 재발사로 room broadcast 재개
- ✅ REST cursor 페이징으로 잃어버린 메시지 catch-up

### 프론트 통합 패턴 (이미 적용됨)

`useSocket.ts`의 `onConnect({ reconnect })` 콜백:
- 첫 연결: `reconnect: false` — 일반 마운트 흐름
- 재연결: `reconnect: true` — catch-up 트리거

`chat/page.tsx`에서 onConnect 시 GET /rooms 재호출 → 사이드바 unreadCount 재동기화.
`chat/[roomId]/page.tsx`에서 conversation:join 재발사 → 자동 읽음 처리 + room broadcast 재구성.

긴 끊김(수 분~) 후엔 사용자가 위로 스크롤해 cursor 페이징으로 옛 메시지 catch-up.

### 재실행
```bash
cd scripts/verify
npm run test:reconnect
```

---

## 8. 참고 문서

- [`02-schema.md`](./02-schema.md) §4 — 인덱스 설계 근거 + 복합 인덱스 컬럼 순서 원칙
- [`05-api-spec.md`](./05-api-spec.md) §3 — Cursor 페이징 (tie-breaking 포함)
- [`01-decisions.md`](./01-decisions.md) §11 — 읽음 처리 시점 정책
