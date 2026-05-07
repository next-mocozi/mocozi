'use client';

// 포트폴리오 항목(프로젝트/연구/스터디/etc) 의 본문 전체를 렌더링하는 공유 컴포넌트.
// items/[itemId]/page.tsx 와 components/portfolio/FeedDetailPanel.tsx 에서 동일한
// 형태로 사용 — "자세히 보기" 별도 페이지 이동 없이 피드 패널에 그대로 노출하기 위함.
//
// 카드(card) 래퍼·즐겨찾기 토글·수정 버튼 등 owner 인터랙션은 호출하는 부모에서 추가.
// 이 컴포넌트는 헤더(제목/기간/태그/썸네일) + 본문 섹션만 렌더한다.

import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { PortfolioItem } from './_lib';
import {
  renderMarkdown,
  DEFAULT_BODY_ORDER,
  BODY_SECTION_LABEL,
  DEFAULT_DOMAIN_SUB_ORDER,
  DOMAIN_SUB_LABEL,
  type BodySectionKey,
  type DomainSubKey,
  type Draft,
} from './edit/_interview';
import type { ResearchDetail } from './edit/_research';
import type { StudyDetail } from './edit/_study';

const DETAILS_STORAGE_KEY = 'mock_portfolio_details';
const RESEARCH_DETAILS_KEY = 'mock_research_details';
const STUDY_DETAILS_KEY = 'mock_study_details';

/** 항목 ID 로 localStorage 에 저장된 상세 데이터 (인터뷰/연구/스터디) 를 한 번에 조회.
 *  본인 게시물에서만 의미가 있고, mock 사용자/타인 게시물에는 항상 null 묶음을 반환. */
export function loadItemDetails(itemId: number): {
  details: Draft | null;
  research: ResearchDetail | null;
  study: StudyDetail | null;
} {
  if (typeof window === 'undefined') {
    return { details: null, research: null, study: null };
  }
  const readMap = <T,>(key: string): Record<string, T> => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Record<string, T>) : {};
    } catch {
      return {};
    }
  };
  const projectMap = readMap<Draft>(DETAILS_STORAGE_KEY);
  const researchMap = readMap<ResearchDetail>(RESEARCH_DETAILS_KEY);
  const studyMap = readMap<StudyDetail>(STUDY_DETAILS_KEY);
  const k = String(itemId);
  return {
    details: projectMap[k] ?? null,
    research: researchMap[k] ?? null,
    study: studyMap[k] ?? null,
  };
}

/** 본문 답변을 마크다운으로 렌더 (#·##·**·![](src)·[text](url)·- 목록 지원).
 *  @[alias] 토큰은 assets 풀에서 lookup — 이미지면 ![](dataUrl), 파일이면 [📎 name](dataUrl) 로 치환.
 *  alias 는 프로젝트 전체에서 유일하므로 stepKey 필터 없이 전체 풀을 넘긴다. */
function renderBody(
  text: string,
  pool?: {
    alias: string;
    dataUrl: string;
    filename: string;
    kind?: 'image' | 'file';
  }[],
): ReactNode {
  if (!text) return null;
  const expanded = pool
    ? text.replace(/@\[([^\]]+)\]/g, (_, alias) => {
        const a = pool.find((x) => x.alias === alias);
        if (!a) return `@[${alias}]`;
        // kind 가 명시되지 않은 레거시 자료는 파일명 확장자로 추정
        const inferredImage =
          a.kind === 'image' ||
          (a.kind === undefined &&
            /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(a.filename));
        return inferredImage
          ? `\n\n![${a.filename}](${a.dataUrl})\n\n`
          : `\n\n[📎 ${a.filename}](${a.dataUrl})\n\n`;
      })
    : text;
  return <>{renderMarkdown(expanded)}</>;
}

export type ItemFullViewProps = {
  item: PortfolioItem;
  details?: Draft | null;
  research?: ResearchDetail | null;
  study?: StudyDetail | null;
  /** 헤더 우측 영역 — items 페이지에서는 FeaturedStar 등을 슬롯으로 주입 */
  headerSlot?: ReactNode;
};

export default function ItemFullView({
  item,
  details,
  research,
  study,
  headerSlot,
}: ItemFullViewProps) {
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

  const sectionOrder: BodySectionKey[] = details
    ? (() => {
        const ordered = (
          details.bodySectionOrder ?? DEFAULT_BODY_ORDER
        ).filter((k): k is BodySectionKey => k in BODY_SECTION_LABEL);
        for (const k of DEFAULT_BODY_ORDER) {
          if (!ordered.includes(k)) ordered.push(k);
        }
        return ordered;
      })()
    : [];

  // alias 는 프로젝트 전체에서 유일하므로 stepKey 필터 없이 전체 풀을 넘긴다.
  const assetPool = details?.assets ?? [];
  const renderSectionFor = (k: BodySectionKey): ReactNode => {
    if (!details) return null;
    switch (k) {
      case 'motivation':
        return renderBody(details.motivation, assetPool);
      case 'techChoice':
        return renderBody(details.techChoice, assetPool);
      case 'architecture':
        return renderBody(details.architecture.text, assetPool);
      case 'result':
        return renderBody(details.result.text, assetPool);
      case 'retro':
        return renderBody(details.retro.text, assetPool);
      case 'contribution':
        return renderBody(details.contribution, assetPool);
    }
  };

  const domainSubValue = (k: DomainSubKey): string => {
    if (!details) return '';
    switch (k) {
      case 'expertise':
        return details.domainExpertise;
      case 'comm':
        return details.domainComm;
      case 'limits':
        return details.domainLimits;
    }
  };

  const domainSubOrder: DomainSubKey[] = details
    ? (() => {
        const ordered = (
          details.domainSubOrder ?? DEFAULT_DOMAIN_SUB_ORDER
        ).filter((k): k is DomainSubKey => k in DOMAIN_SUB_LABEL);
        for (const k of DEFAULT_DOMAIN_SUB_ORDER) {
          if (!ordered.includes(k)) ordered.push(k);
        }
        return ordered;
      })()
    : [];

  return (
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
        {headerSlot}
      </header>

      {/* ── 본문 섹션 ── */}
      {item.type === 'project' && details ? (
        <>
          {sectionOrder.map((k) => {
            const body = renderSectionFor(k);
            if (!body) return null;
            return (
              <Fragment key={k}>
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
              </Fragment>
            );
          })}

          {details.hasDomain && (
            <section className="rounded-xl border border-gray-200 bg-gray-50/40 p-4">
              <h2
                style={{ marginBottom: '0.75rem' }}
                className="text-base font-bold text-gray-900"
              >
                도메인
              </h2>
              {details.domainTags.length > 0 && (
                <p
                  style={{ marginBottom: '0.75rem' }}
                  className="text-sm leading-7 text-gray-700"
                >
                  <span className="font-medium">영역:</span>{' '}
                  {details.domainTags.join(', ')}
                </p>
              )}
              <div className="space-y-3">
                {domainSubOrder.map((k) => {
                  const v = domainSubValue(k);
                  if (!v?.trim()) return null;
                  return (
                    <section key={k}>
                      <h3
                        style={{ marginBottom: '0.5rem' }}
                        className="text-sm font-bold text-gray-800"
                      >
                        {DOMAIN_SUB_LABEL[k]}
                      </h3>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                        {renderBody(v, assetPool)}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          )}

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
        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
          {item.description}
        </p>
      )}
    </div>
  );
}

// ─────── 섹션 헬퍼 ───────
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
