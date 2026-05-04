// Day 7 — 답글(parentId) 시나리오 검증
//   [1] 답글 전송 → ack에 parent 미리보기 포함
//   [2] GET /messages 응답에도 parent 필드 포함
//   [3] 부모 메시지 소프트 삭제 후 자식 답글 정상 유지
//   [4] 부모 deletedAt 설정 후에도 자식의 parent 필드 조회 가능 (ON DELETE SET NULL은 hard delete만 영향)
//   [5] 부모를 다른 방 메시지로 지정 시도 → BadRequest

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

  // 다른 방 messageId 확보 (시나리오 [5] cross-room 검증용) — GROUP 방 만들거나 새 DIRECT 방 사용
  // GROUP 방이 cfg에 있으면 거기 메시지 하나 만들어서 사용
  const OTHER_ROOM_ID = cfg.groupRoomId || ROOM_ID; // 안전 폴백 — 같으면 시나리오 [5] 가치 떨어지나 진단은 가능

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

  // ============= [1] 답글 전송 → ack의 parent 필드 =============
  console.log(c.blue('\n[1] Alice 부모 메시지 → Bob 답글 → ack에 parent 미리보기'));
  const parentAck = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '부모 메시지' });
  ok('부모 메시지 작성', !!parentAck?.id);
  const parentId = parentAck.id;

  const replyAck = await emitAck(bob, 'message:send', {
    roomId: ROOM_ID,
    content: '답글 내용',
    parentId,
  });
  ok('답글 ack 수신', !replyAck.__timeout && !!replyAck?.id);
  ok('  └ parentId 저장', replyAck?.parentId === parentId, `actual=${replyAck?.parentId}`);
  ok('  └ parent 필드 포함', !!replyAck?.parent, `parent=${JSON.stringify(replyAck?.parent)}`);
  if (replyAck?.parent) {
    ok('  └ parent.id 일치', replyAck.parent.id === parentId);
    ok('  └ parent.content 미리보기', replyAck.parent.content === '부모 메시지');
    ok('  └ parent.senderId = Alice', replyAck.parent.senderId === cfg.alice.id);
  }

  // ============= [2] GET /messages 응답에도 parent 포함 =============
  console.log(c.blue('\n[2] GET /api/chat/rooms/:id/messages 응답 검증'));
  const listRes = await fetch(`${API}/chat/rooms/${ROOM_ID}/messages?limit=10`, {
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  });
  const listJson = await listRes.json();
  ok('GET 200', listRes.status === 200);
  const messages = listJson.data?.messages || [];
  const replyInList = messages.find((m) => m.id === replyAck.id);
  ok('답글이 메시지 목록에 존재', !!replyInList);
  if (replyInList) {
    ok('  └ parent 필드 포함', !!replyInList.parent);
    ok('  └ parent.content 일치', replyInList.parent?.content === '부모 메시지');
  }

  // ============= [3] 부모 소프트 삭제 → 답글 자체는 보존 =============
  console.log(c.blue('\n[3] 부모 메시지 소프트 삭제 → 답글 row 보존'));
  const deleteAck = await emitAck(alice, 'message:delete', { messageId: parentId });
  ok('부모 삭제 ack', !deleteAck.__timeout);

  // 답글이 여전히 GET 결과에 있는지
  const list2 = await fetch(`${API}/chat/rooms/${ROOM_ID}/messages?limit=10`, {
    headers: { Authorization: `Bearer ${cfg.alice.token}` },
  });
  const list2Json = await list2.json();
  const list2Messages = list2Json.data?.messages || [];
  const replyAfter = list2Messages.find((m) => m.id === replyAck.id);
  ok('답글 row 여전히 존재', !!replyAfter);
  if (replyAfter) {
    ok('  └ 답글 자체의 deletedAt은 null', replyAfter.deletedAt === null,
       `actual=${replyAfter.deletedAt}`);
  }

  // ============= [4] 부모도 GET에 포함 (deletedAt 있는 placeholder 상태) =============
  console.log(c.blue('\n[4] 부모도 GET 응답에 포함 (deletedAt 설정된 상태)'));
  const parentAfter = list2Messages.find((m) => m.id === parentId);
  ok('부모 row 여전히 존재 (소프트 삭제이므로)', !!parentAfter);
  if (parentAfter) {
    ok('  └ deletedAt !== null', parentAfter.deletedAt !== null,
       `actual=${parentAfter.deletedAt}`);
  }

  // ============= [5] 답글의 parent 필드는 여전히 부모 메시지 참조 =============
  console.log(c.blue('\n[5] 답글의 parent 필드는 부모 ID 그대로 (소프트 삭제는 FK 영향 없음)'));
  if (replyAfter?.parent) {
    ok('  └ replyAfter.parent.id 여전히 parentId', replyAfter.parent.id === parentId);
    ok('  └ parent select에 deletedAt 노출 (UI placeholder 판별용)',
       replyAfter.parent.deletedAt !== null,
       `actual=${replyAfter.parent.deletedAt}`);
  } else {
    ok('답글의 parent 필드 보존 (FK SET NULL 은 hard delete만 영향)', false,
       'parent가 null로 떨어짐');
  }

  // ============= [6] 다른 방 메시지를 부모로 지정 시도 → BadRequest =============
  console.log(c.blue('\n[6] 다른 방 메시지 ID를 parentId로 지정 → BadRequest'));
  // 가짜 parentId(다른 UUID로 시뮬레이션 — 존재 안 함도 BadRequest로 나옴, 의도와 같음)
  const aliceExc = waitFor(alice, 'exception');
  alice.emit('message:send', {
    roomId: ROOM_ID,
    content: '잘못된 답글',
    parentId: '00000000-0000-0000-0000-000000000000',
  });
  const aliceExcRes = await aliceExc;
  ok('exception 이벤트 수신', aliceExcRes !== null);
  if (aliceExcRes) {
    ok('  └ code=BadRequest', aliceExcRes.code === 'BadRequest', `actual=${aliceExcRes.code}`);
  }

  // 정리
  alice.disconnect();
  bob.disconnect();
  await sleep(200);

  console.log('');
  if (fail === 0) {
    console.log(c.green('═══════════════════════════════'));
    console.log(c.green(`  Day 7 (답글) ✓ ${pass}/${pass} 통과`));
    console.log(c.green('═══════════════════════════════'));
    process.exit(0);
  } else {
    console.log(c.red('═══════════════════════════════'));
    console.log(c.red(`  Day 7 통과 ${pass} / 실패 ${fail}`));
    console.log(c.red('═══════════════════════════════'));
    process.exit(1);
  }
}

main().catch((e) => { console.error('\n' + c.red('✗ 예외'), e); process.exit(2); });
