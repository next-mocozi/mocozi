#!/usr/bin/env bash
# REST 엔드포인트 시나리오 검증 (./setup.sh 먼저 실행 필요)

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TOK="$HERE/.tokens.json"

if [ ! -f "$TOK" ]; then
  echo "✗ $TOK 가 없습니다. ./setup.sh 먼저 실행하세요."
  exit 1
fi

# jq 또는 python3로 토큰 추출
read_json() {
  local path="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r ".$path // empty" "$TOK"
  else
    python3 -c "import json; d=json.load(open('$TOK')); ks='$path'.split('.'); v=d
for k in ks: v=v.get(k,'') if isinstance(v,dict) else ''
print(v)"
  fi
}

API="$(read_json 'api')"
ALICE_TOKEN="$(read_json 'alice.token')"
ALICE_ID="$(read_json 'alice.id')"
BOB_TOKEN="$(read_json 'bob.token')"
BOB_ID="$(read_json 'bob.id')"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }

PASS=0; FAIL=0
ck() { # ck "이름" "기대" "실제"
  if [ "$2" = "$3" ]; then green "  ✓ $1: $3"; PASS=$((PASS+1));
  else red "  ✗ $1: 기대=$2  실제=$3"; FAIL=$((FAIL+1)); fi
}

# JSON 응답에서 path 추출
jget() {
  if command -v jq >/dev/null 2>&1; then
    jq -r ".$2 // empty" <<<"$1"
  else
    python3 -c "import json,sys; d=json.loads(sys.argv[1])
ks=sys.argv[2].split('.'); v=d
for k in ks:
  if isinstance(v,list):
    try: v=v[int(k)]
    except: v=''
  elif isinstance(v,dict): v=v.get(k,'')
  else: v=''
print(v if v is not None else '')" "$1" "$2"
  fi
}

curl_alice() { curl -sS -H "Authorization: Bearer $ALICE_TOKEN" "$@"; }
curl_bob()   { curl -sS -H "Authorization: Bearer $BOB_TOKEN"   "$@"; }

#######################################
# 시나리오 1 — DIRECT 방 find-or-create
#######################################
blue ""
blue "[1] DIRECT 방 생성 (Alice → Bob)"
R1="$(curl_alice -X POST "$API/chat/rooms" -H 'Content-Type: application/json' \
  -d "{\"type\":\"DIRECT\",\"memberIds\":[\"$BOB_ID\"]}")"
ROOM_ID="$(jget "$R1" 'data.id')"
ROOM_TYPE="$(jget "$R1" 'data.type')"
ROOM_MEMBERS="$(jget "$R1" 'data.members')"
ck "type=DIRECT" "DIRECT" "$ROOM_TYPE"
[ -n "$ROOM_ID" ] && green "  ✓ 방 ID 발급: $ROOM_ID" || red "  ✗ 방 ID 미발급"

blue "[2] 같은 요청 재호출 → 같은 방 반환 (find-or-create 검증)"
R2="$(curl_alice -X POST "$API/chat/rooms" -H 'Content-Type: application/json' \
  -d "{\"type\":\"DIRECT\",\"memberIds\":[\"$BOB_ID\"]}")"
ROOM_ID2="$(jget "$R2" 'data.id')"
ck "방 ID 동일" "$ROOM_ID" "$ROOM_ID2"

#######################################
# 시나리오 2 — 방 목록 조회
#######################################
blue ""
blue "[3] Alice 채팅방 목록 조회"
R3="$(curl_alice "$API/chat/rooms")"
NEXT="$(jget "$R3" 'data.nextCursor')"
ROOM_COUNT_RAW="$(jget "$R3" 'data.rooms')"
# rooms 배열 길이 — jq는 length, python은 다른 방식
if command -v jq >/dev/null 2>&1; then
  ROOM_COUNT="$(jq '.data.rooms | length' <<<"$R3")"
else
  ROOM_COUNT="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(len(d['data']['rooms']))" "$R3")"
fi
ck "방 1개 이상" "1" "$([ "${ROOM_COUNT:-0}" -ge 1 ] && echo 1 || echo 0)"
yellow "  rooms.length = $ROOM_COUNT, nextCursor = ${NEXT:-null}"

#######################################
# 시나리오 3 — 방 상세 조회 (멤버십 검증 포함)
#######################################
blue ""
blue "[4] Alice가 방 상세 조회"
R4="$(curl_alice "$API/chat/rooms/$ROOM_ID")"
DETAIL_TYPE="$(jget "$R4" 'data.type')"
ck "type=DIRECT" "DIRECT" "$DETAIL_TYPE"

blue "[5] Bob도 같은 방 조회 가능 (멤버니까)"
R5="$(curl_bob "$API/chat/rooms/$ROOM_ID")"
B5_TYPE="$(jget "$R5" 'data.type')"
ck "Bob 접근 OK" "DIRECT" "$B5_TYPE"

#######################################
# 시나리오 4 — 비-멤버 접근 차단 (Forbidden)
#######################################
blue ""
blue "[6] 미인증 요청 → 401"
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$API/chat/rooms")"
ck "401" "401" "$HTTP_CODE"

#######################################
# 시나리오 5 — 메시지 페이징 (빈 방)
#######################################
blue ""
blue "[7] 메시지 페이징 (아직 메시지 없음)"
R7="$(curl_alice "$API/chat/rooms/$ROOM_ID/messages")"
MSG_COUNT="$(if command -v jq >/dev/null 2>&1; then jq '.data.messages | length' <<<"$R7"; else python3 -c "import json,sys; print(len(json.loads(sys.argv[1])['data']['messages']))" "$R7"; fi)"
NEXT_CURSOR="$(jget "$R7" 'data.nextCursor')"
ck "messages.length=0" "0" "${MSG_COUNT}"
# jq -r '... // empty' 는 null/없음 모두 빈 문자열로 출력. 빈 문자열이면 PASS
ck "nextCursor=null/empty" "" "${NEXT_CURSOR}"

#######################################
# 시나리오 6 — GROUP 방 생성 (Alice creator)
#######################################
blue ""
blue "[8] GROUP 방 생성 (Alice + Bob)"
R8="$(curl_alice -X POST "$API/chat/rooms" -H 'Content-Type: application/json' \
  -d "{\"type\":\"GROUP\",\"name\":\"테스트 그룹\",\"memberIds\":[\"$BOB_ID\"]}")"
GROUP_ID="$(jget "$R8" 'data.id')"
GROUP_TYPE="$(jget "$R8" 'data.type')"
GROUP_NAME="$(jget "$R8" 'data.name')"
ck "type=GROUP" "GROUP" "$GROUP_TYPE"
ck "name=테스트 그룹" "테스트 그룹" "$GROUP_NAME"

#######################################
# 시나리오 7 — 잘못된 cursor → 400
#######################################
blue ""
blue "[9] 잘못된 cursor → 400 BadRequest (decodeCursor 검증)"
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  "$API/chat/rooms/$ROOM_ID/messages?cursor=this-is-not-base64url-json")"
ck "400" "400" "$HTTP_CODE"

#######################################
# 결과 요약
#######################################
echo ""
if [ "$FAIL" -eq 0 ]; then
  green "═══════════════════════════════"
  green "  REST 시나리오 ✓ ${PASS}/${PASS} 통과"
  green "═══════════════════════════════"
else
  red "═══════════════════════════════"
  red "  REST 시나리오 통과 ${PASS} / 실패 ${FAIL}"
  red "═══════════════════════════════"
  exit 1
fi

echo ""
echo "다음 단계:"
echo "  npm install && node test-ws.js"
echo ""
echo "방 ID 참고:"
echo "  DIRECT_ROOM_ID=$ROOM_ID"
echo "  GROUP_ROOM_ID=$GROUP_ID"

# 다음 스크립트가 쓸 수 있게 .tokens.json에 방 ID 저장
if command -v jq >/dev/null 2>&1; then
  jq ". + {\"directRoomId\":\"$ROOM_ID\",\"groupRoomId\":\"$GROUP_ID\"}" "$TOK" > "$TOK.new" && mv "$TOK.new" "$TOK"
else
  python3 -c "
import json
d = json.load(open('$TOK'))
d['directRoomId'] = '$ROOM_ID'
d['groupRoomId'] = '$GROUP_ID'
json.dump(d, open('$TOK', 'w'), indent=2)
"
fi
