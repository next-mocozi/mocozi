// Edge Case 시나리오 — test-ws.js가 못 잡는 3가지를 추가 검증
//   1. senderId 위조 시도 무효화 (ValidationPipe whitelist + 토큰 추출)
//   2. 비-멤버 conversation:join 차단 (Forbidden)
//   3. 잘못된 roomId conversation:join (NotFound) + exception 페이로드 형식
//
// 실행:
//   node test-ws-edge.js
//
// Charlie(third user) 가 .tokens.json에 없으면 자동 등록한다.

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

// ---------------------------------------------------------
// Charlie(third user) 등록 — .tokens.json에 없으면 새로 만듦
// ---------------------------------------------------------
async function ensureCharlie() {
  if (cfg.charlie?.token) return cfg.charlie;

  console.log(c.blue('\n▶ Charlie(비-멤버 검증용) 등록'));
  const ts = Date.now();
  const email = `charlie-${ts}@test.ac.kr`;
  const pw = 'testpw1234!';

  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password: pw, name: 'Charlie',
      university: '테스트대', department: '컴공', grade: '3',
    }),
  }).then((r) => r.json());

  const token = reg.data.verificationToken;
  const userId = reg.data.userId;
  if (!token || !userId) throw new Error('Charlie 등록 응답 비정상: ' + JSON.stringify(reg));

  await fetch(`${API}/auth/verify-email?token=${token}`);

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  }).then((r) => r.json());

  const access = login.data.accessToken;
  if (!access) throw new Error('Charlie 로그인 응답 비정상: ' + JSON.stringify(login));

  cfg.charlie = { id: userId, token: access, email };
  fs.writeFileSync(TOK_PATH, JSON.stringify(cfg, null, 2));
  console.log(c.green(`  ✓ Charlie 등록·인증·로그인 (id=${userId.slice(0, 8)}...)`));
  return cfg.charlie;
}

// ---------------------------------------------------------
// 메인
// ---------------------------------------------------------
async function main() {
  console.log(c.blue(`▶ Socket URL: ${SOCKET_URL}`));
  console.log(c.blue(`▶ DIRECT 방 ID (Alice·Bob 멤버): ${ROOM_ID}`));

  const charlie = await ensureCharlie();

  const alice = io(SOCKET_URL, { auth: { token: cfg.alice.token }, reconnection: false, transports: ['websocket'] });
  const charlieSocket = io(SOCKET_URL, { auth: { token: charlie.token }, reconnection: false, transports: ['websocket'] });

  await Promise.all([
    new Promise((r) => alice.on('connect', r)),
    new Promise((r) => charlieSocket.on('connect', r)),
  ]);
  console.log(c.green('\n  ✓ Alice + Charlie 연결'));

  // ============= [1] senderId 위조 시도 → 토큰의 ID로 저장됨 =============
  console.log(c.blue('\n[1] senderId 위조 시도 — 페이로드에 가짜 senderId 끼워넣어도 토큰 ID로 저장됨'));

  // Alice는 일단 방에 입장 (안 그러면 다른 검증 흐려짐)
  await emitAck(alice, 'conversation:join', { roomId: ROOM_ID });

  const FAKE_ID = 'fake-' + Math.random().toString(36).slice(2);
  // 가짜 senderId만 끼워넣고 정상 필드는 그대로. parentId는 보내지 않음 (보내면 service 검증에 걸려 BadRequest)
  const sendAck = await emitAck(alice, 'message:send', {
    roomId: ROOM_ID,
    content: 'forgery attempt',
    senderId: FAKE_ID,        // ← whitelist 가 강제로 stripping. 그 후 토큰의 Alice ID 사용
  });
  ok('ack 수신 (위조 시도가 거부되지 않고 통과)', !sendAck.__timeout && !!sendAck?.id,
     `id=${sendAck?.id}`);
  ok('저장된 message.senderId === Alice의 토큰 ID', sendAck?.senderId === cfg.alice.id,
     `expected=${cfg.alice.id} actual=${sendAck?.senderId}`);
  ok('저장된 message.senderId !== fake', sendAck?.senderId !== FAKE_ID);

  // ============= [2] 비-멤버 conversation:join → Forbidden =============
  console.log(c.blue('\n[2] Charlie(비-멤버)가 Alice·Bob의 방 입장 시도 → exception(Forbidden)'));

  const charlieExceptionPromise = waitFor(charlieSocket, 'exception');
  // ack를 기다리지 않음 — exception 이벤트가 응답
  charlieSocket.emit('conversation:join', { roomId: ROOM_ID });

  const ex2 = await charlieExceptionPromise;
  ok('exception 이벤트 수신', ex2 !== null);
  if (ex2) {
    console.log(`    ${c.dim(JSON.stringify(ex2))}`);
    ok('  └ code=Forbidden', ex2.code === 'Forbidden', `actual=${ex2.code}`);
    ok('  └ message 포함', typeof ex2.message === 'string' && ex2.message.length > 0);
    ok('  └ payload에 원래 요청 포함', ex2.payload?.roomId === ROOM_ID,
       `actual=${JSON.stringify(ex2.payload)}`);
  }

  // ============= [3] 잘못된 roomId conversation:join → NotFound + 페이로드 형식 =============
  console.log(c.blue('\n[3] 존재하지 않는 roomId → exception(NotFound) + 페이로드 형식'));

  const charlieExceptionPromise2 = waitFor(charlieSocket, 'exception');
  charlieSocket.emit('conversation:join', { roomId: '00000000-0000-0000-0000-000000000000' });

  const ex3 = await charlieExceptionPromise2;
  ok('exception 이벤트 수신', ex3 !== null);
  if (ex3) {
    console.log(`    ${c.dim(JSON.stringify(ex3))}`);
    ok('  └ code=NotFound', ex3.code === 'NotFound', `actual=${ex3.code}`);
    ok('  └ { code, message, payload } 형식',
       typeof ex3.code === 'string' && typeof ex3.message === 'string' && 'payload' in ex3);
  }

  // ============= [4] BadRequest — 필수 필드 누락 =============
  console.log(c.blue('\n[4] roomId 없이 conversation:join → exception(BadRequest 또는 그에 준하는)'));
  const charlieExceptionPromise3 = waitFor(charlieSocket, 'exception');
  charlieSocket.emit('conversation:join', {});
  const ex4 = await charlieExceptionPromise3;
  ok('exception 이벤트 수신', ex4 !== null);
  if (ex4) {
    console.log(`    ${c.dim(JSON.stringify(ex4))}`);
    ok('  └ payload 명시', 'payload' in ex4);
    // gateway가 WsException으로 직접 던지므로 code는 WsError 또는 식별자 매핑
    ok('  └ code 존재', typeof ex4.code === 'string' && ex4.code.length > 0);
  }

  // ============= 정리 =============
  alice.disconnect();
  charlieSocket.disconnect();
  await sleep(200);

  console.log('');
  if (fail === 0) {
    console.log(c.green('═══════════════════════════════'));
    console.log(c.green(`  Edge Case ✓ ${pass}/${pass} 통과`));
    console.log(c.green('═══════════════════════════════'));
    process.exit(0);
  } else {
    console.log(c.red('═══════════════════════════════'));
    console.log(c.red(`  Edge Case 통과 ${pass} / 실패 ${fail}`));
    console.log(c.red('═══════════════════════════════'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n' + c.red('✗ 예외'), e);
  process.exit(2);
});
