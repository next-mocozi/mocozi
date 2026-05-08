-- =====================================================
-- 채팅방 숨기기 기능 schema 적용
-- Supabase SQL Editor에서 실행 (BEGIN/COMMIT 트랜잭션 권장)
-- =====================================================

BEGIN;

-- chat_room_members에 hiddenAt 컬럼 추가
-- null: 표시 / 값: 목록에서 숨김 (메시지 수신은 정상 — leftAt과 다름)
ALTER TABLE "chat_room_members"
  ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);

COMMIT;

-- =====================================================
-- 검증
-- =====================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'chat_room_members'
-- ORDER BY ordinal_position;
