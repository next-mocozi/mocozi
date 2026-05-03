'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import type { PortfolioItem } from '../page';

// ─────── Storage keys ───────
const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const DRAFT_STORAGE_KEY = 'mock_portfolio_draft';
const DETAILS_STORAGE_KEY = 'mock_portfolio_details';

// ─────── Types ───────
type Asset = {
  id: string;
  alias: string;
  filename: string;
  dataUrl: string;
};

type Block = { text: string; assetIds: string[] };

type Draft = {
  name: string;
  activityTypes: string[];
  fieldTags: string[];
  roles: string[];
  motivation: string;
  techChoice: string;
  architecture: Block;
  result: Block;
  retro: Block;
  contribution: string;
  hasDomain: boolean | null;
  domainTags: string[];
  domainExpertise: string;
  domainComm: string;
  domainLimits: string;
  deliverableUrl: string;
  deliverableFiles: Asset[];
  assets: Asset[];
  stepIdx: number;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  activityTypes: [],
  fieldTags: [],
  roles: [],
  motivation: '',
  techChoice: '',
  architecture: { text: '', assetIds: [] },
  result: { text: '', assetIds: [] },
  retro: { text: '', assetIds: [] },
  contribution: '',
  hasDomain: null,
  domainTags: [],
  domainExpertise: '',
  domainComm: '',
  domainLimits: '',
  deliverableUrl: '',
  deliverableFiles: [],
  assets: [],
  stepIdx: 0,
};

const ACTIVITY_OPTIONS = [
  '공모전',
  '해커톤',
  '팀 프로젝트',
  '개인 프로젝트',
  '기타',
];

// 프로필에서 가져온 직군·기술 스택 (mock — 추후 GET /api/users/me 로 교체)
// /profile 의 MOCK_PROFILE 과 같은 값
const PROFILE_MAIN_ROLE = '풀스택';
const PROFILE_SUB_ROLES = ['프론트엔드', '백엔드'];
const PROFILE_SKILLS = ['React', 'TypeScript', 'Node.js', 'Next.js'];

// "어떤 분야를 다뤘나요?" — 연구 영역 + 프로필 기술 스택을 함께 추천
const FIELD_OPTIONS = Array.from(
  new Set(['CV', 'NLP', 'RL', ...PROFILE_SKILLS, '기타']),
);
// "어떤 역할을 담당했나요?" — 프로필 직군(메인+서브) + 일반 역할 옵션
const ROLE_OPTIONS = Array.from(
  new Set([
    PROFILE_MAIN_ROLE,
    ...PROFILE_SUB_ROLES,
    'PM',
    'FE',
    'BE',
    '디자인',
    '기타',
  ]),
);
const DOMAIN_OPTIONS = ['의료', '금융', '법률', '교육', '기타'];

const FIRST_TEXTAREA_HINT =
  '핵심만 간결하게 — 긴 나열보다 임팩트 있는 내용을 담아주세요.';

// ─────── Helpers ───────
const aliasForIndex = (i: number): string => {
  // 0=A, 1=B, ..., 25=Z, 26=AA, 27=AB...
  let s = '';
  let n = i;
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
};

const findNextAlias = (assets: Asset[]) => {
  const used = new Set(assets.map((a) => a.alias));
  for (let i = 0; i < 1000; i++) {
    const c = aliasForIndex(i);
    if (!used.has(c)) return c;
  }
  return `X${Date.now()}`;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const isDraftEmpty = (d: Draft) =>
  !d.name &&
  d.activityTypes.length === 0 &&
  d.fieldTags.length === 0 &&
  d.roles.length === 0 &&
  !d.motivation &&
  !d.techChoice &&
  !d.architecture.text &&
  !d.result.text &&
  !d.retro.text &&
  !d.contribution &&
  d.hasDomain === null &&
  !d.deliverableUrl &&
  d.deliverableFiles.length === 0;

// ─────── Step config ───────
type StepKey =
  | 'name'
  | 'activity'
  | 'field'
  | 'roles'
  | 'motivation'
  | 'techChoice'
  | 'architecture'
  | 'result'
  | 'retro'
  | 'contribution'
  | 'domainCheck'
  | 'domainTags'
  | 'domainExpertise'
  | 'domainComm'
  | 'domainLimits'
  | 'deliverables'
  | 'summary';

type StepCfg = { key: StepKey; title: string; subtitle?: string };

const buildSteps = (hasDomain: boolean | null): StepCfg[] => {
  const arr: StepCfg[] = [
    { key: 'name', title: '프로젝트명', subtitle: '어떤 프로젝트인가요?' },
    {
      key: 'activity',
      title: '프로젝트 분야',
      subtitle: '어떤 활동을 하셨나요? (복수 선택)',
    },
    {
      key: 'field',
      title: '프로젝트 분야',
      subtitle: '어떤 분야를 다루셨나요?',
    },
    {
      key: 'roles',
      title: '본인 역할',
      subtitle: '어떤 역할을 담당하셨나요?',
    },
    {
      key: 'motivation',
      title: '프로젝트 개요 1/5',
      subtitle: '왜 만들었나요? (문제 정의)',
    },
    {
      key: 'techChoice',
      title: '프로젝트 개요 2/5',
      subtitle: '왜 이 기술 조합을 선택했나요?',
    },
    {
      key: 'architecture',
      title: '프로젝트 개요 3/5',
      subtitle: '아키텍처 설계 및 과정 (문제·솔루션 각 3개 이하)',
    },
    {
      key: 'result',
      title: '프로젝트 개요 4/5',
      subtitle: '결과물 (수치화 필수)',
    },
    {
      key: 'retro',
      title: '프로젝트 개요 5/5',
      subtitle: '회고 (잘된 점 / 아쉬운 점 / 바꿀 점)',
    },
    {
      key: 'contribution',
      title: '본인 참여 활동',
      subtitle: '주도한 핵심 파트',
    },
    {
      key: 'domainCheck',
      title: '도메인',
      subtitle: '이 프로젝트는 특정 도메인을 포함하나요?',
    },
  ];
  if (hasDomain) {
    arr.push(
      {
        key: 'domainTags',
        title: '도메인 1/4',
        subtitle: '도메인을 선택해주세요.',
      },
      {
        key: 'domainExpertise',
        title: '도메인 2/4',
        subtitle: '도메인 전문성을 어떻게 확보했나요?',
      },
      {
        key: 'domainComm',
        title: '도메인 3/4',
        subtitle: '도메인 전문가와 어떻게 소통했나요?',
      },
      {
        key: 'domainLimits',
        title: '도메인 4/4',
        subtitle: '한계와 향후 개선 방향은?',
      },
    );
  }
  arr.push(
    {
      key: 'deliverables',
      title: '결과물 / 배포물 첨부',
      subtitle: 'URL과 파일을 첨부해주세요. (선택)',
    },
    {
      key: 'summary',
      title: '미리보기',
      subtitle: '작성한 내용을 확인해주세요.',
    },
  );
  return arr;
};

// ─────── Main component ───────
export default function ProjectInterview() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [phase, setPhase] = useState<'loading' | 'resume' | 'form'>('loading');
  const [toast, setToast] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(draft.hasDomain), [draft.hasDomain]);
  const stepIdx = Math.min(Math.max(draft.stepIdx, 0), steps.length - 1);
  const stepCfg = steps[stepIdx];
  const isLast = stepCfg.key === 'summary';
  const isLastInput = stepIdx === steps.length - 2;

  // 초기 로드 — 저장된 draft 가 있으면 resume 모달
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft;
        if (!isDraftEmpty(parsed)) {
          setDraft(parsed);
          setPhase('resume');
          return;
        }
      }
    } catch {
      // 무시
    }
    setPhase('form');
  }, []);

  // 자동 저장
  useEffect(() => {
    if (phase !== 'form') return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // 용량 초과 시 무시 — base64 이미지 누적 가능성
    }
  }, [draft, phase]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleClose = () => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // 무시
    }
    showToast('진행 상황이 저장되었습니다.');
    setTimeout(() => router.push('/portfolio'), 700);
  };

  const next = () =>
    setDraft((d) => ({
      ...d,
      stepIdx: Math.min(d.stepIdx + 1, steps.length - 1),
    }));
  const prev = () =>
    setDraft((d) => ({ ...d, stepIdx: Math.max(d.stepIdx - 1, 0) }));

  const handleResumeYes = () => setPhase('form');
  const handleResumeNo = () => {
    setDraft(EMPTY_DRAFT);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // 무시
    }
    setPhase('form');
  };

  // 현재 step 의 유효성
  const isStepValid = useMemo(() => {
    switch (stepCfg.key) {
      case 'name':
        return draft.name.trim().length > 0;
      case 'activity':
        return draft.activityTypes.length > 0;
      case 'field':
        return draft.fieldTags.length > 0;
      case 'roles':
        return draft.roles.length > 0;
      case 'motivation':
        return draft.motivation.trim().length > 0;
      case 'techChoice':
        return draft.techChoice.trim().length > 0;
      case 'architecture':
        return draft.architecture.text.trim().length > 0;
      case 'result':
        return draft.result.text.trim().length > 0;
      case 'retro':
        return draft.retro.text.trim().length > 0;
      case 'contribution':
        return draft.contribution.trim().length > 0;
      case 'domainCheck':
        return draft.hasDomain !== null;
      case 'domainTags':
        return draft.domainTags.length > 0;
      case 'domainExpertise':
        return draft.domainExpertise.trim().length > 0;
      case 'domainComm':
        return draft.domainComm.trim().length > 0;
      case 'domainLimits':
        return draft.domainLimits.trim().length > 0;
      case 'deliverables':
        return true; // 선택
      case 'summary':
        return true;
      default:
        return true;
    }
  }, [stepCfg.key, draft]);

  const handleSaveProject = () => {
    const id = Date.now();
    const item: PortfolioItem = {
      id,
      type: 'project',
      title: draft.name.trim() || '(제목 없음)',
      description:
        draft.motivation.trim() ||
        draft.contribution.trim() ||
        draft.result.text.trim() ||
        '',
      period: '',
      current: false,
      domain: draft.hasDomain && draft.domainTags[0] ? draft.domainTags[0] : undefined,
      tags: Array.from(
        new Set([...draft.activityTypes, ...draft.fieldTags, ...draft.roles]),
      ).filter(Boolean),
    };
    try {
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      list.push(item);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // 무시
    }
    try {
      const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
      const map: Record<string, Draft> = detailsRaw ? JSON.parse(detailsRaw) : {};
      map[String(id)] = draft;
      localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // 무시
    }
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // 무시
    }
    router.push('/portfolio');
  };

  if (phase === 'loading') return null;

  return (
    <>
      {/* 단계 전환 애니메이션 — React 19 의 인라인 <style> 활용 */}
      <style>{`
        @keyframes mocoziStepIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        .mocozi-step-in { animation: mocoziStepIn 220ms ease-out; }
      `}</style>

      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-2xl flex-col justify-center px-6 py-14 sm:px-10 sm:py-16">
        {/* 상단: 진행률 + 닫기 */}
        <div className="mb-9 flex items-center gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>
                {stepIdx + 1} / {steps.length}
              </span>
              <span className="truncate">{stepCfg.title}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="저장하고 닫기"
            title="저장하고 닫기"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 단계 카드 */}
        <div
          key={stepIdx}
          className="mocozi-step-in rounded-2xl bg-white p-8 shadow-sm sm:p-10"
        >
          <h2 className="mb-3 text-xl font-bold leading-snug text-gray-900">
            {stepCfg.title}
          </h2>
          {stepCfg.subtitle && (
            <p className="mb-9 text-sm leading-7 text-gray-500">
              {stepCfg.subtitle}
            </p>
          )}
          <StepBody cfg={stepCfg} draft={draft} setDraft={setDraft} />
        </div>

        {/* 하단 네비게이션 */}
        {!isLast ? (
          <div className="mt-8 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={stepIdx === 0}
              onClick={prev}
              className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              disabled={!isStepValid}
              onClick={next}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLastInput ? '미리보기' : '다음'}
            </button>
          </div>
        ) : (
          <div className="mt-8 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={prev}
              className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              다시 편집
            </button>
            <button
              type="button"
              onClick={handleSaveProject}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              포트폴리오에 저장
            </button>
          </div>
        )}
      </div>

      {/* 이어서 작성 모달 — 인터뷰 카드와 동일한 폭/여백으로 가운데 정렬 */}
      {phase === 'resume' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6 sm:px-10">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-xl sm:p-10">
            <h3 className="mb-4 text-xl font-bold leading-snug text-gray-900">
              저장된 항목이 있습니다
            </h3>
            <p className="mb-9 text-sm leading-7 text-gray-500">
              이어서 작성하시겠어요?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleResumeNo}
                className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                새로 시작
              </button>
              <button
                type="button"
                onClick={handleResumeYes}
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 — 본문과 같은 max-w 안에서 가운데 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center px-6">
          <div className="mx-auto w-fit max-w-2xl rounded-full bg-gray-900 px-5 py-2.5 text-sm leading-relaxed text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}

// ─────── Step body ───────
function StepBody({
  cfg,
  draft,
  setDraft,
}: {
  cfg: StepCfg;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  switch (cfg.key) {
    case 'name':
      return (
        <input
          type="text"
          autoFocus
          value={draft.name}
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value }))
          }
          placeholder="예: 모코지"
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      );
    case 'activity':
      return (
        <TagSelect
          options={ACTIVITY_OPTIONS}
          selected={draft.activityTypes}
          onChange={(v) => setDraft((d) => ({ ...d, activityTypes: v }))}
        />
      );
    case 'field':
      return (
        <TagSelect
          options={FIELD_OPTIONS}
          selected={draft.fieldTags}
          onChange={(v) => setDraft((d) => ({ ...d, fieldTags: v }))}
          allowCustom
        />
      );
    case 'roles':
      return (
        <TagSelect
          options={ROLE_OPTIONS}
          selected={draft.roles}
          onChange={(v) => setDraft((d) => ({ ...d, roles: v }))}
        />
      );
    case 'motivation':
      return (
        <SimpleTextarea
          value={draft.motivation}
          onChange={(v) => setDraft((d) => ({ ...d, motivation: v }))}
          showHint
          placeholder="해결하고 싶었던 문제, 사용자/맥락을 간결히 적어주세요."
        />
      );
    case 'techChoice':
      return (
        <SimpleTextarea
          value={draft.techChoice}
          onChange={(v) => setDraft((d) => ({ ...d, techChoice: v }))}
          placeholder="선택한 기술과 대안 대비 장점을 적어주세요."
        />
      );
    case 'architecture':
      return (
        <AssetTextarea
          block={draft.architecture}
          onBlockChange={(b) => setDraft((d) => ({ ...d, architecture: b }))}
          assets={draft.assets}
          onAssetsChange={(a) => setDraft((d) => ({ ...d, assets: a }))}
          placeholder="문제 정의 → 해결 방법 → 트레이드오프 (각 3개 이하)"
        />
      );
    case 'result':
      return (
        <AssetTextarea
          block={draft.result}
          onBlockChange={(b) => setDraft((d) => ({ ...d, result: b }))}
          assets={draft.assets}
          onAssetsChange={(a) => setDraft((d) => ({ ...d, assets: a }))}
          placeholder="달성한 지표 (수치화 필수). 예: 응답시간 50% 개선, MAU 300 → 1,200"
        />
      );
    case 'retro':
      return (
        <AssetTextarea
          block={draft.retro}
          onBlockChange={(b) => setDraft((d) => ({ ...d, retro: b }))}
          assets={draft.assets}
          onAssetsChange={(a) => setDraft((d) => ({ ...d, assets: a }))}
          placeholder="잘된 점 / 아쉬운 점 / 다시 한다면 바꿀 점"
        />
      );
    case 'contribution':
      return (
        <SimpleTextarea
          value={draft.contribution}
          onChange={(v) => setDraft((d) => ({ ...d, contribution: v }))}
          placeholder="구체적으로 어떤 부분을 주도했는지, 의사결정·산출물 중심으로 적어주세요."
        />
      );
    case 'domainCheck':
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, hasDomain: true }))}
            className={`flex-1 rounded-xl border px-4 py-4 text-sm font-medium transition-all ${
              draft.hasDomain === true
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            예
          </button>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                hasDomain: false,
                domainTags: [],
                domainExpertise: '',
                domainComm: '',
                domainLimits: '',
              }))
            }
            className={`flex-1 rounded-xl border px-4 py-4 text-sm font-medium transition-all ${
              draft.hasDomain === false
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            아니오
          </button>
        </div>
      );
    case 'domainTags':
      return (
        <TagSelect
          options={DOMAIN_OPTIONS}
          selected={draft.domainTags}
          onChange={(v) => setDraft((d) => ({ ...d, domainTags: v }))}
          allowCustom
        />
      );
    case 'domainExpertise':
      return (
        <SimpleTextarea
          value={draft.domainExpertise}
          onChange={(v) => setDraft((d) => ({ ...d, domainExpertise: v }))}
          placeholder="공부한 자료, 정보 출처, 학습 방법 등."
        />
      );
    case 'domainComm':
      return (
        <SimpleTextarea
          value={draft.domainComm}
          onChange={(v) => setDraft((d) => ({ ...d, domainComm: v }))}
          placeholder="전문가 인터뷰, 협업 방식 등."
        />
      );
    case 'domainLimits':
      return (
        <SimpleTextarea
          value={draft.domainLimits}
          onChange={(v) => setDraft((d) => ({ ...d, domainLimits: v }))}
          placeholder="현재 결과물의 한계, 향후 보완 방향."
        />
      );
    case 'deliverables':
      return <DeliverablesStep draft={draft} setDraft={setDraft} />;
    case 'summary':
      return <SummaryView draft={draft} />;
    default:
      return null;
  }
}

// ─────── Sub-components ───────

function TagSelect({
  options,
  selected,
  onChange,
  allowCustom,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState('');
  const toggle = (v: string) =>
    onChange(
      selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    );
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (selected.includes(v)) {
      setCustom('');
      return;
    }
    onChange([...selected, v]);
    setCustom('');
  };
  const customs = selected.filter((s) => !options.includes(s));
  return (
    <div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-3">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-full border px-4 py-2.5 text-sm leading-relaxed transition-all ${
                on
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {opt}
            </button>
          );
        })}
        {customs.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className="inline-flex items-center gap-1 rounded-full border border-blue-500 bg-blue-500 px-3 py-2 text-sm text-white"
          >
            {s}
            <span className="text-xs opacity-80">✕</span>
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="mt-5 flex gap-2.5">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="직접 입력 후 Enter"
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={addCustom}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white hover:bg-gray-700"
          >
            추가
          </button>
        </div>
      )}
    </div>
  );
}

function SimpleTextarea({
  value,
  onChange,
  placeholder,
  showHint,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showHint?: boolean;
}) {
  return (
    <div>
      {showHint && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-700">
          ⭐ {FIRST_TEXTAREA_HINT}
        </p>
      )}
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-gray-200 px-4 py-4 text-sm leading-8 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function AssetTextarea({
  block,
  onBlockChange,
  assets,
  onAssetsChange,
  placeholder,
}: {
  block: Block;
  onBlockChange: (b: Block) => void;
  assets: Asset[];
  onAssetsChange: (a: Asset[]) => void;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onBlockChange({ ...block, text });
    const cursor = e.target.selectionStart;
    const before = text.slice(0, cursor);
    const m = before.match(/@([^\s@]*)$/);
    if (m) {
      setMentionQuery(m[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (asset: Asset) => {
    const ta = taRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = block.text.slice(0, cursor);
    const after = block.text.slice(cursor);
    const newBefore = before.replace(/@[^\s@]*$/, `@[${asset.alias}] `);
    const newText = newBefore + after;
    const newAssetIds = block.assetIds.includes(asset.id)
      ? block.assetIds
      : [...block.assetIds, asset.id];
    onBlockChange({ text: newText, assetIds: newAssetIds });
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const pos = newBefore.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleAddAsset = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const nextAssets = assets.slice();
    for (const file of files) {
      try {
        const dataUrl = await fileToDataUrl(file);
        const alias = findNextAlias(nextAssets);
        nextAssets.push({
          id: `${Date.now()}-${alias}-${Math.random().toString(36).slice(2, 6)}`,
          alias,
          filename: file.name,
          dataUrl,
        });
      } catch {
        // 개별 실패 무시
      }
    }
    onAssetsChange(nextAssets);
  };

  const removeAsset = (id: string) =>
    onAssetsChange(assets.filter((x) => x.id !== id));

  const filteredAssets = assets.filter((a) =>
    `${a.alias} ${a.filename}`
      .toLowerCase()
      .includes(mentionQuery.toLowerCase()),
  );

  return (
    <div>
      <div className="relative">
        <textarea
          ref={taRef}
          value={block.text}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
          rows={6}
          placeholder={placeholder}
          className="w-full resize-y rounded-lg border border-gray-200 px-4 py-4 text-sm leading-8 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        {mentionOpen && filteredAssets.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filteredAssets.map((a) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(a);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <img
                  src={a.dataUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded object-cover"
                />
                <div className="flex-1 truncate">
                  <span className="font-medium text-gray-700">
                    @{a.filename}
                  </span>
                  <span className="ml-2 font-mono text-xs text-gray-400">
                    [{a.alias}]
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-dashed border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
        >
          + 시각자료 추가
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif"
          multiple
          onChange={handleAddAsset}
          className="hidden"
        />
        {assets.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
            title={a.filename}
          >
            <img
              src={a.dataUrl}
              alt=""
              className="h-4 w-4 rounded-sm object-cover"
            />
            <span className="max-w-[140px] truncate">{a.filename}</span>
            <span className="font-mono text-gray-400">→ [{a.alias}]</span>
            <button
              type="button"
              onClick={() => removeAsset(a.id)}
              className="text-gray-400 hover:text-red-500"
              aria-label={`${a.filename} 제거`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs leading-7 text-gray-400">
        텍스트에서 <span className="font-mono">@</span> 를 입력하면 업로드한 자료를
        인용할 수 있어요. 예: <span className="font-mono">@[A]</span>
      </p>
    </div>
  );
}

function DeliverablesStep({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const nextFiles = draft.deliverableFiles.slice();
    for (const file of files) {
      try {
        const dataUrl = await fileToDataUrl(file);
        nextFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          alias: '',
          filename: file.name,
          dataUrl,
        });
      } catch {
        // 무시
      }
    }
    setDraft((d) => ({ ...d, deliverableFiles: nextFiles }));
  };

  return (
    <div className="space-y-8">
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          URL
        </label>
        <input
          type="url"
          value={draft.deliverableUrl}
          onChange={(e) =>
            setDraft((d) => ({ ...d, deliverableUrl: e.target.value }))
          }
          placeholder="https://..."
          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <label className="mb-3 block text-sm font-medium text-gray-700">
          파일 첨부{' '}
          <span className="text-xs font-normal text-gray-400">
            (이미지 / PDF)
          </span>
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-full border border-dashed border-blue-300 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
        >
          파일 선택
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        {draft.deliverableFiles.length > 0 && (
          <ul className="mt-2 space-y-1">
            {draft.deliverableFiles.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs"
              >
                <span className="flex-1 truncate">{f.filename}</span>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      deliverableFiles: d.deliverableFiles.filter(
                        (x) => x.id !== f.id,
                      ),
                    }))
                  }
                  className="text-gray-400 hover:text-red-500"
                  aria-label={`${f.filename} 제거`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────── Summary view ───────
function SummaryView({ draft }: { draft: Draft }) {
  const [copied, setCopied] = useState(false);

  const renderInline = (text: string): ReactNode => {
    if (!text) return null;
    const parts = text.split(/(@\[[^\]]+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^@\[([^\]]+)\]$/);
      if (m) {
        const asset = draft.assets.find((a) => a.alias === m[1]);
        if (asset) {
          return (
            <img
              key={i}
              src={asset.dataUrl}
              alt={asset.filename}
              className="my-2 max-w-full rounded-lg border border-gray-200"
            />
          );
        }
        return (
          <span
            key={i}
            className="rounded bg-amber-50 px-1 font-mono text-xs text-amber-700"
          >
            @[{m[1]}]
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const replaceMentionsMd = (t: string) =>
    t.replace(/@\[([^\]]+)\]/g, (_, alias) => {
      const a = draft.assets.find((x) => x.alias === alias);
      return a ? `\n\n![${a.filename}](${a.dataUrl})\n\n` : `@[${alias}]`;
    });

  const toMarkdown = () => {
    const lines: string[] = [];
    lines.push(`# ${draft.name || '(제목 없음)'}`);
    lines.push('');
    if (draft.activityTypes.length)
      lines.push(`**활동:** ${draft.activityTypes.join(', ')}`);
    if (draft.fieldTags.length)
      lines.push(`**분야:** ${draft.fieldTags.join(', ')}`);
    if (draft.roles.length) lines.push(`**역할:** ${draft.roles.join(', ')}`);
    lines.push('');
    const pushSec = (h: string, body: string) => {
      if (!body || !body.trim()) return;
      lines.push(`## ${h}`);
      lines.push(replaceMentionsMd(body));
      lines.push('');
    };
    pushSec('왜 만들었나요?', draft.motivation);
    pushSec('왜 이 기술 조합을 선택했나요?', draft.techChoice);
    pushSec('아키텍처 설계 및 과정', draft.architecture.text);
    pushSec('결과물', draft.result.text);
    pushSec('회고', draft.retro.text);
    pushSec('본인 참여 활동', draft.contribution);
    if (draft.hasDomain) {
      lines.push(`## 도메인`);
      if (draft.domainTags.length)
        lines.push(`- 영역: ${draft.domainTags.join(', ')}`);
      if (draft.domainExpertise) lines.push(`- 전문성: ${draft.domainExpertise}`);
      if (draft.domainComm) lines.push(`- 소통: ${draft.domainComm}`);
      if (draft.domainLimits) lines.push(`- 한계: ${draft.domainLimits}`);
      lines.push('');
    }
    if (draft.deliverableUrl || draft.deliverableFiles.length) {
      lines.push(`## 결과물 / 배포물`);
      if (draft.deliverableUrl) lines.push(`- URL: ${draft.deliverableUrl}`);
      draft.deliverableFiles.forEach((f) => lines.push(`- 첨부: ${f.filename}`));
    }
    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 실패 시 무시
    }
  };

  const tags = [...draft.activityTypes, ...draft.fieldTags, ...draft.roles];

  return (
    <div className="space-y-10">
      <header>
        <h3 className="text-2xl font-bold leading-snug text-gray-900">
          {draft.name || '(제목 없음)'}
        </h3>
        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-blue-50 px-3 py-1 text-xs leading-relaxed text-blue-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <SummarySection
        title="왜 만들었나요?"
        text={draft.motivation}
        renderInline={renderInline}
      />
      <SummarySection
        title="왜 이 기술 조합을 선택했나요?"
        text={draft.techChoice}
        renderInline={renderInline}
      />
      <SummarySection
        title="아키텍처 설계 및 과정"
        text={draft.architecture.text}
        renderInline={renderInline}
      />
      <SummarySection
        title="결과물"
        text={draft.result.text}
        renderInline={renderInline}
      />
      <SummarySection
        title="회고"
        text={draft.retro.text}
        renderInline={renderInline}
      />
      <SummarySection
        title="본인 참여 활동"
        text={draft.contribution}
        renderInline={renderInline}
      />

      {draft.hasDomain && (
        <section>
          <h4 className="mb-4 text-sm font-bold text-gray-800">도메인</h4>
          <div className="space-y-3 text-sm leading-7 text-gray-700">
            {draft.domainTags.length > 0 && (
              <p>
                <span className="font-medium">영역:</span>{' '}
                {draft.domainTags.join(', ')}
              </p>
            )}
            {draft.domainExpertise && (
              <p>
                <span className="font-medium">전문성:</span>{' '}
                {draft.domainExpertise}
              </p>
            )}
            {draft.domainComm && (
              <p>
                <span className="font-medium">소통:</span> {draft.domainComm}
              </p>
            )}
            {draft.domainLimits && (
              <p>
                <span className="font-medium">한계:</span> {draft.domainLimits}
              </p>
            )}
          </div>
        </section>
      )}

      {(draft.deliverableUrl || draft.deliverableFiles.length > 0) && (
        <section>
          <h4 className="mb-4 text-sm font-bold text-gray-800">결과물 / 배포물</h4>
          <div className="space-y-3 text-sm leading-7">
            {draft.deliverableUrl && (
              <a
                href={draft.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                {draft.deliverableUrl}
              </a>
            )}
            {draft.deliverableFiles.map((f) => (
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {copied ? '복사됨!' : '복사하기 (Markdown)'}
        </button>
      </div>
    </div>
  );
}

function SummarySection({
  title,
  text,
  renderInline,
}: {
  title: string;
  text: string;
  renderInline: (t: string) => ReactNode;
}) {
  if (!text || !text.trim()) return null;
  return (
    <section>
      <h4 className="mb-4 text-sm font-bold text-gray-800">{title}</h4>
      <div className="whitespace-pre-wrap text-sm leading-8 text-gray-700">
        {renderInline(text)}
      </div>
    </section>
  );
}
