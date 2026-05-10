-- AlterEnum
ALTER TYPE "PortfolioItemType" ADD VALUE 'STUDY';

-- AlterTable
ALTER TABLE "portfolio_items" ADD COLUMN     "current" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "period" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "thumbnail" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
