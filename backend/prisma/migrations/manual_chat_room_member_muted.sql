-- =====================================================
-- 채팅방 알림 끄기(mute) 기능 schema 적용
-- Supabase SQL Editor에서 실행
-- =====================================================

BEGIN;

-- chat_room_members에 mutedAt 컬럼 추가
-- null: 알림 받음 / 값: 알림(토스트) 차단 — 메시지 데이터는 정상 수신
ALTER TABLE "chat_room_members"
  ADD COLUMN IF NOT EXISTS "mutedAt" TIMESTAMP(3);

COMMIT;

-- =====================================================
-- 검증
-- =====================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'chat_room_members' AND column_name = 'mutedAt';
