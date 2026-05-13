-- User.name → lastName + firstName 분리
-- 기존 name 값은 lastName으로 이동, firstName은 빈 문자열로 초기화

ALTER TABLE "users" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '';

UPDATE "users" SET "lastName" = "name";

ALTER TABLE "users" DROP COLUMN "name";

ALTER TABLE "users" ALTER COLUMN "lastName" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "firstName" DROP DEFAULT;
