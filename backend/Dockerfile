FROM node:24.15.0-alpine

RUN npm install -g pnpm@10.33.2

WORKDIR /app

# 의존성 먼저 (캐시 활용)
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile

# 소스 + Prisma client 생성 + 빌드
COPY . .
RUN pnpm exec prisma generate
RUN pnpm build

# Railway가 PORT 환경변수를 주입 — main.ts가 process.env.PORT 사용 중
EXPOSE 8080

# 시작 시 node 실행만 — schema 동기화는 Supabase SQL Editor에서 수동
# - 옛날: prisma db push로 자동 동기화 → Supabase pooler session mode (15 connection 한도) 초과로 EMAXCONNSESSION 에러
# - 지금: schema 변경 시 backend/prisma/migrations/*.sql을 Supabase SQL Editor에서 수동 실행
# - 이유: dev Dockerfile도 같은 문제로 db push 제거된 바 있음 (commit b6d9a81)
CMD ["sh", "-c", "node dist/main"]
