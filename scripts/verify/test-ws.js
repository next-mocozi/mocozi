// Socket.IO 시나리오 검증 — Alice + Bob 두 클라이언트로 dual broadcast / 자동 읽음 / unread sync 확인
//
// 사전 준비:
//   1. ./setup.sh    (사용자 등록 + 토큰)
//   2. ./test-rest.sh (방 ID 확보)
//   3. npm install
//
// 실행:
//   node test-ws.js

const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const TOK_PATH = path.join(__dirname, '.tokens.json');
if (!fs.existsSync(TOK_PATH)) {
  console.error('✗ .tokens.json 가 없습니다. ./setup.sh 먼저 실행하세요.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(TOK_PATH, 'utf-8'));
if (!cfg.directRoomId) {
  console.error('✗ directRoomId 가 없습니다. ./test-rest.sh 먼저 실행하세요.');
  process.exit(1);
}

const SOCKET_URL = (cfg.api || 'http://localhost:8080/api').replace(/\/api$/, '');
const ROOM_ID = cfg.directRoomId;

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  blue:  (s) => `\x1b[34m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
};

let pass = 0, fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { console.log(`  ${c.green('✓')} ${label}${detail ? ' ' + c.dim(detail) : ''}`); pass++; }
  else      { console.log(`  ${c.red('✗')} ${label}${detail ? ' ' + c.dim(detail) : ''}`); fail++; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------
// 헬퍼: 이벤트 1회 대기 with timeout
// ---------------------------------------------------------
function waitFor(socket, event, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { socket.off(event, h); resolve(null); }, timeoutMs);
    const h = (payload) => { clearTimeout(t); socket.off(event, h); resolve(payload); };
    socket.on(event, h);
  });
}

// ack 받아오기 (emit + ack 콜백)
function emitAck(socket, event, data, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
    socket.emit(event, data, (ack) => {
      clearTimeout(t);
      resolve(ack);
    });
  });
}

// ---------------------------------------------------------
// 메인
// ---------------------------------------------------------
async function main() {
  console.log(c.blue(`\n▶ Socket URL: ${SOCKET_URL}`));
  console.log(c.blue(`▶ DIRECT 방 ID: ${ROOM_ID}\n`));

  // ============= 시나리오 0: 토큰 없이 연결 → 즉시 disconnect =============
  console.log(c.blue('[0] 토큰 없이 연결 시도 → 즉시 disconnect 되어야 함 (보안 결함 §2-2 검증)'));
  const noToken = io(SOCKET_URL, { auth: {}, reconnection: false, transports: ['websocket'] });
  let disconnected = false;
  noToken.on('disconnect', () => { disconnected = true; });
  await sleep(800);
  ok('토큰 없으면 disconnect', disconnected);
  noToken.disconnect();

  // ============= 시나리오 0-bis: 잘못된 토큰 → disconnect =============
  console.log(c.blue('\n[0b] 잘못된 토큰으로 연결 → disconnect'));
  const badToken = io(SOCKET_URL, { auth: { token: 'not.a.valid.jwt' }, reconnection: false, transports: ['websocket'] });
  let badDisconnected = false;
  badToken.on('disconnect', () => { badDisconnected = true; });
  await sleep(800);
  ok('잘못된 토큰 disconnect', badDisconnected);
  badToken.disconnect();

  // ============= 시나리오 1: Alice + Bob 정상 연결 =============
  console.log(c.blue('\n[1] Alice + Bob 정상 연결'));
  const alice = io(SOCKET_URL, { auth: { token: cfg.alice.token }, reconnection: false, transports: ['websocket'] });
  const bob   = io(SOCKET_URL, { auth: { token: cfg.bob.token   }, reconnection: false, transports: ['websocket'] });
  // Bob의 두 번째 디바이스 (멀티 탭 시뮬레이션)
  const bobTab2 = io(SOCKET_URL, { auth: { token: cfg.bob.token }, reconnection: false, transports: ['websocket'] });

  await Promise.all([
    new Promise((r) => alice.on('connect', r)),
    new Promise((r) => bob.on('connect', r)),
    new Promise((r) => bobTab2.on('connect', r)),
  ]);
  ok('Alice 연결', alice.connected);
  ok('Bob 연결', bob.connected);
  ok('Bob tab2 연결', bobTab2.connected);

  // 모든 클라이언트의 알림 이벤트를 캡처해두기
  const log = (who) => (event) => (payload) => {
    console.log(`    ${c.dim(`<${who}: ${event}>`)} ${JSON.stringify(payload).slice(0, 120)}`);
  };
  for (const ev of ['message:new', 'notification:newMessage', 'notification:unreadCountChanged', 'exception']) {
    alice.on(ev,   log('alice')(ev));
    bob.on(ev,     log('bob')(ev));
    bobTab2.on(ev, log('bobTab2')(ev));
  }

  // ============= 시나리오 2: Alice만 방 입장 (Bob은 글로벌 room만) =============
  console.log(c.blue('\n[2] Alice가 방 입장 (Bob은 입장 안 함 — 글로벌 room만)'));
  const aliceJoinAck = await emitAck(alice, 'conversation:join', { roomId: ROOM_ID });
  ok('Alice join ack 수신', !aliceJoinAck.__timeout);
  console.log(`    ${c.dim(JSON.stringify(aliceJoinAck))}`);

  // ============= 시나리오 3: Alice가 메시지 전송 → dual broadcast 확인 =============
  console.log(c.blue('\n[3] Alice가 메시지 전송 → dual broadcast 검증'));
  // Bob, BobTab2가 받을 이벤트들을 미리 listen
  const bobNewMsg     = waitFor(bob,     'message:new', 1000);          // 방 안 들어왔으니 안 와야 함
  const bobNotif      = waitFor(bob,     'notification:newMessage');     // 와야 함
  const bobTab2Notif  = waitFor(bobTab2, 'notification:newMessage');     // 멀티 탭도 와야 함

  const sendAck = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '안녕 Bob, 이건 첫 메시지' });
  ok('Alice send ack', !sendAck.__timeout && sendAck?.id, sendAck?.id || '');

  const [bobNewMsgRes, bobNotifRes, bobTab2NotifRes] = await Promise.all([bobNewMsg, bobNotif, bobTab2Notif]);
  ok('Bob은 message:new 안 받음 (방 안 들어옴)', bobNewMsgRes === null);
  ok('Bob은 notification:newMessage 받음', bobNotifRes !== null);
  if (bobNotifRes) {
    ok('  └ unreadCount=1', bobNotifRes.unreadCount === 1, `actual=${bobNotifRes.unreadCount}`);
    ok('  └ senderName=Alice', bobNotifRes.senderName === 'Alice', `actual=${bobNotifRes.senderName}`);
  }
  ok('BobTab2도 notification 받음 (글로벌 room broadcast)', bobTab2NotifRes !== null);

  // ============= 시나리오 4: Bob이 방 입장 → 자동 읽음 =============
  console.log(c.blue('\n[4] Bob이 방 입장 → 자동 읽음 (Pattern C) + 멀티 탭 unread 동기화'));
  const bobTab2UnreadCh = waitFor(bobTab2, 'notification:unreadCountChanged');
  const bobJoinAck = await emitAck(bob, 'conversation:join', { roomId: ROOM_ID });
  ok('Bob join ack 수신', !bobJoinAck.__timeout);
  console.log(`    ${c.dim(JSON.stringify(bobJoinAck))}`);
  ok('  └ ack에 unreadCount 포함', bobJoinAck?.unreadCount !== undefined);
  ok('  └ unreadCount=0 (자동 읽음)', bobJoinAck?.unreadCount === 0, `actual=${bobJoinAck?.unreadCount}`);

  const bobTab2UnreadRes = await bobTab2UnreadCh;
  ok('BobTab2 unreadCountChanged 수신 (멀티 디바이스 동기화)', bobTab2UnreadRes !== null);
  if (bobTab2UnreadRes) {
    ok('  └ roomId 일치', bobTab2UnreadRes.roomId === ROOM_ID);
    ok('  └ unreadCount=0', bobTab2UnreadRes.unreadCount === 0);
  }

  // ============= 시나리오 5: Alice가 또 메시지 → Bob은 두 이벤트 모두 받음 =============
  console.log(c.blue('\n[5] Alice가 또 메시지 전송 → Bob은 message:new + notification 둘 다'));
  const bobNewMsg2  = waitFor(bob, 'message:new');
  const bobNotif2   = waitFor(bob, 'notification:newMessage');
  const sendAck2 = await emitAck(alice, 'message:send', { roomId: ROOM_ID, content: '두 번째 메시지' });
  ok('Alice send ack', !sendAck2.__timeout && !!sendAck2?.id);

  const [bobNewMsg2Res, bobNotif2Res] = await Promise.all([bobNewMsg2, bobNotif2]);
  ok('Bob message:new 받음 (방 안에 있음)', bobNewMsg2Res !== null);
  ok('Bob notification:newMessage 받음', bobNotif2Res !== null);
  if (bobNotif2Res) {
    ok('  └ unreadCount=1 (Bob이 새 메시지 안 읽음)', bobNotif2Res.unreadCount === 1, `actual=${bobNotif2Res.unreadCount}`);
  }

  // ============= 시나리오 6: Bob이 message:read → 멀티 탭 unread sync =============
  console.log(c.blue('\n[6] Bob이 message:read → BobTab2 사이드바 즉시 0으로 갱신'));
  const lastMsgId = sendAck2?.id;
  const bobTab2Sync = waitFor(bobTab2, 'notification:unreadCountChanged');
  const readAck = await emitAck(bob, 'message:read', { roomId: ROOM_ID, messageId: lastMsgId });
  ok('Bob read ack', !readAck.__timeout);
  ok('  └ ack에 unreadCount 포함', readAck?.unreadCount !== undefined, `actual=${readAck?.unreadCount}`);

  const bobTab2SyncRes = await bobTab2Sync;
  ok('BobTab2 unreadCountChanged 수신', bobTab2SyncRes !== null);
  if (bobTab2SyncRes) {
    ok('  └ unreadCount=0', bobTab2SyncRes.unreadCount === 0);
  }

  // ============= 시나리오 7: 비-멤버 방 접근 차단 (다른 방을 조작) =============
  console.log(c.blue('\n[7] (skip) 비-멤버 차단 — Alice·Bob 모두 같은 방 멤버라 별도 third user 필요. 후속 검증'));

  // ============= 정리 =============
  alice.disconnect();
  bob.disconnect();
  bobTab2.disconnect();
  await sleep(200);

  // ============= 결과 =============
  console.log('');
  if (fail === 0) {
    console.log(c.green('═══════════════════════════════'));
    console.log(c.green(`  Socket 시나리오 ✓ ${pass}/${pass} 통과`));
    console.log(c.green('═══════════════════════════════'));
    process.exit(0);
  } else {
    console.log(c.red('═══════════════════════════════'));
    console.log(c.red(`  Socket 시나리오 통과 ${pass} / 실패 ${fail}`));
    console.log(c.red('═══════════════════════════════'));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n' + c.red('✗ 예외'), e);
  process.exit(2);
});
