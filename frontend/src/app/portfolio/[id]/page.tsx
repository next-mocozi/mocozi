'use client';

import Link from 'next/link';
import { Fragment, use, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  FeaturedStar,
  MAX_FEATURED,
  type PortfolioItem,
} from '../page';
import {
  renderMarkdown,
  DEFAULT_BODY_ORDER,
  BODY_SECTION_LABEL,
  type BodySectionKey,
  type Draft,
} from '../edit/_interview';
import type { ResearchDetail } from '../edit/_research';
import type { StudyDetail } from '../edit/_study';

// TODO: 백엔드 연동 — `GET /api/portfolios/:id` 로 교체
//       (CLAUDE.md §11). 현재는 mock — localStorage 에서 로드.

const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const DETAILS_STORAGE_KEY = 'mock_portfolio_details';
const RESEARCH_DETAILS_KEY = 'mock_research_details';
const STUDY_DETAILS_KEY = 'mock_study_details';

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

/** 포트폴리오 항목 상세 페이지 — 인터뷰 미리보기(SummaryView)와 동일한 양식으로 표시 */
export default function PortfolioItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const itemId = Number(id);
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [details, setDetails] = useState<Draft | null>(null);
  const [research, setResearch] = useState<ResearchDetail | null>(null);
  const [study, setStudy] = useState<StudyDetail | null>(null);
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
    }
    try {
      const raw = localStorage.getItem(RESEARCH_DETAILS_KEY);
      const map: Record<string, ResearchDetail> = raw ? JSON.parse(raw) : {};
      setResearch(map[String(itemId)] ?? null);
    } catch {
      setResearch(null);
    }
    try {
      const raw = localStorage.getItem(STUDY_DETAILS_KEY);
      const map: Record<string, StudyDetail> = raw ? JSON.parse(raw) : {};
      setStudy(map[String(itemId)] ?? null);
    } catch {
      setStudy(null);
    }
    setLoaded(true);
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

  /** 본문 답변을 마크다운으로 렌더 (#·##·**·![](src)·[text](url)·- 목록 지원).
   *  레거시 @[alias] 토큰은 details.assets 풀에서 이미지로 치환 후 마크다운으로 넘김. */
  const renderBody = (
    text: string,
    pool?: { alias: string; dataUrl: string; filename: string }[],
  ): ReactNode => {
    if (!text) return null;
    const expanded = pool
      ? text.replace(/@\[([^\]]+)\]/g, (_, alias) => {
          const a = pool.find((x) => x.alias === alias);
          return a ? `\n\n![${a.filename}](${a.dataUrl})\n\n` : `@[${alias}]`;
        })
      : text;
    return <>{renderMarkdown(expanded)}</>;
  };

  // ─── 미리보기와 동일한 헤더 데이터 ───
  const periodText = item.period?.trim() ?? '';
  const thumbnail = details?.thumbnail || item.thumbnail || '';
  const tagGroups: { label: string; values: string[] }[] = details
    ? [
        { label: '활동', values: details.activityTypes },
        { label: '분야', values: details.fieldTags },
        { label: '프로그램', values: details.toolTags ?? [] },
        { label: '역할', values: details.roles },
      ]
    : [
        ...(item.domain ? [{ label: '도메인', values: [item.domain] }] : []),
        { label: '태그', values: item.tags },
      ];
  const visibleTagGroups = tagGroups.filter((g) => g.values.length > 0);

  // ─── 본문 섹션 순서 (저장된 순서 우선, 누락된 키는 기본 순서로 보충) ───
  // 도메인이 있을 땐 회고를 항상 마지막으로 이동시키고, 도메인을 회고 바로 위에 노출.
  const sectionOrder: BodySectionKey[] = details
    ? (() => {
        const ordered = (
          details.bodySectionOrder ?? DEFAULT_BODY_ORDER
        ).filter((k): k is BodySectionKey => k in BODY_SECTION_LABEL);
        for (const k of DEFAULT_BODY_ORDER) {
          if (!ordered.includes(k)) ordered.push(k);
        }
        if (details.hasDomain) {
          const ri = ordered.indexOf('retro');
          if (ri >= 0) {
            ordered.splice(ri, 1);
            ordered.push('retro');
          }
        }
        return ordered;
      })()
    : [];

  const renderSectionFor = (k: BodySectionKey): ReactNode => {
    if (!details) return null;
    switch (k) {
      case 'motivation':
        return renderBody(details.motivation);
      case 'techChoice':
        return renderBody(details.techChoice);
      case 'architecture':
        return renderBody(
          details.architecture.text,
          details.assets?.filter((a) => a.stepKey === 'architecture'),
        );
      case 'result':
        return renderBody(
          details.result.text,
          details.assets?.filter((a) => a.stepKey === 'result'),
        );
      case 'retro':
        return renderBody(
          details.retro.text,
          details.assets?.filter((a) => a.stepKey === 'retro'),
        );
      case 'contribution':
        return renderBody(details.contribution);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <Link
        href="/portfolio"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← 포트폴리오로
      </Link>

      {/* 미리보기(SummaryView)와 동일한 카드 레이아웃 */}
      <div className="card relative">
        <FeaturedStar featured={!!item.featured} onToggle={toggleFeatured} />

        <div className="space-y-4">
          {/* ── 헤더: 좌측 제목/기간/태그 + 우측 썸네일 ── */}
          <header className="flex items-start gap-5">
            <div className="min-w-0 flex-1 pr-10">
              {(periodText || item.current) && (
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {periodText && <span>{periodText}</span>}
                  {item.current && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      진행중
                    </span>
                  )}
                </div>
              )}
              <h1 className="text-2xl font-bold leading-snug text-gray-900">
                {item.title || '(제목 없음)'}
              </h1>
              {visibleTagGroups.length > 0 && (
                <div className="mt-4 space-y-2">
                  {visibleTagGroups.map((g) => (
                    <div
                      key={g.label}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {g.label}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.values.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-blue-50 px-3 py-1 text-xs leading-relaxed text-blue-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {thumbnail && (
              <div className="shrink-0">
                <div
                  className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                  style={{ width: '11rem', height: '11rem' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnail}
                    alt="대표 이미지"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            )}
          </header>

          {/* ── 본문 섹션 — 미리보기와 동일한 순서/타이틀 ── */}
          {/* details 는 프로젝트 인터뷰 전용이므로 type=project 일 때만 사용.
           *  과거 버그로 연구·스터디 항목에 stale details 가 남아 있어도 무시됨. */}
          {item.type === 'project' && details ? (
            <>
              {(() => {
                const domainNode = details.hasDomain ? (
                  <section>
                    <h2
                      style={{ marginBottom: '0.5rem' }}
                      className="text-sm font-bold text-gray-800"
                    >
                      도메인
                    </h2>
                    <div className="space-y-3 text-sm leading-7 text-gray-700">
                      {details.domainTags.length > 0 && (
                        <p>
                          <span className="font-medium">영역:</span>{' '}
                          {details.domainTags.join(', ')}
                        </p>
                      )}
                      {details.domainExpertise && (
                        <p>
                          <span className="font-medium">전문성:</span>{' '}
                          {details.domainExpertise}
                        </p>
                      )}
                      {details.domainComm && (
                        <p>
                          <span className="font-medium">소통:</span>{' '}
                          {details.domainComm}
                        </p>
                      )}
                      {details.domainLimits && (
                        <p>
                          <span className="font-medium">한계:</span>{' '}
                          {details.domainLimits}
                        </p>
                      )}
                    </div>
                  </section>
                ) : null;
                const hasRetro = sectionOrder.includes('retro');
                return (
                  <>
                    {sectionOrder.map((k) => {
                      const body = renderSectionFor(k);
                      const sectionNode = body ? (
                        <section>
                          <h2
                            style={{ marginBottom: '0.5rem' }}
                            className="text-sm font-bold text-gray-800"
                          >
                            {BODY_SECTION_LABEL[k]}
                          </h2>
                          <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                            {body}
                          </div>
                        </section>
                      ) : null;
                      const before =
                        domainNode && k === 'retro' ? domainNode : null;
                      if (!before && !sectionNode) return null;
                      return (
                        <Fragment key={k}>
                          {before}
                          {sectionNode}
                        </Fragment>
                      );
                    })}
                    {/* 회고 섹션이 아예 없을 경우의 폴백 — 도메인은 그래도 노출 */}
                    {domainNode && !hasRetro && domainNode}
                  </>
                );
              })()}

              {(details.deliverableUrl ||
                details.deliverableFiles.length > 0) && (
                <section>
                  <h2
                    style={{ marginBottom: '0.5rem' }}
                    className="text-sm font-bold text-gray-800"
                  >
                    결과물 / 배포물
                  </h2>
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
                </section>
              )}
            </>
          ) : item.type === 'research' && research ? (
            <ResearchSections d={research} />
          ) : item.type === 'study' && study ? (
            <StudySections d={study} />
          ) : (
            // 그 외 legacy 항목 → 단순 description 표시
            <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
              {item.description}
            </p>
          )}

          {/* 수정 버튼 — 미리보기의 "복사하기" 자리 */}
          <div className="flex justify-end">
            <Link
              href={`/portfolio/edit?id=${item.id}&type=${item.type}`}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
            >
              수정
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────── 섹션 헬퍼: 작성된 필드만 노출 ───────
function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2
        style={{ marginBottom: '0.5rem' }}
        className="text-sm font-bold text-gray-800"
      >
        {title}
      </h2>
      <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
        {children}
      </div>
    </section>
  );
}

function ResearchSections({ d }: { d: ResearchDetail }) {
  return (
    <>
      {d.background.trim() && <Section title="연구 배경">{d.background}</Section>}
      {d.process.trim() && <Section title="연구 과정">{d.process}</Section>}
      {d.limits.trim() && (
        <Section title="한계 / 추후 발전">{d.limits}</Section>
      )}
      {d.hasDomain &&
        (d.domainTags.length > 0 ||
          d.domainExpertise.trim() ||
          d.domainComm.trim() ||
          d.domainLimits.trim()) && (
          <section>
            <h2
              style={{ marginBottom: '0.5rem' }}
              className="text-sm font-bold text-gray-800"
            >
              도메인
            </h2>
            <div className="space-y-3 text-sm leading-7 text-gray-700">
              {d.domainTags.length > 0 && (
                <p>
                  <span className="font-medium">영역:</span>{' '}
                  {d.domainTags.join(', ')}
                </p>
              )}
              {d.domainExpertise.trim() && (
                <p>
                  <span className="font-medium">전문성:</span>{' '}
                  {d.domainExpertise}
                </p>
              )}
              {d.domainComm.trim() && (
                <p>
                  <span className="font-medium">소통:</span> {d.domainComm}
                </p>
              )}
              {d.domainLimits.trim() && (
                <p>
                  <span className="font-medium">한계:</span> {d.domainLimits}
                </p>
              )}
            </div>
          </section>
        )}
      {(d.paperUrl.trim() || d.paperFile) && (
        <section>
          <h2
            style={{ marginBottom: '0.5rem' }}
            className="text-sm font-bold text-gray-800"
          >
            논문
          </h2>
          <div className="space-y-2 text-sm leading-7">
            {d.paperUrl.trim() && (
              <a
                href={d.paperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-blue-600 hover:underline"
              >
                {d.paperUrl}
              </a>
            )}
            {d.paperFile && (
              <a
                href={d.paperFile.dataUrl}
                download={d.paperFile.filename}
                className="block text-gray-700 hover:text-blue-600"
              >
                📎 {d.paperFile.filename}
              </a>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function StudySections({ d }: { d: StudyDetail }) {
  return (
    <>
      {d.motivation.trim() && (
        <Section title="시작한 이유">{d.motivation}</Section>
      )}
      {d.process.trim() && <Section title="진행 과정">{d.process}</Section>}
      {d.learned.trim() && <Section title="배운 점">{d.learned}</Section>}
      {d.improvements.trim() && (
        <Section title="아쉬운 점 / 개선">{d.improvements}</Section>
      )}
      {d.moreToLearn.trim() && (
        <Section title="더 학습하고 싶은 점">{d.moreToLearn}</Section>
      )}
    </>
  );
}
