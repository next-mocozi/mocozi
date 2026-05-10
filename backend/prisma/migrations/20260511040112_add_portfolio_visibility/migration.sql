-- AlterTable
ALTER TABLE "portfolios" ADD COLUMN     "firstPostAt" TIMESTAMP(3),
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;
