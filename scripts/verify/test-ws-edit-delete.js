// Day 6 — 메시지 수정/삭제 시나리오
//   [1] 본인 메시지 수정 (REST PATCH + Socket message:edit)
//   [2] 남의 메시지 수정 시도 → Forbidden
//   [3] 본인 메시지 삭제 (REST DELETE + Socket message:delete)
//   [4] 남의 메시지 삭제 시도 → Forbidden
//   [5] 이미 삭제된 메시지 수정 시도 → NotFound
//   [6] 이미 삭제된 메시지 재삭제 → 멱등 (204)
//   [7] room broadcast — message:edited / message:deleted 양쪽 클라이언트 수신

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

  // 둘 다 방 입장
  await Promise.all([
    emitAck(alice, 'conversation:join', { roomId: ROOM_ID }),
    emitAck(bob,   'conversation:join', { roomId: ROOM_ID }),
  ]);
  console.log(c.green('  ✓ Alice + Bob 연결 + 방 입장'));

  // ============= [1] Alice가 메시지 → Alice가 수정 → Bob도 message:edited 수신 =============
  console.log(c.blue('\n[1] Alice 메시지 → Alice 수정 → Bob도 broadcast 수신'));
  const sendAck = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '원본 내용' });
  ok('메시지 작성 성공', !!sendAck?.id);
  const aliceMsgId = sendAck.id;

  const bobEdited = waitFor(bob, 'message:edited');
  const editAck = await emitAck(alice, 'message:edit', { messageId: aliceMsgId, content: '수정된 내용' });

  ok('Alice edit ack 수신', !editAck.__timeout);
  ok('  └ 수정된 content 반영', editAck?.content === '수정된 내용', `actual=${editAck?.content}`);
  ok('  └ editedAt 설정됨', !!editAck?.editedAt);

  const bobEditedRes = await bobEdited;
  ok('Bob도 message:edited broadcast 수신', bobEditedRes !== null);
  if (bobEditedRes) {
    ok('  └ 같은 messageId', bobEditedRes.id === aliceMsgId);
    ok('  └ Bob도 새 content 받음', bobEditedRes.content === '수정된 내용');
  }

  // ============= [2] Bob이 Alice 메시지 수정 시도 → Forbidden =============
  console.log(c.blue('\n[2] Bob이 Alice 메시지 수정 시도 → exception(Forbidden)'));
  const bobExc = waitFor(bob, 'exception');
  bob.emit('message:edit', { messageId: aliceMsgId, content: '내가 수정함' });
  const bobExcRes = await bobExc;
  ok('exception 이벤트', bobExcRes !== null);
  if (bobExcRes) {
    console.log(`    ${c.dim(JSON.stringify(bobExcRes))}`);
    ok('  └ code=Forbidden', bobExcRes.code === 'Forbidden', `actual=${bobExcRes.code}`);
  }

  // ============= [3] Alice가 메시지 삭제 → Bob도 message:deleted 수신 =============
  console.log(c.blue('\n[3] Alice 메시지 삭제 → Bob도 message:deleted 수신'));
  const bobDeleted = waitFor(bob, 'message:deleted');
  const deleteAck = await emitAck(alice, 'message:delete', { messageId: aliceMsgId });
  ok('Alice delete ack', !deleteAck.__timeout);
  ok('  └ ok=true', deleteAck?.ok === true);
  ok('  └ messageId 일치', deleteAck?.messageId === aliceMsgId);

  const bobDeletedRes = await bobDeleted;
  ok('Bob message:deleted 수신', bobDeletedRes !== null);
  if (bobDeletedRes) {
    ok('  └ messageId 일치', bobDeletedRes.messageId === aliceMsgId);
    ok('  └ roomId 일치', bobDeletedRes.roomId === ROOM_ID);
  }

  // ============= [4] Bob이 (이미 삭제된) Alice 메시지 삭제 시도 → Forbidden =============
  console.log(c.blue('\n[4] Bob이 남의 메시지 삭제 시도 → Forbidden'));
  const bobExc2 = waitFor(bob, 'exception');
  bob.emit('message:delete', { messageId: aliceMsgId });
  const bobExc2Res = await bobExc2;
  ok('exception 이벤트', bobExc2Res !== null);
  if (bobExc2Res) {
    ok('  └ code=Forbidden', bobExc2Res.code === 'Forbidden', `actual=${bobExc2Res.code}`);
  }

  // ============= [5] 이미 삭제된 메시지를 Alice가 수정 시도 → NotFound =============
  console.log(c.blue('\n[5] 삭제된 메시지를 Alice가 수정 시도 → NotFound'));
  const aliceExc = waitFor(alice, 'exception');
  alice.emit('message:edit', { messageId: aliceMsgId, content: '되살리기' });
  const aliceExcRes = await aliceExc;
  ok('exception 이벤트', aliceExcRes !== null);
  if (aliceExcRes) {
    ok('  └ code=NotFound', aliceExcRes.code === 'NotFound', `actual=${aliceExcRes.code}`);
  }

  // ============= [6] 이미 삭제된 메시지 재삭제 (멱등) =============
  console.log(c.blue('\n[6] 이미 삭제된 메시지 재삭제 — 멱등 처리 (에러 없이 ack)'));
  const idempotentAck = await emitAck(alice, 'message:delete', { messageId: aliceMsgId });
  ok('재삭제 ack 수신 (에러 아님)', !idempotentAck.__timeout && idempotentAck?.ok === true);

  // ============= [7] REST PATCH/DELETE 동등 동작 검증 =============
  console.log(c.blue('\n[7] REST PATCH /api/chat/messages/:id 도 동일 동작'));
  const msg2Ack = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: 'REST 수정 대상' });
  const msg2Id = msg2Ack.id;

  const restPatch = await fetch(`${API}/chat/messages/${msg2Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.alice.token}` },
    body: JSON.stringify({ content: 'REST로 수정됨' }),
  });
  ok('PATCH 200', restPatch.status === 200, `actual=${restPatch.status}`);
  const patchBody = await restPatch.json();
  ok('  └ 수정된 content 반환', patchBody.data?.content === 'REST로 수정됨', `actual=${patchBody.data?.content}`);
  ok('  └ editedAt 설정', !!patchBody.data?.editedAt);

  const restDelete = await fetch(`${API}/chat/messages/${msg2Id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  });
  ok('DELETE 204', restDelete.status === 204, `actual=${restDelete.status}`);

  // 본인 아닌 메시지 PATCH → 403
  const msg3Ack = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '남이 못 수정' });
  const restForbidden = await fetch(`${API}/chat/messages/${msg3Ack.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.bob.token}` },
    body: JSON.stringify({ content: 'Bob이 시도' }),
  });
  ok('PATCH 본인 아니면 403', restForbidden.status === 403, `actual=${restForbidden.status}`);

  // 정리
  alice.disconnect();
  bob.disconnect();
  await sleep(200);

  console.log('');
  if (fail === 0) {
    console.log(c.green('═══════════════════════════════'));
    console.log(c.green(`  Day 6 (수정/삭제) ✓ ${pass}/${pass} 통과`));
    console.log(c.green('═══════════════════════════════'));
    process.exit(0);
  } else {
    console.log(c.red('═══════════════════════════════'));
    console.log(c.red(`  Day 6 통과 ${pass} / 실패 ${fail}`));
    console.log(c.red('═══════════════════════════════'));
    process.exit(1);
  }
}

main().catch((e) => { console.error('\n' + c.red('✗ 예외'), e); process.exit(2); });
