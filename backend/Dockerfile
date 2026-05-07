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

# 시작 시 schema 동기화 + node 실행
# - migrations/ 가 있어도 db push 사용 (팀 워크플로우 일치)
# - --accept-data-loss: 빈 DB나 unique constraint 추가 시 prisma 보수적 abort 우회
CMD ["sh", "-c", "pnpm exec prisma db push --skip-generate --accept-data-loss && node dist/main"]
