-- ============================================================
-- 1회성 정리: portfolio_links 중복 행 제거 + 재발 방지 unique 인덱스
-- ============================================================
--
-- [원인]
-- 프로필 수정 페이지(/profile/edit)가 링크 목록을 localStorage 캐시에서
-- 읽어 serverId 가 항상 비어 있었음. 그 탓에 저장(syncLinksToBackend)할 때마다
-- 같은 링크가 update 가 아닌 새 INSERT 로 처리되어, 새로고침·재저장 횟수만큼
-- 같은 URL 의 portfolio_links 행이 누적됐다. 또한 옛 편집 페이지의 "링크 삭제"는
-- localStorage 만 건드려 백엔드 행이 그대로 남았다.
--
-- [코드 수정]
-- 편집 페이지가 백엔드(portfolio.links)를 source of truth 로 읽고 serverId 를
-- 함께 보관하도록 변경 → 신규는 create, 기존은 update, 삭제는 delete 로 정확히
-- 동기화됨. createLink 도 (portfolioId, url) 기준 upsert 로 idempotent 처리.
--
-- [이 스크립트]
-- 위 수정 이전에 이미 쌓인 중복 행을 일괄 정리한다. (portfolioId, url) 당
-- 가장 오래된 1건만 남기고 나머지를 삭제. 동일 ms 에 batch INSERT 된 중복은
-- id 로 tie-break. 이후 unique 인덱스로 동일 중복의 재발을 DB 레벨에서 차단.
--
-- ⚠️ 운영(Supabase): SQL Editor 에서 1회 수동 실행. 로컬: docker exec 로 실행.
-- ============================================================

-- (portfolio_links 컬럼은 Prisma @map 미사용 → DB 에 camelCase 그대로 존재)

-- 1) 중복 행 삭제 — 같은 포트폴리오 내 같은 URL 은 1건만 남긴다.
DELETE FROM portfolio_links a
USING portfolio_links b
WHERE a."portfolioId" = b."portfolioId"
  AND a.url = b.url
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a.id > b.id)
  );

-- 2) 재발 방지 — (portfolioId, url) unique 인덱스.
--    Prisma schema 의 @@unique([portfolioId, url]) 와 동일한 이름을 사용해
--    이후 prisma 가 인덱스를 새로 만들려 하지 않도록 한다.
CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_links_portfolioId_url_key"
  ON portfolio_links ("portfolioId", url);
