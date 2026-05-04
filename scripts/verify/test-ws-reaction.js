// Day 7 후반 (Day 8 앞당김) — 메시지 반응(emoji reaction) 시나리오 검증
//   [1] 반응 추가 (Socket reaction:add) → reaction:added broadcast
//   [2] 같은 (msg, user, emoji) 중복 추가 → exception(Conflict)
//   [3] 다른 emoji는 같은 메시지에 추가 가능
//   [4] 본인 반응 제거 (Socket reaction:remove) → reaction:removed broadcast
//   [5] 멱등 — 없는 반응 제거도 OK
//   [6] REST POST/DELETE 동등 동작 + 409
//   [7] 비-멤버는 반응 추가 불가 (Forbidden)
//   [8] 삭제된 메시지에는 반응 추가 불가 (NotFound)
//   [9] GET /messages 응답에 reactions 배열 포함

const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const TOK_PATH = path.join(__dirname, '.tokens.json');
if (!fs.existsSync(TOK_PATH)) {
  console.error('✗ .tokens.json 없음. ./setup.sh 먼저.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(TOK_PATH, 'utf-8'));
if (!cfg.directRoomId) {
  console.error('✗ directRoomId 없음. ./test-rest.sh 먼저.');
  process.exit(1);
}

const API = cfg.api || 'http://localhost:8080/api';
const SOCKET_URL = API.replace(/\/api$/, '');
const ROOM_ID = cfg.directRoomId;

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  blue:  (s) => `\x1b[34m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
};
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { console.log(`  ${c.green('✓')} ${label}${detail ? ' ' + c.dim(detail) : ''}`); pass++; }
  else      { console.log(`  ${c.red('✗')} ${label}${detail ? ' ' + c.dim(detail) : ''}`); fail++; }
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

async function main() {
  console.log(c.blue(`▶ Socket URL: ${SOCKET_URL}`));
  console.log(c.blue(`▶ DIRECT 방 ID: ${ROOM_ID}\n`));

  const alice = io(SOCKET_URL, { auth: { token: cfg.alice.token }, reconnection: false, transports: ['websocket'] });
  const bob   = io(SOCKET_URL, { auth: { token: cfg.bob.token   }, reconnection: false, transports: ['websocket'] });
  await Promise.all([
    new Promise((r) => alice.on('connect', r)),
    new Promise((r) => bob.on('connect', r)),
  ]);
  await Promise.all([
    emitAck(alice, 'conversation:join', { roomId: ROOM_ID }),
    emitAck(bob,   'conversation:join', { roomId: ROOM_ID }),
  ]);
  console.log(c.green('  ✓ Alice + Bob 방 입장'));

  // 검증 대상 메시지 1개 작성
  const msgAck = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '반응 받을 메시지' });
  const msgId = msgAck.id;
  console.log(c.green(`  ✓ 대상 메시지: ${msgId}`));

  // ============= [1] Bob이 반응 추가 → Alice도 broadcast 수신 =============
  console.log(c.blue('\n[1] Bob이 👍 반응 추가 → Alice도 reaction:added 수신'));
  const aliceAdded = waitFor(alice, 'reaction:added');
  const addAck = await emitAck(bob, 'reaction:add', { messageId: msgId, emoji: '👍' });
  ok('Bob ack 수신', !addAck.__timeout && !!addAck?.id);
  ok('  └ emoji 일치', addAck?.emoji === '👍');
  ok('  └ userId = Bob', addAck?.userId === cfg.bob.id);

  const aliceAddedRes = await aliceAdded;
  ok('Alice가 broadcast 수신', aliceAddedRes !== null);
  if (aliceAddedRes) {
    ok('  └ messageId 일치', aliceAddedRes.messageId === msgId);
    ok('  └ emoji 일치', aliceAddedRes.emoji === '👍');
  }

  // ============= [2] 같은 emoji 중복 추가 → Conflict =============
  console.log(c.blue('\n[2] Bob이 같은 👍 다시 추가 → exception(Conflict)'));
  const bobExc = waitFor(bob, 'exception');
  bob.emit('reaction:add', { messageId: msgId, emoji: '👍' });
  const bobExcRes = await bobExc;
  ok('exception 이벤트', bobExcRes !== null);
  if (bobExcRes) {
    console.log(`    ${c.dim(JSON.stringify(bobExcRes))}`);
    ok('  └ code=Conflict', bobExcRes.code === 'Conflict', `actual=${bobExcRes.code}`);
  }

  // ============= [3] 다른 emoji는 같은 메시지에 추가 가능 =============
  console.log(c.blue('\n[3] Bob이 ❤️로는 같은 메시지에 추가 가능'));
  const addAck2 = await emitAck(bob, 'reaction:add', { messageId: msgId, emoji: '❤️' });
  ok('두 번째 emoji 추가 OK', !addAck2.__timeout && !!addAck2?.id);
  ok('  └ emoji=❤️', addAck2?.emoji === '❤️');

  // ============= [4] 본인 반응 제거 → broadcast =============
  console.log(c.blue('\n[4] Bob이 👍 제거 → Alice도 reaction:removed 수신'));
  const aliceRemoved = waitFor(alice, 'reaction:removed');
  const removeAck = await emitAck(bob, 'reaction:remove', { messageId: msgId, emoji: '👍' });
  ok('제거 ack', !removeAck.__timeout);
  ok('  └ ok=true', removeAck?.ok === true);

  const aliceRemovedRes = await aliceRemoved;
  ok('Alice가 broadcast 수신', aliceRemovedRes !== null);
  if (aliceRemovedRes) {
    ok('  └ emoji=👍', aliceRemovedRes.emoji === '👍');
    ok('  └ userId=Bob', aliceRemovedRes.userId === cfg.bob.id);
  }

  // ============= [5] 멱등 — 없는 반응 제거도 OK =============
  console.log(c.blue('\n[5] 없는 반응 제거 시도 (멱등 — 에러 없이 ack)'));
  const idempotent = await emitAck(bob, 'reaction:remove', { messageId: msgId, emoji: '👍' });
  ok('멱등 제거 ack', !idempotent.__timeout && idempotent?.ok === true);

  // ============= [6] REST POST/DELETE =============
  console.log(c.blue('\n[6] REST 동등 동작 + 중복 시 409'));
  const restPost = await fetch(`${API}/chat/messages/${msgId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.alice.token}` },
    body: JSON.stringify({ emoji: '🎉' }),
  });
  ok('REST POST 201', restPost.status === 201, `actual=${restPost.status}`);

  const restDup = await fetch(`${API}/chat/messages/${msgId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.alice.token}` },
    body: JSON.stringify({ emoji: '🎉' }),
  });
  ok('REST POST 중복 → 409', restDup.status === 409, `actual=${restDup.status}`);

  const restDel = await fetch(`${API}/chat/messages/${msgId}/reactions/${encodeURIComponent('🎉')}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  });
  ok('REST DELETE 204', restDel.status === 204, `actual=${restDel.status}`);

  const restDelIdem = await fetch(`${API}/chat/messages/${msgId}/reactions/${encodeURIComponent('🎉')}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  });
  ok('REST DELETE 멱등 (재호출 204)', restDelIdem.status === 204);

  // ============= [7] 비-멤버 차단 (Charlie) =============
  console.log(c.blue('\n[7] Charlie(비-멤버)가 반응 추가 시도 → Forbidden'));
  if (!cfg.charlie?.token) {
    console.log(c.yellow('  ⚠ Charlie 토큰 없음. test-ws-edge.js 먼저 실행 시 .tokens.json에 캐시됨'));
    console.log(c.yellow('  ⚠ skip (계속 진행)'));
  } else {
    const charlie = io(SOCKET_URL, { auth: { token: cfg.charlie.token }, reconnection: false, transports: ['websocket'] });
    await new Promise((r) => charlie.on('connect', r));
    const exc = waitFor(charlie, 'exception');
    charlie.emit('reaction:add', { messageId: msgId, emoji: '🚫' });
    const excRes = await exc;
    ok('exception 수신', excRes !== null);
    if (excRes) {
      ok('  └ code=Forbidden', excRes.code === 'Forbidden', `actual=${excRes.code}`);
    }
    charlie.disconnect();
  }

  // ============= [8] 삭제된 메시지에는 반응 추가 불가 =============
  console.log(c.blue('\n[8] 삭제된 메시지에 반응 추가 시도 → NotFound'));
  // Alice가 새 메시지 만들고 즉시 삭제
  const tempMsg = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: 'temp for delete' });
  await emitAck(alice, 'message:delete', { messageId: tempMsg.id });

  const exc8 = waitFor(bob, 'exception');
  bob.emit('reaction:add', { messageId: tempMsg.id, emoji: '👍' });
  const exc8Res = await exc8;
  ok('exception 수신', exc8Res !== null);
  if (exc8Res) {
    ok('  └ code=NotFound', exc8Res.code === 'NotFound', `actual=${exc8Res.code}`);
  }

  // ============= [9] GET /messages 응답에 reactions 배열 포함 =============
  console.log(c.blue('\n[9] GET /messages 응답에 reactions 배열 포함'));
  // 다시 새 메시지 + 반응 하나 추가하고 GET
  const m2 = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '반응 검증용' });
  await emitAck(alice, 'reaction:add', { messageId: m2.id, emoji: '🚀' });

  const list = await fetch(`${API}/chat/rooms/${ROOM_ID}/messages?limit=10`, {
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  });
  const listJson = await list.json();
  const m2InList = (listJson.data?.messages || []).find((m) => m.id === m2.id);
  ok('대상 메시지 응답에 존재', !!m2InList);
  if (m2InList) {
    ok('  └ reactions 배열 존재', Array.isArray(m2InList.reactions));
    ok('  └ reactions 길이 1', m2InList.reactions?.length === 1, `len=${m2InList.reactions?.length}`);
    if (m2InList.reactions?.[0]) {
      ok('  └ emoji=🚀', m2InList.reactions[0].emoji === '🚀');
    }
  }

  // 정리
  alice.disconnect();
  bob.disconnect();
  await sleep(200);

  console.log('');
  if (fail === 0) {
    console.log(c.green('═══════════════════════════════'));
    console.log(c.green(`  Day 7후반 (반응) ✓ ${pass}/${pass} 통과`));
    console.log(c.green('═══════════════════════════════'));
    process.exit(0);
  } else {
    console.log(c.red('═══════════════════════════════'));
    console.log(c.red(`  반응 통과 ${pass} / 실패 ${fail}`));
    console.log(c.red('═══════════════════════════════'));
    process.exit(1);
  }
}

main().catch((e) => { console.error('\n' + c.red('✗ 예외'), e); process.exit(2); });
