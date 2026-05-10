'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DownSelect, getMyPortfolioPath, type PortfolioItem } from '../_lib';
import {
  syncItemToBackend,
  deleteItemFromBackend,
} from '@/lib/portfolio-mapper';

// ─────── Storage keys ───────
const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const STUDY_DETAILS_STORAGE_KEY = 'mock_study_details';

// ─────── Year/Month options ───────
// 최대 연도는 오늘 연도, 12년치만 노출 (월 드롭다운과 같은 높이로 아래 정렬 유도).
const PERIOD_CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: 12 },
  (_, i) => PERIOD_CURRENT_YEAR - i,
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

// ─────── Types ───────
export type StudyDetail = {
  topic: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  current: boolean;
  motivation: string;
  process: string;
  learned: string;
  improvements: string;
  moreToLearn: string;
  /** 피드 카드에 노출되는 한 줄 요약 (필수). */
  summary: string;
};

const EMPTY_DETAIL: StudyDetail = {
  topic: '',
  startYear: '',
  startMonth: '',
  endYear: '',
  endMonth: '',
  current: false,
  motivation: '',
  process: '',
  learned: '',
  improvements: '',
  moreToLearn: '',
  summary: '',
};

// ─────── Helpers ───────
const formatPeriod = (d: StudyDetail): string => {
  if (!d.startYear || !d.startMonth) return '';
  const start = `${d.startYear}.${d.startMonth.padStart(2, '0')}`;
  if (d.current) return `${start} - 현재`;
  if (!d.endYear || !d.endMonth) return start;
  const end = `${d.endYear}.${d.endMonth.padStart(2, '0')}`;
  return `${start} - ${end}`;
};

// ─────── Main component ───────
export default function StudyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const editId = editIdParam ? Number(editIdParam) : null;
  const isEdit = editId !== null && Number.isFinite(editId);

  const [d, setD] = useState<StudyDetail>(EMPTY_DETAIL);
  const [topicError, setTopicError] = useState('');
  const [periodError, setPeriodError] = useState('');
  const [summaryError, setSummaryError] = useState('');

  // 시작 > 종료 검증
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
      const raw = localStorage.getItem(STUDY_DETAILS_STORAGE_KEY);
      const map: Record<string, StudyDetail> = raw ? JSON.parse(raw) : {};
      const saved = map[String(editId)];
      if (saved) {
        setD({ ...EMPTY_DETAIL, ...saved });
        return;
      }
      // details 없는 기존 항목 → 제목 기본 복원
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const items: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const found = items.find((it) => it.id === editId);
      if (found) {
        setD({
          ...EMPTY_DETAIL,
          topic: found.title,
        });
      }
    } catch {
      // 무시
    }
  }, [isEdit, editId]);

  const update = <K extends keyof StudyDetail>(
    key: K,
    value: StudyDetail[K],
  ) => setD((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!d.topic.trim()) {
      setTopicError('스터디 주제를 입력해주세요.');
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
      type: 'study',
      title: d.topic.trim(),
      description: d.motivation.trim() || d.process.trim() || '',
      summary: d.summary.trim(),
      period,
      current: d.current,
      tags: [],
    };
    try {
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const exists = list.some((it) => it.id === targetId);
      const next = exists
        ? list.map((it) => (it.id === targetId ? { ...it, ...item } : it))
        : [...list, item];
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));

      const detailsRaw = localStorage.getItem(STUDY_DETAILS_STORAGE_KEY);
      const map: Record<string, StudyDetail> = detailsRaw
        ? JSON.parse(detailsRaw)
        : {};
      map[String(targetId)] = d;
      localStorage.setItem(STUDY_DETAILS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // 무시
    }
    void syncItemToBackend(item);
    router.push(getMyPortfolioPath());
  };

  const handleDelete = () => {
    if (!isEdit || editId === null) return;
    if (!confirm('이 스터디 항목을 삭제하시겠어요?')) return;
    const deletedId = editId;
    try {
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const next = list.filter((it) => it.id !== editId);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
      const detailsRaw = localStorage.getItem(STUDY_DETAILS_STORAGE_KEY);
      if (detailsRaw) {
        const map: Record<string, StudyDetail> = JSON.parse(detailsRaw);
        delete map[String(editId)];
        localStorage.setItem(STUDY_DETAILS_STORAGE_KEY, JSON.stringify(map));
      }
    } catch {
      // 무시
    }
    void deleteItemFromBackend(deletedId);
    router.push(getMyPortfolioPath());
  };

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
            {isEdit ? '스터디 수정' : '새 스터디'}
          </h1>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm sm:p-6">
        <h2
          style={{ marginBottom: '1rem' }}
          className="text-xl font-bold text-gray-900"
        >
          스터디 {isEdit ? '수정' : '추가'}
        </h2>

        {/* 1. 스터디 주제 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>
            1. 스터디 주제 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={d.topic}
            onChange={(e) => {
              update('topic', e.target.value);
              if (topicError) setTopicError('');
            }}
            placeholder="예: 알고리즘 / CS 기초 / 모던 React 패턴"
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

        {/* 2. 스터디 동기 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>2. 스터디 동기</label>
          <p className={`mb-2 ${subHintClass}`}>
            왜 이 스터디를 시작했나요? 기대했던 점 등.
          </p>
          <textarea
            rows={4}
            value={d.motivation}
            onChange={(e) => update('motivation', e.target.value)}
            placeholder="스터디를 시작하게 된 계기와 목표를 적어주세요."
            className={textareaClass}
          />
        </div>

        {/* 3. 스터디 진행 방식 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>3. 스터디 진행 방식</label>
          <p className={`mb-2 ${subHintClass}`}>
            주기 / 인원 / 자료 / 발표·토론 방식 등.
          </p>
          <textarea
            rows={4}
            value={d.process}
            onChange={(e) => update('process', e.target.value)}
            placeholder="예: 주 1회 모각코, 백준 골드 문제 5문항 풀이 후 풀이 공유."
            className={textareaClass}
          />
        </div>

        {/* 4. 배운 점 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>4. 배운 점</label>
          <textarea
            rows={4}
            value={d.learned}
            onChange={(e) => update('learned', e.target.value)}
            placeholder="스터디를 통해 새로 익히게 된 지식·기술·태도 등을 정리해주세요."
            className={textareaClass}
          />
        </div>

        {/* 5. 아쉬운 점 & 개선할 점 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>
            5. 아쉬운 점 & 개선할 점
          </label>
          <textarea
            rows={4}
            value={d.improvements}
            onChange={(e) => update('improvements', e.target.value)}
            placeholder="진행 중 부족했던 부분과, 다음에 한다면 어떻게 개선할지 적어주세요."
            className={textareaClass}
          />
        </div>

        {/* 6. 더 배우고 싶은 부분 */}
        <div>
          <label className={`mb-1 ${labelClass}`}>6. 더 배우고 싶은 부분</label>
          <textarea
            rows={3}
            value={d.moreToLearn}
            onChange={(e) => update('moreToLearn', e.target.value)}
            placeholder="이 스터디 이후 추가로 파고들고 싶은 주제·자료 등."
            className={textareaClass}
          />
        </div>

        {/* 7. 한 줄 요약 — 피드 카드에 노출 (필수) */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={`${labelClass}`}>
              7. 한 줄 요약 <span className="text-red-500">*</span>
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
            placeholder="피드 카드에 보일 한 줄 소개 (예: 백준 골드 알고리즘 풀이 공유 스터디)"
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
