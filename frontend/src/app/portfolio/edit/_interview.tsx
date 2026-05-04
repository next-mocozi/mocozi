'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PortfolioItem } from '../page';

// ─────── Storage keys ───────
const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const DRAFT_STORAGE_KEY = 'mock_portfolio_draft';
const DETAILS_STORAGE_KEY = 'mock_portfolio_details';

// ─────── Types ───────
export type Asset = {
  id: string;
  alias: string;
  filename: string;
  dataUrl: string;
};

export type Block = { text: string; assetIds: string[] };

export type Draft = {
  name: string;
  activityTypes: string[];
  fieldTags: string[];
  toolTags: string[];
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
  toolTags: [],
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
const PROFILE_SKILLS = [
  'Python','C','JavaScript', 'TypeScript', 'React', 'Next.js','FastAPI',
  'Node.js', 'FastAPI', 'PyTorch', 'TensorFlow',
  'HuggingFace', 'Docker', 'AWS', 'PostgreSQL',
  'MongoDB', 'Git', 'Figma','Linux'
];

// "어떤 분야를 다뤘나요?" — 카테고리별 세부 영역
const FIELD_TAGS: Record<string, readonly string[]> = {
  'AI / ML 핵심': ['CV', 'NLP', 'RL', 'MLOps', 'LLM', 'GenAI', 'RecSys'],
  데이터: ['Data Analysis', 'Data Engineering', 'Visualization'],
  개발: [
    'Frontend',
    'Backend',
    'Fullstack',
    'Mobile',
    'DevOps',
    'System Design',
  ],
  기타: ['Research', 'Product', 'Design'],
};
// 한 카테고리당 노출 최대 개수
const TAG_PREVIEW_PER_CATEGORY = 5;

// "어떤 프로그램을 통해서 구현했나요?" — 카테고리별 기술 스택
const TECH_STACK_TAGS: Record<string, readonly string[]> = {
  언어: [
    'Python',
    'JavaScript',
    'TypeScript',
    'Java',
    'C++',
    'C#',
    'Swift',
    'Kotlin',
    'Go',
    'Rust',
    'R',
    'MATLAB',
  ],
  프론트엔드: [
    'React',
    'Next.js',
    'Vue.js',
    'Svelte',
    'Flutter',
    'React Native',
    'Angular',
    'Tailwind CSS',
  ],
  백엔드: [
    'Node.js',
    'FastAPI',
    'Django',
    'Flask',
    'Spring Boot',
    'Express',
    'GraphQL',
    'REST API',
  ],
  'AI / ML': [
    'PyTorch',
    'TensorFlow',
    'Keras',
    'Scikit-learn',
    'HuggingFace',
    'LangChain',
    'OpenCV',
    'YOLO',
    'XGBoost',
    'Stable Diffusion',
  ],
  데이터: [
    'Pandas',
    'NumPy',
    'Spark',
    'Airflow',
    'SQL',
    'MongoDB',
    'PostgreSQL',
    'Redis',
    'Elasticsearch',
    'Kafka',
  ],
  '인프라 / 클라우드': [
    'AWS',
    'GCP',
    'Azure',
    'Docker',
    'Kubernetes',
    'Vercel',
    'Firebase',
    'Terraform',
    'Nginx',
  ],
  '협업 / 기타': [
    'Git',
    'GitHub',
    'Figma',
    'Notion',
    'Jira',
    'Slack',
    'Linux',
    'Arduino',
    'Raspberry Pi',
  ],
};
// "어떤 역할을 담당했나요?" — 직군 옵션
const ROLE_OPTIONS = [
  '프론트엔드',
  '백엔드',
  '풀스택',
  '모바일',
  'DevOps/인프라',
  'AI/ML',
  '데이터',
  '보안',
  'QA',
  '게임',
  '임베디드',
  'UI/UX 디자이너',
  'PM/PO',
];
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
  d.toolTags.length === 0 &&
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
  | 'tools'
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

type StepCfg = {
  key: StepKey;
  title: string;
  subtitle?: string;
  /** "2. Q1." 형식의 분류 번호 — 질문(부제) 앞에 붙음 */
  label?: string;
};

// 필수 응답이 있어야 다음으로 넘어갈 수 있는 단계 (isStepValid 와 동기화)
const isStepRequired = (k: StepKey): boolean =>
  k !== 'deliverables' && k !== 'summary';

const buildSteps = (hasDomain: boolean | null): StepCfg[] => {
  const arr: StepCfg[] = [
    {
      key: 'name',
      label: 'Q1.',
      title: '1. 프로젝트명',
      subtitle: '어떤 프로젝트인가요?',
    },
    {
      key: 'activity',
      label: 'Q1.',
      title: '2. 프로젝트 분야',
      subtitle: '어떤 활동을 하셨나요? (복수 선택)',
    },
    {
      key: 'field',
      label: 'Q2.',
      title: '2. 프로젝트 분야',
      subtitle: '어떤 분야를 다루셨나요?',
    },
    {
      key: 'tools',
      label: 'Q3.',
      title: '2. 프로젝트 분야',
      subtitle: ' 주로 활용한 기술 스택을 선택해주세요.(복수 선택 가능)',
    },
    {
      key: 'roles',
      label: 'Q1.',
      title: '3. 본인 역할',
      subtitle: '어떤 역할을 담당하셨나요?',
    },
    {
      key: 'motivation',
      label: 'Q1.',
      title: '4. 프로젝트 개요',
      subtitle: '왜 만들었나요? (문제 정의)',
    },
    {
      key: 'techChoice',
      label: 'Q2.',
      title: '4. 프로젝트 개요',
      subtitle: '왜 이 기술 조합을 선택했나요?',
    },
    {
      key: 'architecture',
      label: 'Q3.',
      title: '4. 프로젝트 개요',
      subtitle: '아키텍처 설계 및 과정 (문제·솔루션 각 3개 이하)',
    },
    {
      key: 'result',
      label: 'Q4.',
      title: '4. 프로젝트 개요',
      subtitle: '결과물 (수치화 필수)',
    },
    {
      key: 'retro',
      label: 'Q5.',
      title: '4. 프로젝트 개요',
      subtitle: '회고 (잘된 점 / 아쉬운 점 / 바꿀 점)',
    },
    {
      key: 'contribution',
      label: 'Q1.',
      title: '5. 본인 참여 활동',
      subtitle: '주도한 핵심 파트',
    },
    {
      key: 'domainCheck',
      label: 'Q1.',
      title: '6. 도메인',
      subtitle: '이 프로젝트는 특정 도메인을 포함하나요?',
    },
  ];
  if (hasDomain) {
    arr.push(
      {
        key: 'domainTags',
        label: 'Q2.',
        title: '6. 도메인',
        subtitle: '도메인을 선택해주세요.',
      },
      {
        key: 'domainExpertise',
        label: 'Q3.',
        title: '6. 도메인',
        subtitle: '도메인 전문성을 어떻게 확보했나요?',
      },
      {
        key: 'domainComm',
        label: 'Q4.',
        title: '6. 도메인',
        subtitle: '도메인 전문가와 어떻게 소통했나요?',
      },
      {
        key: 'domainLimits',
        label: 'Q5.',
        title: '6. 도메인',
        subtitle: '한계와 향후 개선 방향은?',
      },
    );
  }
  arr.push(
    {
      key: 'deliverables',
      label: 'Q1.',
      title: '7. 결과물 / 배포물',
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
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get('id');
  const editId =
    editIdParam !== null && Number.isFinite(Number(editIdParam))
      ? Number(editIdParam)
      : null;
  const isEdit = editId !== null;

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [phase, setPhase] = useState<'loading' | 'resume' | 'form'>('loading');
  const [toast, setToast] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(draft.hasDomain), [draft.hasDomain]);
  const stepIdx = Math.min(Math.max(draft.stepIdx, 0), steps.length - 1);
  const stepCfg = steps[stepIdx];
  const isLast = stepCfg.key === 'summary';
  const isLastInput = stepIdx === steps.length - 2;

  // 초기 로드 — 수정 모드면 details 에서 답변 불러와 미리보기, 아니면 draft resume
  useEffect(() => {
    // 1) 수정 모드: 저장된 인터뷰 답변 불러오기
    if (isEdit) {
      try {
        const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
        const map: Record<string, Draft> = detailsRaw
          ? JSON.parse(detailsRaw)
          : {};
        const saved = map[String(editId)];
        if (saved) {
          // 마지막 단계(미리보기)로 이동시켜 작성한 답변을 같은 양식으로 보여줌
          const stepsForSaved = buildSteps(saved.hasDomain);
          setDraft({
            ...saved,
            stepIdx: stepsForSaved.length - 1,
          });
          setPhase('form');
          return;
        }
        // 인터뷰 details 가 없는 기존 항목 → 제목만 가져와서 처음부터
        const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
        const items: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
        const found = items.find((it) => it.id === editId);
        if (found) {
          setDraft({ ...EMPTY_DRAFT, name: found.title });
        }
      } catch {
        // 로드 실패 시 빈 폼
      }
      setPhase('form');
      return;
    }

    // 2) 신규 작성: 저장된 draft 가 있으면 resume 모달
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
  }, [isEdit, editId]);

  // 자동 저장
  // - 신규: draft 키에 자동 저장 (다음 진입 시 resume 가능)
  // - 수정: details 맵에 해당 id 자리를 직접 갱신 (즉시 반영)
  useEffect(() => {
    if (phase !== 'form') return;
    try {
      if (isEdit && editId !== null) {
        const raw = localStorage.getItem(DETAILS_STORAGE_KEY);
        const map: Record<string, Draft> = raw ? JSON.parse(raw) : {};
        map[String(editId)] = draft;
        localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(map));
      } else {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      }
    } catch {
      // 용량 초과 시 무시 — base64 이미지 누적 가능성
    }
  }, [draft, phase, isEdit, editId]);

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
      case 'tools':
        return draft.toolTags.length > 0;
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
    const targetId = isEdit && editId !== null ? editId : Date.now();
    const item: PortfolioItem = {
      id: targetId,
      type: 'project',
      title: draft.name.trim() || '(제목 없음)',
      description:
        draft.motivation.trim() ||
        draft.contribution.trim() ||
        draft.result.text.trim() ||
        '',
      period: '',
      current: false,
      domain:
        draft.hasDomain && draft.domainTags[0] ? draft.domainTags[0] : undefined,
      tags: Array.from(
        new Set([
          ...draft.activityTypes,
          ...draft.fieldTags,
          ...draft.toolTags,
          ...draft.roles,
        ]),
      ).filter(Boolean),
    };
    try {
      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const next = isEdit
        ? list.map((it) => (it.id === targetId ? item : it))
        : [...list, item];
      // 수정인데 list 에 없는 경우(이상 케이스)도 안전하게 추가
      const ensured =
        isEdit && !list.some((it) => it.id === targetId) ? [...next, item] : next;
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(ensured));
    } catch {
      // 무시
    }
    try {
      const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
      const map: Record<string, Draft> = detailsRaw
        ? JSON.parse(detailsRaw)
        : {};
      map[String(targetId)] = draft;
      localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(map));
    } catch {
      // 무시
    }
    if (!isEdit) {
      // 신규 저장 후엔 임시 draft 비우기 (수정은 draft 안 씀)
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // 무시
      }
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
        {/* 상단: 모드 배너 + 자동 저장 안내 */}
        <div
          style={{ marginTop: '2.5rem', marginBottom: '1rem' }}
          className="flex flex-wrap items-center justify-between gap-3 text-xs leading-relaxed"
        >
          {isEdit ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
              ✎ 수정 중
            </span>
          ) : (
            <span className="text-gray-400">
              입력하시는 내용은 자동으로 저장돼요.
            </span>
          )}
          <span className="text-gray-400">
            <span className="font-medium text-red-500">*</span> 표시는 필수
            항목입니다.
            {isEdit && ' · 변경 내용은 자동으로 저장됩니다.'}
          </span>
        </div>
        <div
          style={{ marginBottom: '1.25rem' }}
          className="flex items-center gap-3"
        >
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
            aria-label="여기까지 저장하고 나가기"
            title="여기까지 저장하고 나가기"
            style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
            className="ml-2 inline-flex items-center gap-2 rounded-full bg-white py-2 text-xs leading-relaxed text-gray-600 shadow-sm hover:bg-gray-100 hover:text-gray-800"
          >
            <span aria-hidden>✕</span>
            <span className="whitespace-nowrap font-medium">
              저장하고 나가기
            </span>
          </button>
        </div>

        {/* 단계 카드 — min-h 로 모든 단계 카드 크기 통일 (이전/다음 버튼 위치 고정) */}
        <div
          key={stepIdx}
          style={{ minHeight: '44rem' }}
          className="mocozi-step-in flex flex-col rounded-2xl bg-white p-8 shadow-sm sm:p-10"
        >
          {/* 분류 (예: 프로젝트 분야) — 작게, 회색 */}
          <h2
            style={{ marginBottom: '1rem' }}
            className="text-xs font-medium tracking-wide text-gray-500"
          >
            {stepCfg.title}
          </h2>
          {/* 실제 질문 — 크게, 검은색 볼드, 라벨 prefix + 필수 * */}
          {stepCfg.subtitle && (
            <p
              style={{ marginBottom: '1rem' }}
              className="text-lg font-bold leading-snug text-gray-900"
            >
              {stepCfg.label && (
                <span className="mr-2 text-gray-500">{stepCfg.label}</span>
              )}
              {stepCfg.subtitle}
              {isStepRequired(stepCfg.key) && (
                <span
                  className="ml-1.5 text-red-500"
                  aria-label="필수 항목"
                  title="필수 항목"
                >
                  *
                </span>
              )}
            </p>
          )}
          <div className="flex-1">
            <StepBody cfg={stepCfg} draft={draft} setDraft={setDraft} />
          </div>
        </div>

        {/* 하단 네비게이션 */}
        {!isLast ? (
          <div
            style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}
            className="flex items-center justify-between gap-2"
          >
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
          <div
            style={{ marginTop: '1.25rem', marginBottom: '2rem' }}
            className="flex items-center justify-between gap-2"
          >
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
              {isEdit ? '수정 완료' : '포트폴리오에 저장'}
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
          allowCustom
        />
      );
    case 'field':
      return (
        <CategorizedTagSelect
          categories={FIELD_TAGS}
          selected={draft.fieldTags}
          onChange={(v) => setDraft((d) => ({ ...d, fieldTags: v }))}
          previewLimit={TAG_PREVIEW_PER_CATEGORY}
          allowCustom
        />
      );
    case 'tools':
      return (
        <CategorizedTagSelect
          categories={TECH_STACK_TAGS}
          selected={draft.toolTags}
          onChange={(v) => setDraft((d) => ({ ...d, toolTags: v }))}
          previewLimit={TAG_PREVIEW_PER_CATEGORY}
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
  // 직접 입력 칸이 있을 땐 "기타" 옵션을 숨김 (사용자가 직접 입력하면 됨)
  const visibleOptions = allowCustom
    ? options.filter((o) => o !== '기타')
    : options;
  const customs = selected.filter((s) => !visibleOptions.includes(s));
  return (
    <div>
      <div
        style={{ rowGap: '1rem', columnGap: '0.625rem' }}
        className="flex flex-wrap"
      >
        {visibleOptions.map((opt) => {
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
        <div style={{ marginTop: '1rem' }} className="flex gap-2.5">
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
            placeholder="직접 입력 후 추가"
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

/** 카테고리(언어/프론트엔드/...)별로 묶어서 보여주는 태그 선택기.
 *  카테고리당 previewLimit 개만 노출하고 나머지는 "더보기"로 펼침.
 */
function CategorizedTagSelect({
  categories,
  selected,
  onChange,
  allowCustom,
  previewLimit = 5,
}: {
  categories: Record<string, readonly string[]>;
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  previewLimit?: number;
}) {
  const [custom, setCustom] = useState('');

  const toggle = (v: string) =>
    onChange(
      selected.includes(v)
        ? selected.filter((x) => x !== v)
        : [...selected, v],
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

  const knownTags = new Set(Object.values(categories).flat());
  const customs = selected.filter((s) => !knownTags.has(s));

  const chipBase =
    'rounded-full border px-4 py-2.5 text-sm leading-relaxed transition-all';
  const chipOn = 'border-blue-500 bg-blue-500 text-white';
  const chipOff =
    'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50';

  return (
    <div className="flex flex-col" style={{ rowGap: '1rem' }}>
      {Object.entries(categories).map(([cat, tags]) => {
        // 더보기 없이 항상 previewLimit 개로 제한 (카드 높이 일정 유지)
        const visible = tags.slice(0, previewLimit);
        return (
          <div key={cat}>
            <h3
              style={{ marginBottom: '0.5rem' }}
              className="text-[10px] font-semibold uppercase tracking-wider text-gray-400"
            >
              {cat}
            </h3>
            <div
              style={{ rowGap: '0.625rem', columnGap: '0.625rem' }}
              className="flex flex-wrap items-center"
            >
              {visible.map((opt) => {
                const on = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(opt)}
                    className={`${chipBase} ${on ? chipOn : chipOff}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {customs.length > 0 && (
        <div>
          <h3
            style={{ marginBottom: '0.5rem' }}
            className="text-[10px] font-semibold uppercase tracking-wider text-gray-400"
          >
            직접 추가
          </h3>
          <div
            style={{ rowGap: '0.625rem', columnGap: '0.625rem' }}
            className="flex flex-wrap items-center"
          >
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
        </div>
      )}

      {allowCustom && (
        <div style={{ marginTop: '0.25rem' }} className="flex gap-2.5">
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
            placeholder="목록에 없으면 직접 입력 후 추가"
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
        <p
          style={{ marginBottom: '1rem' }}
          className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-7 text-amber-700"
        >
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

      <div
        style={{ marginTop: '1rem', rowGap: '1rem', columnGap: '0.625rem' }}
        className="flex flex-wrap items-center"
      >
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

      <p
        style={{ marginTop: '1rem' }}
        className="text-xs leading-7 text-gray-400"
      >
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
    if (draft.toolTags.length)
      lines.push(`**프로그램:** ${draft.toolTags.join(', ')}`);
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

  const tags = [
    ...draft.activityTypes,
    ...draft.fieldTags,
    ...draft.toolTags,
    ...draft.roles,
  ];

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
