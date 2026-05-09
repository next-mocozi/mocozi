'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DownSelect, getMyPortfolioPath, type PortfolioItem } from '../_lib';

// ─────── Storage keys ───────
const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const RESEARCH_DETAILS_STORAGE_KEY = 'mock_research_details';

// ─────── Domain options ───────
const DOMAIN_OPTIONS = ['의료', '금융', '법률', '교육', '기타'];

// ─────── Year/Month options ───────
// 최대 연도는 오늘 연도, 12년치만 노출 (월 드롭다운과 같은 높이로 아래 정렬 유도).
const PERIOD_CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: 12 },
  (_, i) => PERIOD_CURRENT_YEAR - i,
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

// ─────── Types ───────
export type ResearchPaperFile = {
  filename: string;
  dataUrl: string;
};

export type ResearchDetail = {
  topic: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  current: boolean;
  background: string;
  process: string;
  limits: string;
  hasDomain: boolean | null;
  domainTags: string[];
  domainCustom: string;
  domainExpertise: string;
  domainComm: string;
  domainLimits: string;
  paperUrl: string;
  paperFile: ResearchPaperFile | null;
  /** 피드 카드에 노출되는 한 줄 요약 (필수). */
  summary: string;
};

const EMPTY_DETAIL: ResearchDetail = {
  topic: '',
  startYear: '',
  startMonth: '',
  endYear: '',
  endMonth: '',
  current: false,
  background: '',
  process: '',
  limits: '',
  hasDomain: null,
  domainTags: [],
  domainCustom: '',
  domainExpertise: '',
  domainComm: '',
  domainLimits: '',
  paperUrl: '',
  paperFile: null,
  summary: '',
};

// ─────── Helpers ───────
const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const formatPeriod = (d: ResearchDetail): string => {
  if (!d.startYear || !d.startMonth) return '';
  const start = `${d.startYear}.${d.startMonth.padStart(2, '0')}`;
  if (d.current) return `${start} - 현재`;
  if (!d.endYear || !d.endMonth) return start;
  const end = `${d.endYear}.${d.endMonth.padStart(2, '0')}`;
  return `${start} - ${end}`;
};

// ─────── Main component ───────
export default function ResearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = editId !== null && Number.isFinite(editId);

  const [d, setD] = useState<ResearchDetail>(EMPTY_DETAIL);
  const [topicError, setTopicError] = useState('');
  const [periodError, setPeriodError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 시작 > 종료 인지 (년·월 기준) — 둘 다 입력되었고 진행중이 아닐 때만 검사
  const periodInvalid = (() => {
    if (d.current) return false;
    if (!d.startYear || !d.startMonth || !d.endYear || !d.endMonth) return false;
    const s = Number(d.startYear) * 100 + Number(d.startMonth);
    const e = Number(d.endYear) * 100 + Number(d.endMonth);
    return e < s;
  })();

  // 편집 모드: 저장된 답변 로드
  useEffect(() => {
    if (!isEdit || editId === null) return;
    try {
      const raw = localStorage.getItem(RESEARCH_DETAILS_STORAGE_KEY);
      const map: Record<string, ResearchDetail> = raw ? JSON.parse(raw) : {};
      const saved = map[String(editId)];
      if (saved) {
        setD({ ...EMPTY_DETAIL, ...saved });
        return;
      }
      // details 없는 기존 항목 → 제목/기간 등 기본값 복원
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const found = items.find((it) => it.id === editId);
      if (found) {
        setD({
          ...EMPTY_DETAIL,
          topic: found.title,
          paperUrl: found.paperUrl ?? '',
          domainTags: found.domain ? [found.domain] : [],
        });
      }
    } catch {
      // 무시
    }
  }, [isEdit, editId]);

  const update = <K extends keyof ResearchDetail>(
    key: K,
    value: ResearchDetail[K],
  ) => setD((prev) => ({ ...prev, [key]: value }));

  const toggleDomainTag = (tag: string) => {
    setD((prev) => ({
      ...prev,
      domainTags: prev.domainTags.includes(tag)
        ? prev.domainTags.filter((t) => t !== tag)
        : [...prev.domainTags, tag],
    }));
  };

  const addCustomDomain = () => {
    const v = d.domainCustom.trim();
    if (!v) {
      setD((prev) => ({ ...prev, domainCustom: '' }));
      return;
    }
    if (d.domainTags.includes(v)) {
      setD((prev) => ({ ...prev, domainCustom: '' }));
      return;
    }
    setD((prev) => ({
      ...prev,
      domainTags: [...prev.domainTags, v],
      domainCustom: '',
    }));
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      update('paperFile', { filename: file.name, dataUrl });
    } catch {
      // 무시
    }
  };

  const handleSave = () => {
    if (!d.topic.trim()) {
      setTopicError('연구 주제를 입력해주세요.');
      return;
    }
    if (periodInvalid) {
      setPeriodError('종료 날짜는 시작 날짜 이후여야 합니다.');
      return;
    }
    if (!d.summary.trim()) {
      setSummaryError('피드에 노출될 한 줄 요약을 입력해주세요.');
      return;
    }
    const targetId = isEdit && editId !== null ? editId : Date.now();
    const period = formatPeriod(d);
    const item: PortfolioItem = {
      id: targetId,
      type: 'research',
      title: d.topic.trim(),
      description: d.background.trim() || d.process.trim() || '',
      summary: d.summary.trim(),
      period,
      current: d.current,
      domain: d.hasDomain && d.domainTags[0] ? d.domainTags[0] : undefined,
      tags: d.hasDomain ? Array.from(new Set(d.domainTags)).filter(Boolean) : [],
      paperUrl: d.paperUrl.trim() || undefined,
    };
    try {
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const exists = list.some((it) => it.id === targetId);
      const next = exists
        ? list.map((it) => (it.id === targetId ? { ...it, ...item } : it))
        : [...list, item];
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));

      const detailsRaw = localStorage.getItem(RESEARCH_DETAILS_STORAGE_KEY);
      const map: Record<string, ResearchDetail> = detailsRaw
        ? JSON.parse(detailsRaw)
        : {};
      map[String(targetId)] = d;
      localStorage.setItem(RESEARCH_DETAILS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // 무시
    }
    router.push(getMyPortfolioPath());
  };

  const handleDelete = () => {
    if (!isEdit || editId === null) return;
    if (!confirm('이 연구 항목을 삭제하시겠어요?')) return;
    try {
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const next = list.filter((it) => it.id !== editId);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
      const detailsRaw = localStorage.getItem(RESEARCH_DETAILS_STORAGE_KEY);
      if (detailsRaw) {
        const map: Record<string, ResearchDetail> = JSON.parse(detailsRaw);
        delete map[String(editId)];
        localStorage.setItem(
          RESEARCH_DETAILS_STORAGE_KEY,
          JSON.stringify(map),
        );
      }
    } catch {
      // 무시
    }
    router.push(getMyPortfolioPath());
  };

  // ─────── Styling shared classes ───────
  const labelClass = 'block text-sm font-medium text-gray-700';
  const subHintClass = 'text-xs text-gray-400';
  const inputClass =
    'w-full rounded-lg border border-gray-200 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
  const textareaClass =
    'w-full resize-none rounded-lg border border-gray-200 px-4 py-2 text-sm leading-7 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
  const chipBase =
    'rounded-full border px-3 py-1.5 text-xs leading-relaxed transition-all';
  const chipOff =
    'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50';
  const chipOn = 'border-blue-500 bg-blue-500 text-white';

  return (
    <div className="mx-auto max-w-2xl px-6 py-2 sm:px-10 sm:py-2">
      {/* 헤더 */}
      <div
        style={{ marginTop: '1rem', marginBottom: '1.25rem' }}
        className="flex items-center justify-between"
      >
        <div>
          <Link
            href="/portfolio"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            ← 포트폴리오로
          </Link>
          <h1 className="text-2xl font-bold">
            {isEdit ? '연구 수정' : '새 연구'}
          </h1>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm sm:p-6">
        <h2
          style={{ marginBottom: '1rem' }}
          className="text-xl font-bold text-gray-900"
        >
          연구 {isEdit ? '수정' : '추가'}
        </h2>

        {/* 1. 연구 주제 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>
            1. 연구 주제 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={d.topic}
            onChange={(e) => {
              update('topic', e.target.value);
              if (topicError) setTopicError('');
            }}
            placeholder="예: 흉부 X-ray 기반 폐 질환 자동 탐지"
            className={inputClass}
          />
          {topicError && (
            <p className="mt-1 text-xs text-red-500">{topicError}</p>
          )}
        </div>

        {/* 기간 */}
        <div>
          <label className={`mb-2 ${labelClass}`}>기간</label>
          <div className="flex flex-wrap items-center gap-2">
            <DownSelect
              value={d.startYear}
              onChange={(v) => {
                update('startYear', v);
                if (periodError) setPeriodError('');
              }}
              options={YEAR_OPTIONS.map((y) => ({
                value: String(y),
                label: `${y}년`,
              }))}
              placeholder="시작 년"
              ariaLabel="시작 년"
            />
            <DownSelect
              value={d.startMonth}
              onChange={(v) => {
                update('startMonth', v);
                if (periodError) setPeriodError('');
              }}
              options={MONTH_OPTIONS.map((m) => ({
                value: String(m).padStart(2, '0'),
                label: `${m}월`,
              }))}
              placeholder="시작 월"
              ariaLabel="시작 월"
            />
            <span className="text-sm text-gray-400">~</span>
            <DownSelect
              value={d.endYear}
              onChange={(v) => {
                update('endYear', v);
                if (periodError) setPeriodError('');
              }}
              options={YEAR_OPTIONS.map((y) => ({
                value: String(y),
                label: `${y}년`,
              }))}
              placeholder="종료 년"
              ariaLabel="종료 년"
              disabled={d.current}
            />
            <DownSelect
              value={d.endMonth}
              onChange={(v) => {
                update('endMonth', v);
                if (periodError) setPeriodError('');
              }}
              options={MONTH_OPTIONS.map((m) => ({
                value: String(m).padStart(2, '0'),
                label: `${m}월`,
              }))}
              placeholder="종료 월"
              ariaLabel="종료 월"
              disabled={d.current}
            />
            <button
              type="button"
              onClick={() => {
                update('current', !d.current);
                if (periodError) setPeriodError('');
              }}
              aria-pressed={d.current}
              className={`${chipBase} ${d.current ? chipOn : chipOff}`}
            >
              진행중
            </button>
          </div>
          {(periodInvalid || periodError) && (
            <p className="mt-2 text-xs text-red-500">
              {periodError || '종료 날짜는 시작 날짜 이후여야 합니다.'}
            </p>
          )}
        </div>

        {/* 2. 연구 배경 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>2. 연구 배경</label>
          <p className={`mb-2 ${subHintClass}`}>
            동기 / 선행 연구·논문 / 후행 연구·논문을 정리해주세요.
          </p>
          <textarea
            rows={5}
            value={d.background}
            onChange={(e) => update('background', e.target.value)}
            placeholder="해당 연구를 시작하게 된 동기와 관련 선행/후행 연구를 정리해주세요."
            className={textareaClass}
          />
        </div>

        {/* 3. 연구 과정 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>3. 연구 과정</label>
          <p className={`mb-2 ${subHintClass}`}>
            실험 설계, 방법론, 데이터, 단계별 진행 등.
          </p>
          <textarea
            rows={5}
            value={d.process}
            onChange={(e) => update('process', e.target.value)}
            placeholder="연구 진행 과정을 기술해주세요."
            className={textareaClass}
          />
        </div>

        {/* 4. 한계 / 추후 발전 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>
            4. 한계 / 추후 발전 가능성
          </label>
          <textarea
            rows={4}
            value={d.limits}
            onChange={(e) => update('limits', e.target.value)}
            placeholder="현재 결과물의 한계, 향후 보완 방향을 적어주세요."
            className={textareaClass}
          />
        </div>

        {/* 5. 도메인 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <p className={`mb-2 ${labelClass}`}>
            5. 도메인{' '}
            <span className="text-xs font-normal text-gray-400">(선택)</span>
          </p>
          <p className={`mb-3 ${subHintClass}`}>
            이 연구는 의료·금융과 같은 도메인 활동을 포함하나요?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update('hasDomain', true)}
              aria-pressed={d.hasDomain === true}
              className={`${chipBase} ${
                d.hasDomain === true ? chipOn : chipOff
              }`}
            >
              예
            </button>
            <button
              type="button"
              onClick={() => update('hasDomain', false)}
              aria-pressed={d.hasDomain === false}
              className={`${chipBase} ${
                d.hasDomain === false
                  ? 'border-gray-700 bg-gray-700 text-white'
                  : chipOff
              }`}
            >
              아니오
            </button>
          </div>

          {d.hasDomain && (
            <div className="mt-4 space-y-4">
              {/* 도메인 태그 */}
              <div>
                <label className={`mb-2 ${labelClass}`}>
                  도메인 선택
                  <span className="ml-1 text-xs font-normal text-gray-400">
                    — 카드 앞에 태그로 노출됩니다
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DOMAIN_OPTIONS.map((tag) => {
                    const sel = d.domainTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleDomainTag(tag)}
                        aria-pressed={sel}
                        className={`${chipBase} ${sel ? chipOn : chipOff}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                  {d.domainTags
                    .filter((t) => !DOMAIN_OPTIONS.includes(t))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleDomainTag(tag)}
                        aria-pressed
                        className={`${chipBase} ${chipOn} inline-flex items-center gap-1.5`}
                      >
                        {tag}
                        <span className="text-xs opacity-80">✕</span>
                      </button>
                    ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={d.domainCustom}
                    onChange={(e) => update('domainCustom', e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomDomain();
                      }
                    }}
                    placeholder="기타 도메인 직접 입력"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={addCustomDomain}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700"
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 도메인 전문 지식 */}
              <div>
                <label className={`mb-1 ${labelClass}`}>
                  도메인 관련 전문 지식을 내포한 활동
                </label>
                <textarea
                  rows={3}
                  value={d.domainExpertise}
                  onChange={(e) => update('domainExpertise', e.target.value)}
                  className={textareaClass}
                  placeholder="예: 임상의 인터뷰, 라벨링 기준 정의, 도메인 논문 정독 등."
                />
              </div>

              {/* 도메인 종사자와의 커뮤니케이션 */}
              <div>
                <label className={`mb-1 ${labelClass}`}>
                  도메인 종사자와의 커뮤니케이션 경험
                </label>
                <textarea
                  rows={3}
                  value={d.domainComm}
                  onChange={(e) => update('domainComm', e.target.value)}
                  className={textareaClass}
                  placeholder="예: 주 1회 영상의학과 전공의와 리뷰 세션 진행 등."
                />
              </div>

              {/* 비전공자 한계 + 피드백 */}
              <div>
                <label className={`mb-1 ${labelClass}`}>
                  비전공자로서의 부족한 점 / 한계 및 피드백
                </label>
                <textarea
                  rows={3}
                  value={d.domainLimits}
                  onChange={(e) => update('domainLimits', e.target.value)}
                  className={textareaClass}
                  placeholder="예: 도메인 용어집 부재로 초반 라벨 분류 기준 오설정 → 전문의 피드백 후 재정의."
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. 논문 첨부 */}
        <div className="rounded-xl border border-gray-100 p-4">
          <label className={`mb-2 ${labelClass}`}>
            6. 논문 첨부{' '}
            <span className="text-xs font-normal text-gray-400">(선택)</span>
          </label>
          <p className={`mb-2 ${subHintClass}`}>
            URL을 입력하면 카드에서 논문 페이지로 바로 이동할 수 있어요.
          </p>
          <input
            type="url"
            value={d.paperUrl}
            onChange={(e) => update('paperUrl', e.target.value)}
            placeholder="예: https://arxiv.org/abs/..."
            className={inputClass}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              {d.paperFile ? '파일 변경' : '+ 파일 첨부'}
            </button>
            {d.paperFile && (
              <>
                <a
                  href={d.paperFile.dataUrl}
                  download={d.paperFile.filename}
                  className="truncate text-xs text-gray-700 hover:text-blue-600 hover:underline"
                >
                  📎 {d.paperFile.filename}
                </a>
                <button
                  type="button"
                  onClick={() => update('paperFile', null)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  제거
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* 한 줄 요약 — 피드 카드에 노출 (필수) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={`${labelClass}`}>
              한 줄 요약 <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-blue-600">
              ⓘ 작성한 내용이 피드에 올라갑니다.
            </span>
          </div>
          <input
            type="text"
            value={d.summary}
            onChange={(e) => {
              update('summary', e.target.value.slice(0, 120));
              if (summaryError) setSummaryError('');
            }}
            placeholder="피드 카드에 보일 한 줄 소개를 입력해주세요. (예: 흉부 X-ray 영상에서 폐 결절 자동 탐지)"
            className={inputClass}
          />
          <div className="mt-1 flex items-center justify-between">
            {summaryError ? (
              <p className="text-xs text-red-500">{summaryError}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-gray-400">
              {d.summary.length} / 120
            </span>
          </div>
        </div>
      </div>

      {/* 액션 */}
      <div className="mt-6 flex items-center justify-between gap-2">
        {isEdit ? (
          <button
            onClick={handleDelete}
            className="rounded-full border border-red-200 px-6 py-2.5 text-sm text-red-500 hover:bg-red-50"
          >
            삭제
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Link
            href="/portfolio"
            className="rounded-full border border-gray-200 px-6 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            className="rounded-full bg-blue-600 px-6 py-2.5 text-sm text-white shadow-md hover:bg-blue-700"
          >
            {isEdit ? '수정 완료' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
