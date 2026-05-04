// Day 12-1 — 메시지 1000건 페이징 성능 측정
//
// 목적:
//  - cursor-based 페이징의 실측 성능 확인
//  - @@index([roomId, createdAt]) 인덱스 효과 EXPLAIN 검증
//  - 첫 페이지 vs 깊은 페이지의 RT 차이가 거의 없음을 입증 (cursor의 핵심 가치)
//
// 동작:
//  1. .tokens.json에서 alice/bob 토큰
//  2. POST /api/chat/rooms (DIRECT) → 새 room 생성
//  3. docker exec psql 로 1000개 메시지 bulk insert (createdAt 1초 간격)
//  4. ANALYZE chat_messages — 통계 갱신
//  5. GET /messages?limit=50 으로 모든 페이지 walk + 페이지별 RT 기록
//  6. EXPLAIN ANALYZE 첫 페이지 쿼리 + 깊은 페이지 쿼리
//  7. 결과 markdown 표로 출력
//  8. cleanup: room 삭제 (cascade로 1000 메시지 정리)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TOK_PATH = path.join(__dirname, '.tokens.json');

if (!fs.existsSync(TOK_PATH)) {
  console.error('✗ .tokens.json 없음. ./setup.sh 먼저.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(TOK_PATH, 'utf-8'));
const API = cfg.api || 'http://localhost:8080/api';

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/**
 * SQL을 stdin으로 파이프해서 실행 — 쉘 이스케이프 회피.
 * opts.expanded=true면 EXPLAIN 등의 표 출력을 그대로 보존
 */
function dbExec(sql, opts = {}) {
  const fmt = opts.expanded ? '' : '-A -t';
  return execSync(
    `docker compose exec -T db psql -U mocozi -d mocozi_db ${fmt}`,
    {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
}

async function main() {
  const N = 1000;
  const PAGE = 50;
  console.log(c.blue(`▶ 1000 메시지 페이징 성능 측정 시작`));

  // 1) 새 DIRECT room 생성 (alice → bob)
  console.log(c.blue(`\n[1] DIRECT 방 생성 (alice ↔ bob)`));
  const createRes = await fetch(`${API}/chat/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.alice.token}`,
    },
    body: JSON.stringify({ type: 'DIRECT', memberIds: [cfg.bob.id] }),
  });
  if (!createRes.ok) {
    console.error(c.red(`방 생성 실패: ${createRes.status}`));
    process.exit(1);
  }
  const room = (await createRes.json()).data;
  console.log(c.green(`  방 ID: ${room.id}`));

  // 2) 1000 메시지 bulk insert
  console.log(c.blue(`\n[2] ${N}개 메시지 bulk insert (alice 발신, 1초 간격)`));
  const insertSql = `
    INSERT INTO chat_messages (id, "roomId", "senderId", content, "createdAt")
    SELECT
      gen_random_uuid()::text,
      '${room.id}',
      '${cfg.alice.id}',
      'perf message ' || g,
      NOW() - (${N} - g) * interval '1 second'
    FROM generate_series(1, ${N}) g;
  `;
  const t0 = Date.now();
  dbExec(insertSql);
  console.log(c.green(`  완료 (${Date.now() - t0}ms)`));

  // 3) ANALYZE — 통계 갱신
  console.log(c.blue(`\n[3] ANALYZE chat_messages — 통계 갱신`));
  dbExec('ANALYZE chat_messages;');
  console.log(c.green(`  완료`));

  // 4) 모든 페이지 walk + 페이지별 RT 측정
  console.log(c.blue(`\n[4] cursor 페이지 walk — 페이지별 RT`));
  const pageTimings = [];
  /** 각 페이지 진입 시 사용한 cursor — 깊은 페이지 EXPLAIN용 */
  const cursorsUsed = [];
  let cursor = null;
  let pageNum = 0;
  let totalMessages = 0;

  while (true) {
    cursorsUsed.push(cursor);
    const url = cursor
      ? `${API}/chat/rooms/${room.id}/messages?limit=${PAGE}&cursor=${encodeURIComponent(cursor)}`
      : `${API}/chat/rooms/${room.id}/messages?limit=${PAGE}`;
    const t = Date.now();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.alice.token}` },
    });
    const elapsed = Date.now() - t;
    const body = await res.json();
    pageNum++;
    totalMessages += body.data.messages.length;
    pageTimings.push(elapsed);
    if (!body.data.nextCursor) break;
    cursor = body.data.nextCursor;
  }
  console.log(c.green(`  ${pageNum} 페이지, ${totalMessages} 메시지`));

  // 5) EXPLAIN ANALYZE — 첫 페이지 쿼리
  console.log(c.blue(`\n[5] EXPLAIN ANALYZE — 첫 페이지 쿼리`));
  const explainFirst = dbExec(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM chat_messages WHERE "roomId" = '${room.id}' ORDER BY "createdAt" DESC, id DESC LIMIT ${PAGE};`,
    { expanded: true },
  );

  // 6) EXPLAIN ANALYZE — 마지막 깊은 페이지 쿼리 (cursor 적용)
  // step 4에서 모은 cursor 중 마지막 페이지 직전 cursor를 디코딩해 SQL에 직접 박음
  const deepCursor = cursorsUsed[cursorsUsed.length - 1];
  console.log(c.blue(`\n[6] EXPLAIN ANALYZE — ${pageNum}번째 (마지막) 페이지 cursor 쿼리`));
  const decoded = JSON.parse(Buffer.from(deepCursor, 'base64url').toString());
  const explainDeep = dbExec(
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM chat_messages WHERE "roomId" = '${room.id}' AND ("createdAt" < '${decoded.createdAt}' OR ("createdAt" = '${decoded.createdAt}' AND id < '${decoded.id}')) ORDER BY "createdAt" DESC, id DESC LIMIT ${PAGE};`,
    { expanded: true },
  );

  // 7) cleanup
  console.log(c.blue(`\n[7] 정리 — 방 삭제 (cascade로 ${N} 메시지 정리)`));
  dbExec(`DELETE FROM chat_rooms WHERE id = '${room.id}';`);
  console.log(c.green(`  완료`));
  // 정리 안 됐을 경우 사용자에게 알림 (드물게 외래키 차단 등)
  const remain = dbExec(`SELECT count(*) FROM chat_messages WHERE "roomId" = '${room.id}';`).trim();
  if (remain !== '0') {
    console.log(c.red(`  ⚠ 메시지 ${remain}개 남음 — 수동 정리 필요`));
  }

  // 8) 결과 보고
  const sumRT = pageTimings.reduce((a, b) => a + b, 0);
  const avgRT = sumRT / pageTimings.length;
  const minRT = Math.min(...pageTimings);
  const maxRT = Math.max(...pageTimings);
  const firstPageRT = pageTimings[0];
  const lastPageRT = pageTimings[pageTimings.length - 1];

  console.log(c.green(`\n═══════════════════════════════`));
  console.log(c.green(`  결과 (${N}개 메시지, ${PAGE}개씩 페이징)`));
  console.log(c.green(`═══════════════════════════════`));
  console.log(`  총 ${pageNum} 페이지, ${totalMessages} 메시지 fetch 완료`);
  console.log(`  총 RT:  ${sumRT}ms`);
  console.log(`  평균 RT: ${avgRT.toFixed(1)}ms / 페이지`);
  console.log(`  최소 RT: ${minRT}ms`);
  console.log(`  최대 RT: ${maxRT}ms`);
  console.log(`  첫 페이지 RT:  ${firstPageRT}ms`);
  console.log(`  마지막 페이지 RT: ${lastPageRT}ms`);
  console.log(`  비율(마지막/첫): ${(lastPageRT / firstPageRT).toFixed(2)}배`);
  console.log(c.dim(`\n(cursor 페이징이 효과적이면 마지막 페이지 RT가 첫 페이지 RT와 거의 같아야 함.\n offset 페이징이라면 깊은 페이지일수록 선형 증가 — 1000번째에서 10~20배 차이.)`));

  console.log(c.blue(`\n--- EXPLAIN ANALYZE: 첫 페이지 ---`));
  console.log(explainFirst);
  console.log(c.blue(`--- EXPLAIN ANALYZE: 깊은 페이지 (cursor 적용) ---`));
  console.log(explainDeep);

  // markdown 표로도 출력 (docs 반영용)
  console.log(c.yellow(`\n--- markdown 표 (docs 복붙용) ---`));
  console.log(`| 메시지 수 | 페이지 크기 | 페이지 수 | 평균 RT | 첫 페이지 | 마지막 페이지 | 비율 |`);
  console.log(`|---|---|---|---|---|---|---|`);
  console.log(
    `| ${N} | ${PAGE} | ${pageNum} | ${avgRT.toFixed(1)}ms | ${firstPageRT}ms | ${lastPageRT}ms | ${(lastPageRT / firstPageRT).toFixed(2)}× |`,
  );
}

main().catch((e) => {
  console.error('\n' + c.red('✗ 예외'), e);
  process.exit(2);
});
