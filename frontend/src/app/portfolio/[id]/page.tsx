'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  FeaturedStar,
  MAX_FEATURED,
  TYPE_META,
  type PortfolioItem,
} from '../page';
import { renderMarkdown, type Draft } from '../edit/_interview';

// TODO: 백엔드 연동 — `GET /api/portfolios/:id` 로 교체
//       (CLAUDE.md §11). 현재는 mock — localStorage 에서 로드.

const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const DETAILS_STORAGE_KEY = 'mock_portfolio_details';

const DEFAULT_ITEMS: PortfolioItem[] = [
  {
    id: 1,
    type: 'project',
    title: '웹 포트폴리오 사이트',
    description: '개인 포트폴리오 웹사이트를 제작했습니다.',
    period: '2024.01 - 2024.03',
    current: false,
    domain: '웹',
    tags: ['Next.js', 'Tailwind'],
  },
  {
    id: 2,
    type: 'activity',
    title: '오픈소스 컨트리뷰톤',
    description: '오픈소스 프로젝트에 기여한 활동입니다.',
    period: '2024.01 - 현재',
    current: true,
    domain: '오픈소스',
    tags: ['Git', 'TypeScript'],
  },
];

/** 포트폴리오 항목 상세 페이지 — 인터뷰로 작성한 모든 답변을 같은 양식으로 표시 */
export default function PortfolioItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const itemId = Number(id);
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [details, setDetails] = useState<Draft | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : DEFAULT_ITEMS;
      setItem(list.find((it) => it.id === itemId) ?? null);
    } catch {
      setItem(DEFAULT_ITEMS.find((it) => it.id === itemId) ?? null);
    }
    try {
      const raw = localStorage.getItem(DETAILS_STORAGE_KEY);
      const map: Record<string, Draft> = raw ? JSON.parse(raw) : {};
      setDetails(map[String(itemId)] ?? null);
    } catch {
      setDetails(null);
    } finally {
      setLoaded(true);
    }
  }, [itemId]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-gray-400">로딩 중…</p>
      </div>
    );
  }

  /** 별 토글 — items 전체를 다시 저장 (단일 항목 페이지여도 전체 상태 일관성 유지) */
  const toggleFeatured = () => {
    if (!item) return;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : [];
      const willBeFeatured = !item.featured;
      if (willBeFeatured) {
        const featuredCount = list.filter(
          (it) => it.featured && it.type !== 'study',
        ).length;
        if (featuredCount >= MAX_FEATURED) {
          alert(
            `대표 프로젝트는 최대 ${MAX_FEATURED}개까지만 지정할 수 있어요.`,
          );
          return;
        }
      }
      const next = list.map((it) =>
        it.id === itemId ? { ...it, featured: willBeFeatured } : it,
      );
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
      setItem({ ...item, featured: willBeFeatured });
    } catch {
      // 저장 실패 무시
    }
  };

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <Link
          href="/portfolio"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← 포트폴리오로
        </Link>
        <div className="card text-center">
          <p className="text-gray-500">존재하지 않는 항목이에요.</p>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[item.type];

  /** 본문 답변을 마크다운으로 렌더 (#·##·**·![](src)·[text](url)·- 목록 지원).
   *  레거시 @[alias] 토큰은 details.assets 풀에서 이미지로 치환 후 마크다운으로 넘김. */
  const renderBody = (text: string, pool?: { alias: string; dataUrl: string; filename: string }[]): ReactNode => {
    if (!text) return null;
    const expanded = pool
      ? text.replace(/@\[([^\]]+)\]/g, (_, alias) => {
          const a = pool.find((x) => x.alias === alias);
          return a ? `\n\n![${a.filename}](${a.dataUrl})\n\n` : `@[${alias}]`;
        })
      : text;
    return <>{renderMarkdown(expanded)}</>;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Link
        href="/portfolio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 포트폴리오로
      </Link>

      {/* 헤더 카드 — 메타 + 제목 + 태그 */}
      <div className="card relative mb-6">
        <FeaturedStar
          featured={!!item.featured}
          onToggle={toggleFeatured}
        />
        <div className="mb-3 flex flex-wrap items-center gap-2 pr-10">
          <span
            className={`rounded px-2 py-0.5 text-xs ${meta.bg} ${meta.text}`}
          >
            {meta.label}
          </span>
          {item.period && (
            <span className="text-xs text-gray-500">{item.period}</span>
          )}
          {item.current && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              진행중
            </span>
          )}
        </div>

        <h1 className="mb-3 text-2xl font-bold leading-snug">{item.title}</h1>

        {/* 인터뷰로 작성된 경우: 활동/분야/역할/도메인 별로 그룹화해서 표시 */}
        {details ? (
          <TagGroups draft={details} />
        ) : (
          <>
            {item.domain && (
              <p className="mb-3 text-sm text-gray-500">
                도메인 · {item.domain}
              </p>
            )}
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-2 flex justify-end gap-1">
          <Link
            href={`/portfolio/edit?id=${item.id}`}
            className="btn-secondary text-sm"
          >
            수정
          </Link>
        </div>
      </div>

      {/* 인터뷰 답변 카드 — 같은 Q/A 양식으로 표시 */}
      {details ? (
        <div style={{ rowGap: '0.5rem' }} className="card flex flex-col">
          <Section title="문제 정의">
            <Para>{renderBody(details.motivation)}</Para>
          </Section>
          <Section title="기술 스택 선정 배경">
            <Para>{renderBody(details.techChoice)}</Para>
          </Section>
          <Section title="아키텍처 설계 및 과정">
            <Para>
              {renderBody(
                details.architecture.text,
                details.assets?.filter((a) => a.stepKey === 'architecture'),
              )}
            </Para>
          </Section>
          <Section title="결과물">
            <Para>
              {renderBody(
                details.result.text,
                details.assets?.filter((a) => a.stepKey === 'result'),
              )}
            </Para>
          </Section>
          <Section title="회고">
            <Para>
              {renderBody(
                details.retro.text,
                details.assets?.filter((a) => a.stepKey === 'retro'),
              )}
            </Para>
          </Section>
          <Section title="본인 참여 활동">
            <Para>{renderBody(details.contribution)}</Para>
          </Section>

          {details.hasDomain && (
            <Section title="도메인">
              <div className="space-y-3 text-sm leading-7 text-gray-700">
                {details.domainTags.length > 0 && (
                  <p>
                    <span className="font-medium text-gray-900">영역:</span>{' '}
                    {details.domainTags.join(', ')}
                  </p>
                )}
                {details.domainExpertise && (
                  <p>
                    <span className="font-medium text-gray-900">전문성:</span>{' '}
                    {details.domainExpertise}
                  </p>
                )}
                {details.domainComm && (
                  <p>
                    <span className="font-medium text-gray-900">소통:</span>{' '}
                    {details.domainComm}
                  </p>
                )}
                {details.domainLimits && (
                  <p>
                    <span className="font-medium text-gray-900">한계:</span>{' '}
                    {details.domainLimits}
                  </p>
                )}
              </div>
            </Section>
          )}

          {(details.deliverableUrl || details.deliverableFiles.length > 0) && (
            <Section title="결과물 / 배포물">
              <div className="space-y-2 text-sm leading-7">
                {details.deliverableUrl && (
                  <a
                    href={details.deliverableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-blue-600 hover:underline"
                  >
                    {details.deliverableUrl}
                  </a>
                )}
                {details.deliverableFiles.map((f) => (
                  <a
                    key={f.id}
                    href={f.dataUrl}
                    download={f.filename}
                    className="block text-gray-700 hover:text-blue-600"
                  >
                    📎 {f.filename}
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>
      ) : (
        // 인터뷰 details 가 없는 legacy 항목 → 단순 description 표시
        <div className="card">
          <p className="whitespace-pre-wrap leading-7 text-gray-700">
            {item.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────── 보조 컴포넌트 ───────

function Section({ title, children }: { title: string; children: ReactNode }) {
  // 빈 섹션이면 헤딩까지 숨김 — children null 렌더 결과를 한번 검사
  return (
    <section>
      <h2
        style={{ marginBottom: '0.5rem' }}
        className="text-base font-bold leading-snug text-gray-900"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Para({ children }: { children: ReactNode }) {
  // 빈 문자열이면 아예 렌더하지 않음
  // (renderInline 이 빈 input 에 null 반환)
  if (!children) {
    return <p className="text-sm text-gray-400">— 작성되지 않았습니다.</p>;
  }
  return (
    <div className="whitespace-pre-wrap text-sm leading-8 text-gray-700">
      {children}
    </div>
  );
}

function TagGroups({ draft }: { draft: Draft }) {
  const groups: { label: string; tags: string[] }[] = [
    { label: '활동', tags: draft.activityTypes },
    { label: '분야', tags: draft.fieldTags },
    { label: '프로그램', tags: draft.toolTags ?? [] },
    { label: '역할', tags: draft.roles },
  ];
  if (draft.hasDomain && draft.domainTags.length > 0) {
    groups.push({ label: '도메인', tags: draft.domainTags });
  }
  const visible = groups.filter((g) => g.tags.length > 0);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-3">
      {visible.map((g) => (
        <div key={g.label} className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">
            {g.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs leading-relaxed text-blue-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
