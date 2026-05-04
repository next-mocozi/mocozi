#!/usr/bin/env bash
# 검증용 두 사용자(Alice, Bob) 등록 + 이메일 인증 + 로그인
# 결과는 scripts/verify/.tokens.json 에 저장됨

set -euo pipefail

API="${API:-http://localhost:8080/api}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/.tokens.json"

# 매 실행마다 새 사용자 생성 (충돌 회피)
TS="$(date +%s)"
ALICE_EMAIL="alice-${TS}@test.ac.kr"
BOB_EMAIL="bob-${TS}@test.ac.kr"
PW="testpw1234!"

# 색상 출력은 stderr로 — 함수 내부에서 echo로 데이터 반환할 때 stdout 오염 방지
green() { printf "\033[32m%s\033[0m\n" "$*" >&2; }
red()   { printf "\033[31m%s\033[0m\n" "$*" >&2; }
blue()  { printf "\033[34m%s\033[0m\n" "$*" >&2; }

# JSON 파싱 — jq 있으면 사용, 없으면 python3 fallback
parse() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r ".$key // empty"
  else
    python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$key',''))"
  fi
}

# 백엔드 살아있는지 확인
blue "▶ 백엔드 헬스체크"
if ! curl -fs "$API/auth/login" -X POST -H 'Content-Type: application/json' \
  -d '{"email":"x","password":"y"}' >/dev/null 2>&1; then
  # 401이 떨어지는 건 정상 (서버는 살아있음). 진짜 죽었으면 connection refused
  if ! curl -s -o /dev/null -w "%{http_code}" "$API/auth/login" -X POST -H 'Content-Type: application/json' -d '{}' | grep -q "^[2-5]"; then
    red "✗ 백엔드(${API})가 응답하지 않습니다. docker compose up 확인하세요."
    exit 1
  fi
fi
green "✓ 백엔드 응답"

register_and_verify() {
  local label="$1" email="$2"
  blue "▶ $label 등록"
  local register_res
  register_res="$(curl -fsS "$API/auth/register" \
    -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PW\",\"name\":\"$label\",\"university\":\"테스트대\",\"department\":\"컴공\",\"grade\":\"3\"}")" \
    || { red "✗ 등록 실패"; echo "$register_res"; exit 1; }

  local user_id token
  user_id="$(echo "$register_res" | parse 'data.userId')"
  token="$(echo "$register_res"   | parse 'data.verificationToken')"
  if [ -z "$user_id" ] || [ -z "$token" ]; then
    # TransformInterceptor가 없을 가능성 — 평면 응답 시도
    user_id="$(echo "$register_res" | parse 'userId')"
    token="$(echo "$register_res"   | parse 'verificationToken')"
  fi

  if [ -z "$user_id" ] || [ -z "$token" ]; then
    red "✗ 등록 응답에서 userId/verificationToken 추출 실패"
    echo "응답 원문: $register_res"
    exit 1
  fi
  green "  userId=$user_id"

  blue "▶ $label 이메일 인증"
  curl -fsS "$API/auth/verify-email?token=$token" >/dev/null || { red "✗ 인증 실패"; exit 1; }
  green "  emailVerified=true"

  blue "▶ $label 로그인"
  local login_res
  login_res="$(curl -fsS "$API/auth/login" \
    -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PW\"}")" \
    || { red "✗ 로그인 실패"; exit 1; }

  local access
  access="$(echo "$login_res" | parse 'data.accessToken')"
  [ -z "$access" ] && access="$(echo "$login_res" | parse 'accessToken')"
  if [ -z "$access" ]; then
    red "✗ 로그인 응답에서 accessToken 추출 실패"
    echo "응답 원문: $login_res"
    exit 1
  fi
  green "  accessToken 획득 (${#access}자)"

  echo "$user_id|$access"
}

ALICE="$(register_and_verify "Alice" "$ALICE_EMAIL")"
BOB="$(register_and_verify "Bob"   "$BOB_EMAIL")"

ALICE_ID="${ALICE%|*}"; ALICE_TOKEN="${ALICE#*|}"
BOB_ID="${BOB%|*}";     BOB_TOKEN="${BOB#*|}"

cat > "$OUT" <<EOF
{
  "alice": { "id": "$ALICE_ID", "token": "$ALICE_TOKEN", "email": "$ALICE_EMAIL" },
  "bob":   { "id": "$BOB_ID",   "token": "$BOB_TOKEN",   "email": "$BOB_EMAIL" },
  "api":   "$API"
}
EOF

green ""
green "✓ 셋업 완료. 토큰은 $OUT 저장됨"
echo ""
echo "다음 단계:"
echo "  ./test-rest.sh        # REST 시나리오"
echo "  npm install && node test-ws.js   # 소켓 시나리오"
