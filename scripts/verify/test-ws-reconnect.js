// Day 12-2 — 재연결 시나리오 자동화 검증
//
// 시나리오:
//  1) Alice + Bob 연결 + 같은 방 conversation:join
//  2) Bob → msg1 → Alice의 socket이 message:new로 수신 ✓
//  3) Alice socket 의도적 disconnect
//  4) Bob → msg2 (Alice 오프라인) → Alice의 dead socket은 수신 안 함
//  5) Alice 새 socket으로 같은 토큰 재연결 + 방 재join
//  6) Bob → msg3 → Alice 새 socket이 수신 ✓
//  7) REST GET /messages — Alice가 catch-up으로 msg2 조회 가능 ✓
//
// 의도된 검증:
//  - socket.disconnect() 후 새 io() 인스턴스로 정상 재연결
//  - 오프라인 동안 broadcast된 메시지는 socket으로 안 옴 (예상 동작)
//  - cursor 기반 REST GET이 catch-up 패턴으로 동작

const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const TOK_PATH = path.join(__dirname, '.tokens.json');
const cfg = JSON.parse(fs.readFileSync(TOK_PATH, 'utf-8'));
const API = cfg.api || 'http://localhost:8080/api';
const SOCKET_URL = API.replace(/\/api$/, '');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { console.log(`  ${c.green('✓')} ${label}${detail ? ' ' + c.dim(detail) : ''}`); pass++; }
  else { console.log(`  ${c.red('✗')} ${label}${detail ? ' ' + c.dim(detail) : ''}`); fail++; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = (socket, event, timeoutMs = 1500) =>
  new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null); }, timeoutMs);
    const h = (payload) => { clearTimeout(t); socket.off(event, h); resolve(payload); };
    socket.on(event, h);
  });
const emitAck = (socket, event, data, timeoutMs = 1500) =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
    socket.emit(event, data, (ack) => { clearTimeout(t); resolve(ack); });
  });

function connect(token) {
  return io(SOCKET_URL, {
    auth: { token },
    reconnection: false, // 수동으로 재연결 흐름 검증
    transports: ['websocket'],
  });
}

async function main() {
  console.log(c.blue('▶ 재연결 시나리오 자동화'));

  // 사전: 새 DIRECT 방 (alice ↔ bob)
  const createRes = await fetch(`${API}/chat/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.alice.token}`,
    },
    body: JSON.stringify({ type: 'DIRECT', memberIds: [cfg.bob.id] }),
  });
  const room = (await createRes.json()).data;
  console.log(c.dim(`  방 ID: ${room.id}`));

  // ============= [1] Alice + Bob 연결 + join =============
  console.log(c.blue('\n[1] Alice + Bob 연결 + 같은 방 join'));
  let alice = connect(cfg.alice.token);
  const bob = connect(cfg.bob.token);
  await Promise.all([
    new Promise((r) => alice.on('connect', r)),
    new Promise((r) => bob.on('connect', r)),
  ]);
  await Promise.all([
    emitAck(alice, 'conversation:join', { roomId: room.id }),
    emitAck(bob, 'conversation:join', { roomId: room.id }),
  ]);
  ok('두 사용자 connected', alice.connected && bob.connected);

  // ============= [2] Bob → msg1 → Alice 수신 =============
  console.log(c.blue('\n[2] Bob → msg1 — Alice의 첫 socket이 message:new 수신'));
  const aliceMsg1 = waitFor(alice, 'message:new', 1500);
  const ack1 = await emitAck(bob, 'message:send', { roomId: room.id, content: 'msg1 (정상 수신)' });
  ok('Bob ack', !!ack1?.id);
  const m1 = await aliceMsg1;
  ok('Alice 첫 socket이 msg1 수신', m1 !== null && m1.content === 'msg1 (정상 수신)');

  // ============= [3] Alice socket 의도적 disconnect =============
  console.log(c.blue('\n[3] Alice socket 의도적 disconnect'));
  alice.disconnect();
  await sleep(100); // disconnect 전파 대기
  ok('Alice socket disconnected', !alice.connected);

  // ============= [4] Bob → msg2 (Alice 오프라인) =============
  console.log(c.blue('\n[4] Bob → msg2 (Alice 오프라인) — Alice의 dead socket은 수신 안 함'));
  // dead socket의 message:new listener를 등록해도 절대 안 와야 함
  let aliceReceivedMsg2 = false;
  alice.on('message:new', () => { aliceReceivedMsg2 = true; });
  const ack2 = await emitAck(bob, 'message:send', { roomId: room.id, content: 'msg2 (오프라인 동안)' });
  ok('Bob ack', !!ack2?.id);
  await sleep(500); // 충분히 기다려도 안 와야 정상
  ok('Alice의 dead socket은 msg2 미수신', !aliceReceivedMsg2);

  // ============= [5] Alice 새 socket으로 재연결 =============
  console.log(c.blue('\n[5] Alice 새 socket — 같은 토큰으로 재연결'));
  alice = connect(cfg.alice.token);
  await new Promise((r) => alice.on('connect', r));
  ok('Alice 새 socket connected', alice.connected);

  // ============= [6] 방 재join — 자동 읽음 처리 =============
  console.log(c.blue('\n[6] 방 재join (서버 socket room 멤버십 재구성)'));
  const joinAck = await emitAck(alice, 'conversation:join', { roomId: room.id });
  ok('재join ack', !joinAck.__timeout);

  // ============= [7] Bob → msg3 — Alice 새 socket이 수신 =============
  console.log(c.blue('\n[7] Bob → msg3 — Alice 새 socket이 수신'));
  const aliceMsg3 = waitFor(alice, 'message:new', 1500);
  const ack3 = await emitAck(bob, 'message:send', { roomId: room.id, content: 'msg3 (재연결 후)' });
  ok('Bob ack', !!ack3?.id);
  const m3 = await aliceMsg3;
  ok('Alice 새 socket이 msg3 수신', m3 !== null && m3.content === 'msg3 (재연결 후)');

  // ============= [8] REST catch-up — msg2 조회 가능 =============
  console.log(c.blue('\n[8] REST GET /messages — Alice가 catch-up으로 msg2 조회'));
  const list = await fetch(`${API}/chat/rooms/${room.id}/messages?limit=50`, {
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  }).then((r) => r.json());
  const msgs = list.data?.messages || [];
  const hasMsg2 = msgs.some((m) => m.content === 'msg2 (오프라인 동안)');
  ok('msg2가 GET 응답에 포함', hasMsg2);
  ok('msg1, msg2, msg3 모두 포함', msgs.length >= 3);

  // 정리
  alice.disconnect();
  bob.disconnect();
  await fetch(`${API}/chat/rooms/${room.id}/messages?limit=1`, { headers: { Authorization: `Bearer ${cfg.alice.token}` } }); // touch
  // cleanup the room
  const { execSync } = require('child_process');
  execSync(
    `docker compose exec -T db psql -U mocozi -d mocozi_db`,
    {
      cwd: path.resolve(__dirname, '..', '..'),
      encoding: 'utf-8',
      input: `DELETE FROM chat_rooms WHERE id = '${room.id}';`,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  console.log('');
  if (fail === 0) {
    console.log(c.green('═══════════════════════════════'));
    console.log(c.green(`  재연결 시나리오 ✓ ${pass}/${pass} 통과`));
    console.log(c.green('═══════════════════════════════'));
    process.exit(0);
  } else {
    console.log(c.red('═══════════════════════════════'));
    console.log(c.red(`  통과 ${pass} / 실패 ${fail}`));
    console.log(c.red('═══════════════════════════════'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n' + c.red('✗ 예외'), e);
  process.exit(2);
});
