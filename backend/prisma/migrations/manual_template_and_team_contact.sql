-- =====================================================
-- 채팅 양식 시스템 schema 수동 적용
-- Supabase SQL Editor에서 실행
-- (Railway의 prisma db push가 Supabase pooler에서 hang/skip 되는 케이스 우회)
-- =====================================================

-- 1) MessageContext enum
DO $$ BEGIN
  CREATE TYPE "MessageContext" AS ENUM (
    'RECRUIT_INDIVIDUAL',
    'RECRUIT_TEAM',
    'PORTFOLIO_COFFEE_CHAT',
    'PORTFOLIO_FRIENDSHIP',
    'PORTFOLIO_INQUIRY',
    'PORTFOLIO_COLLAB',
    'PORTFOLIO_PRAISE',
    'COMMUNITY_PRIVATE_NOTE',
    'RANDOM_MATCH'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) ApplicationContactType enum
DO $$ BEGIN
  CREATE TYPE "ApplicationContactType" AS ENUM ('LEADER', 'MEMBER', 'TEAM_CHAT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3) teams 테이블에 contact 컬럼 추가
ALTER TABLE "teams"
  ADD COLUMN IF NOT EXISTS "applicationContactType" "ApplicationContactType" NOT NULL DEFAULT 'LEADER',
  ADD COLUMN IF NOT EXISTS "applicationContactUserId" TEXT;

-- 4) teams ↔ users (applicationContactUserId) FK
DO $$ BEGIN
  ALTER TABLE "teams"
    ADD CONSTRAINT "teams_applicationContactUserId_fkey"
    FOREIGN KEY ("applicationContactUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5) user_message_templates 테이블
CREATE TABLE IF NOT EXISTS "user_message_templates" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "context"   "MessageContext" NOT NULL,
  "content"   TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_message_templates_pkey" PRIMARY KEY ("id")
);

-- 6) (userId, context) UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS "user_message_templates_userId_context_key"
  ON "user_message_templates"("userId", "context");

-- 7) userId 인덱스
CREATE INDEX IF NOT EXISTS "user_message_templates_userId_idx"
  ON "user_message_templates"("userId");

-- 8) user_message_templates ↔ users FK (CASCADE)
DO $$ BEGIN
  ALTER TABLE "user_message_templates"
    ADD CONSTRAINT "user_message_templates_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 검증
-- =====================================================
-- SELECT * FROM "user_message_templates" LIMIT 1;
-- SELECT "applicationContactType", "applicationContactUserId" FROM "teams" LIMIT 1;
