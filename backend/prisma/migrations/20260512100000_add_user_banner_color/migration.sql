-- Add bannerColor to users (Profile banner gradient selected by user).
-- Schema 에는 commit e16af45 에서 추가됐지만 migration 누락으로 prod DB 미반영.
-- railway 가 새 client 로 SELECT 시점에 P2022 (column does not exist) 발생 →
-- login/refresh 등 모든 user 쿼리 크래시. 이 마이그레이션으로 컬럼 추가.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "bannerColor" TEXT;
