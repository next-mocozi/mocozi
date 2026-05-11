-- Phase 3 — 포트폴리오 부속 메타 (실무경험 / 대외활동 / 외부 링크)
-- 추가만 진행. 기존 테이블/컬럼 0건 변경.

-- CreateTable
CREATE TABLE "portfolio_work_experiences" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "team" TEXT,
    "role" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_work_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_external_activities" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "month" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_external_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_links" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_work_experiences_portfolioId_idx" ON "portfolio_work_experiences"("portfolioId");

-- CreateIndex
CREATE INDEX "portfolio_external_activities_portfolioId_idx" ON "portfolio_external_activities"("portfolioId");

-- CreateIndex
CREATE INDEX "portfolio_links_portfolioId_idx" ON "portfolio_links"("portfolioId");

-- AddForeignKey
ALTER TABLE "portfolio_work_experiences" ADD CONSTRAINT "portfolio_work_experiences_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_external_activities" ADD CONSTRAINT "portfolio_external_activities_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_links" ADD CONSTRAINT "portfolio_links_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
