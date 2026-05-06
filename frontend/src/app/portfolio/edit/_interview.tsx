'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PortfolioItem } from '../page';

// ─────── Storage keys ───────
const ITEMS_STORAGE_KEY = 'mock_portfolio_items';
const DETAILS_STORAGE_KEY = 'mock_portfolio_details';

// ─────── Types ───────
/** 시각 자료가 첨부될 수 있는 단계 — 각 단계의 자료는 다른 단계와 격리됨 */
export type AssetStepKey = 'architecture' | 'result' | 'retro';

export type Asset = {
  id: string;
  alias: string; // stepKey 단위로만 유일 (단계가 다르면 같은 alias 가능)
  filename: string;
  dataUrl: string;
  stepKey: AssetStepKey;
};

export type Block = { text: string; assetIds: string[] };

export type ProjectPeriod = {
  startYear: string;
  startMonth: string;
  startDay: string; // 선택
  endYear: string;
  endMonth: string;
  endDay: string; // 선택
  current: boolean;
};

const EMPTY_PERIOD: ProjectPeriod = {
  startYear: '',
  startMonth: '',
  startDay: '',
  endYear: '',
  endMonth: '',
  endDay: '',
  current: false,
};

/** 본문 섹션 키 — 미리보기에서 위/아래로 순서 변경 가능 */
export type BodySectionKey =
  | 'motivation'
  | 'techChoice'
  | 'architecture'
  | 'result'
  | 'retro'
  | 'contribution';

export const DEFAULT_BODY_ORDER: BodySectionKey[] = [
  'motivation',
  'techChoice',
  'architecture',
  'result',
  'retro',
  'contribution',
];

export const BODY_SECTION_LABEL: Record<BodySectionKey, string> = {
  motivation: '문제 정의',
  techChoice: '기술 스택 선정 배경',
  architecture: '아키텍처 설계 및 과정',
  result: '결과물',
  retro: '회고',
  contribution: '본인 참여 활동',
};

export type Draft = {
  name: string;
  /** 카드/미리보기에 표시할 대표 이미지 (data URL). 없으면 빈 문자열 */
  thumbnail: string;
  /** 본문 섹션의 표시 순서. 사용자가 위/아래로 옮긴 결과를 저장. */
  bodySectionOrder?: BodySectionKey[];
  period: ProjectPeriod;
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
  deliverableFiles: Omit<Asset, 'stepKey'>[];
  assets: Asset[];
  stepIdx: number;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  thumbnail: '',
  period: EMPTY_PERIOD,
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

// ─────── 작성 예시 (포트폴리오를 처음 작성해보는 사용자를 위한 가이드) ───────
// 줄글 단계: 회색 박스로 textarea 위에 표시
// 선택 단계: 작은 회색 글씨로 옵션 위에 표시
const EXAMPLES: Partial<Record<StepKey, string>> = {
  name: 'MediScan — 흉부 X-ray 기반 폐 질환 자동 탐지 시스템',
  period: '2024년 3월 15일 ~ 2024년 9월 (진행 중인 경우 "진행중"을 체크해주세요)',
  activity: '팀 프로젝트, 공모전',
  field: 'CV, MLOps',
  tools: 'Python, PyTorch, OpenCV, FastAPI, Docker, AWS',
  roles: 'ML Engineer, BE',
  motivation:
    '흉부 X-ray 판독은 영상의학과 전문의가 부족한 지역병원에서 병목이 발생한다. 실제로 국내 2차 의료기관의 42%가 영상 판독 지연(평균 18시간)을 겪고 있다. 이를 AI로 1차 스크리닝해 판독 우선순위를 제안하는 보조 도구가 필요하다고 판단했다.',
  techChoice:
    '• PyTorch + EfficientNet-B4: 의료 영상 벤치마크(CheXpert)에서 검증된 경량 모델. 동일 성능 대비 ResNet-50 대비 파라미터 60% 절감.\n• FastAPI: 병원 내 PACS 시스템과 REST 연동이 필요해 경량 비동기 서버 선택.\n• Docker + AWS ECS: 병원마다 다른 인프라 환경을 컨테이너로 추상화.',
  architecture:
    '[설계] DICOM → 전처리 파이프라인 → EfficientNet 분류 → 히트맵(Grad-CAM) 오버레이 → 판독 보조 리포트 생성 순서로 처리 흐름 설계.\n[문제 1] 폐 병변 데이터 클래스 불균형(정상 7:비정상 3)\n→ Focal Loss + 오버샘플링(SMOTE) 조합으로 F1 +0.11 개선.',
  result:
    '• 폐 결절 탐지 AUROC 0.924 (전문의 기준선 0.891 대비 +3.3%p)\n• 평균 판독 보조 소요 시간 1.2초/장 (기존 대비 약 900배 단축)\n• 파트너 병원 2곳 파일럿 적용, 판독 우선순위 정확도 91.3%\n• 공모전 최우수상 수상 (한국의료AI학회 주관)',
  retro:
    '[잘 된 점] 초기부터 임상의와 주 1회 리뷰 세션을 가진 덕분에 히트맵 시각화 방향이 실제 판독 흐름과 맞았다.\n[아쉬운 점] 외부 데이터셋(NIH ChestX-ray14)으로만 학습해 국내 환자 데이터 분포와 괴리가 있었다. 실환경 파일럿 후 재학습 필요.\n[개선한다면] 모델 성능보다 설명 가능성(XAI) 설계를 먼저 잡겠다. 임상의 신뢰 확보가 실제 도입의 핵심이었다.',
  contribution:
    '전처리 파이프라인과 모델 학습 전 과정을 단독 담당. 특히 DICOM 포맷의 HU값 정규화 및 Lung segmentation 전처리에서 팀 내 노하우가 없어 논문 3편을 직접 재현하며 최적 방식을 찾았다. 또한 FastAPI 추론 서버를 설계해 팀원들이 프론트에서 바로 결과를 확인할 수 있는 내부 데모 환경을 구축했다.',
  domainTags: '의료',
  domainExpertise:
    '영상의학과 레지던트 1인과 협업해 병변 라벨링 기준을 정의했다. DICOM 포맷의 HU(Hounsfield Unit) 값의 의미와 폐창(Lung Window) 설정 방식을 직접 학습해 전처리에 반영했다.',
  domainComm:
    '매주 30분 영상의학과 전공의와 리뷰 세션 진행. AI가 강조하는 영역이 실제 판독 포인트와 다를 때 그 이유를 논의하며 Grad-CAM 레이어 선택 기준을 수정했다. 초반에는 "정확도"로 소통했는데, 임상 현장에선 "민감도(Sensitivity)"가 더 중요한 지표임을 배웠다.',
  domainLimits:
    '병변 크기(nodule size) 기준이나 Fleischner 가이드라인 같은 도메인 지식이 없어 초반 라벨 분류 기준을 잘못 설정했다. 전문의 피드백 후 전체 라벨 재정의에 2주가 소요됐다. → 도메인 용어집 먼저 정리하고 시작하는 것이 필요하다고 느꼈다.',
};

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

const isPeriodEmpty = (p: ProjectPeriod) =>
  !p.startYear &&
  !p.startMonth &&
  !p.startDay &&
  !p.endYear &&
  !p.endMonth &&
  !p.endDay &&
  !p.current;

/** "2024.03 - 2024.06" / "2024.03.15 - 현재" 형태로 포맷 */
const formatPeriod = (p: ProjectPeriod): string => {
  if (!p.startYear || !p.startMonth) return '';
  const start =
    `${p.startYear}.${p.startMonth.padStart(2, '0')}` +
    (p.startDay ? `.${p.startDay.padStart(2, '0')}` : '');
  if (p.current) return `${start} - 현재`;
  if (!p.endYear || !p.endMonth) return start;
  const end =
    `${p.endYear}.${p.endMonth.padStart(2, '0')}` +
    (p.endDay ? `.${p.endDay.padStart(2, '0')}` : '');
  return `${start} - ${end}`;
};

const isDraftEmpty = (d: Draft) =>
  !d.name &&
  isPeriodEmpty(d.period) &&
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
  | 'period'
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
      title: '1. 기본 정보',
      subtitle: '어떤 프로젝트인가요?',
    },
    {
      key: 'period',
      label: 'Q2.',
      title: '1. 기본 정보',
      subtitle: '진행한 날짜를 선택해주세요.',
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
      subtitle: '회고 (잘된 점 / 아쉬운 점 / 개선할 점)',
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

// ─────── Markdown 렌더러 (간단한 인라인/블록 파서) ───────
// 지원: ## h3, # h2, **bold**, `code`, ![alt](src) 이미지, [text](url) 링크,
//       "- " bullet, 빈 줄 = 문단 구분
export function renderInlineMd(text: string): ReactNode {
  if (!text) return null;
  const tokens: ReactNode[] = [];
  const re =
    /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    }
    const t = m[0];
    if (t.startsWith('![')) {
      const im = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (im) {
        tokens.push(
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key++}
            src={im[2]}
            alt={im[1]}
            className="my-2 max-w-full rounded-lg border border-gray-200"
          />,
        );
      }
    } else if (t.startsWith('[')) {
      const lm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) {
        tokens.push(
          <a
            key={key++}
            href={lm[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {lm[1]}
          </a>,
        );
      }
    } else if (t.startsWith('**')) {
      const bm = t.match(/^\*\*([^*]+)\*\*$/);
      if (bm)
        tokens.push(
          <strong key={key++} className="font-semibold">
            {bm[1]}
          </strong>,
        );
    } else if (t.startsWith('*')) {
      const im2 = t.match(/^\*([^*\n]+)\*$/);
      if (im2)
        tokens.push(
          <em key={key++} className="italic">
            {im2[1]}
          </em>,
        );
    } else if (t.startsWith('`')) {
      const cm = t.match(/^`([^`]+)`$/);
      if (cm)
        tokens.push(
          <code
            key={key++}
            className="rounded bg-gray-100 px-1 font-mono text-[0.9em] text-gray-800"
          >
            {cm[1]}
          </code>,
        );
    } else if (/^https?:\/\//.test(t)) {
      // 평문 URL — 끝의 흔한 문장부호는 링크에 포함하지 않고 뒤로 흘려보낸다
      const trail = t.match(/[.,;:!?\]]+$/);
      const trailLen = trail ? trail[0].length : 0;
      const url = trailLen ? t.slice(0, -trailLen) : t;
      tokens.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {url}
        </a>,
      );
      if (trailLen) {
        tokens.push(<span key={key++}>{t.slice(-trailLen)}</span>);
      }
    }
    last = m.index + t.length;
  }
  if (last < text.length) {
    tokens.push(<span key={key++}>{text.slice(last)}</span>);
  }
  return tokens;
}

export function renderMarkdown(text: string): ReactNode[] {
  if (!text) return [];
  // 앞/뒤 빈 줄로 인해 spacer div(.h-2) 가 섹션 양 끝에 남는 것을 방지
  const trimmed = text.replace(/^[\s\n]+/, '').replace(/[\s\n]+$/, '');
  if (!trimmed) return [];
  const lines = trimmed.split('\n');
  const out: ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length === 0) return;
    out.push(
      <ul
        key={`list-${out.length}`}
        className="my-1 list-disc space-y-1 pl-5"
      >
        {listBuf.map((item, i) => (
          <li key={i}>{renderInlineMd(item)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('## ')) {
      flushList();
      out.push(
        <h3
          key={`h3-${i}`}
          className="mt-3 mb-1 text-lg font-bold text-gray-900"
        >
          {renderInlineMd(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      flushList();
      out.push(
        <h2
          key={`h2-${i}`}
          className="mt-3 mb-1 text-xl font-bold text-gray-900"
        >
          {renderInlineMd(line.slice(2))}
        </h2>,
      );
    } else if (line.startsWith('- ')) {
      listBuf.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
      out.push(<div key={`sp-${i}`} className="h-2" />);
    } else {
      flushList();
      out.push(
        <p key={`p-${i}`} className="my-1 leading-7">
          {renderInlineMd(line)}
        </p>,
      );
    }
  });
  flushList();
  return out;
}

// ─────── 블록 기반 본문 모델 ───────
// 노션처럼 각 줄/문단/이미지를 블록 단위로 관리. 저장은 기존 string 필드를 그대로 사용
// (parseBlocks ↔ serializeBlocks 로 라운드트립)
export type BlockText =
  | { id: string; type: 'p' | 'h2' | 'h3' | 'li'; text: string };
export type BlockImg = {
  id: string;
  type: 'img';
  src: string;
  alt: string;
};
export type BlockFile = {
  id: string;
  type: 'file';
  src: string;
  filename: string;
};
export type ContentBlock = BlockText | BlockImg | BlockFile;

const genBlockId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function parseBlocks(text: string): ContentBlock[] {
  if (!text || !text.trim()) return [];
  const lines = text.split('\n');
  const blocks: ContentBlock[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') continue;
    if (line.startsWith('## ')) {
      blocks.push({ id: genBlockId(), type: 'h3', text: line.slice(3) });
    } else if (line.startsWith('# ')) {
      blocks.push({ id: genBlockId(), type: 'h2', text: line.slice(2) });
    } else if (line.startsWith('- ')) {
      blocks.push({ id: genBlockId(), type: 'li', text: line.slice(2) });
    } else {
      const im = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const fi = line.match(/^📎\[([^\]]+)\]\(([^)]+)\)$/);
      if (im) {
        blocks.push({ id: genBlockId(), type: 'img', src: im[2], alt: im[1] });
      } else if (fi) {
        blocks.push({ id: genBlockId(), type: 'file', filename: fi[1], src: fi[2] });
      } else {
        blocks.push({ id: genBlockId(), type: 'p', text: line });
      }
    }
  }
  return blocks;
}

export function serializeBlocks(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'p':
          return b.text;
        case 'h2':
          return `# ${b.text}`;
        case 'h3':
          return `## ${b.text}`;
        case 'li':
          return `- ${b.text}`;
        case 'img':
          return `![${b.alt}](${b.src})`;
        case 'file':
          return `📎[${b.filename}](${b.src})`;
      }
    })
    .join('\n\n');
}

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
  const [phase, setPhase] = useState<'loading' | 'form'>('loading');
  const [toast, setToast] = useState<string | null>(null);
  /** 신규/수정 양쪽에서 단일 ID로 ITEMS·DETAILS 저장. 신규는 진입 시 1회 발급. */
  const [projectId, setProjectId] = useState<number | null>(null);
  /** 진입 시점의 초기 스냅샷 — "저장하지 않고 나가기" 시 복원에 사용.
   *  편집 모드: 저장된 detail; 신규 모드: null (해당 ID 데이터 자체를 제거). */
  const initialDetailRef = useRef<Draft | null>(null);
  /** 자동 저장 차단 플래그 — discard 진행 중에는 저장 effect 가 다시 덮어쓰지 못하게. */
  const discardingRef = useRef(false);
  /** 임시저장 목록 팝업 */
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [draftsList, setDraftsList] = useState<PortfolioItem[]>([]);

  const steps = useMemo(() => buildSteps(draft.hasDomain), [draft.hasDomain]);
  const stepIdx = Math.min(Math.max(draft.stepIdx, 0), steps.length - 1);
  const stepCfg = steps[stepIdx];
  const isLast = stepCfg.key === 'summary';
  const isLastInput = stepIdx === steps.length - 2;

  /** draft → PortfolioItem 변환 (저장용) */
  const buildItem = (id: number, d: Draft): PortfolioItem => ({
    id,
    type: 'project',
    title: d.name.trim() || '(제목 없음)',
    description:
      d.motivation.trim() ||
      d.contribution.trim() ||
      d.result.text.trim() ||
      '',
    period: formatPeriod(d.period),
    current: d.period.current,
    domain: d.hasDomain && d.domainTags[0] ? d.domainTags[0] : undefined,
    tags: Array.from(
      new Set([
        ...d.activityTypes,
        ...d.fieldTags,
        ...d.toolTags,
        ...d.roles,
      ]),
    ).filter(Boolean),
    thumbnail: d.thumbnail || undefined,
  });

  // 초기 로드 — 수정 모드면 저장된 답변 로드, 신규면 새 ID 발급
  useEffect(() => {
    if (isEdit && editId !== null) {
      // 프로젝트가 아닌 항목(연구·스터디 등)이 잘못 라우팅된 경우 해당 폼으로 즉시 이동.
      // 그렇지 않으면 아래 자동저장이 type 을 'project' 로 덮어쓰게 됨.
      try {
        const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
        const items: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
        const existing = items.find((it) => it.id === editId);
        if (existing && existing.type !== 'project') {
          router.replace(
            `/portfolio/edit?id=${editId}&type=${existing.type}`,
          );
          return;
        }
      } catch {
        // 무시 — 정상 흐름 진행
      }
      setProjectId(editId);
      try {
        const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
        const map: Record<string, Draft> = detailsRaw
          ? JSON.parse(detailsRaw)
          : {};
        const saved = map[String(editId)];
        if (saved) {
          // 원본 스냅샷 보관 — "저장하지 않고 나가기" 시 복원
          initialDetailRef.current = JSON.parse(JSON.stringify(saved)) as Draft;
          const stepsForSaved = buildSteps(saved.hasDomain);
          setDraft({
            ...EMPTY_DRAFT,
            ...saved,
            period: { ...EMPTY_PERIOD, ...(saved.period ?? {}) },
            assets: (saved.assets ?? []).map((a) => ({
              ...a,
              stepKey: a.stepKey ?? 'architecture',
            })),
            stepIdx: stepsForSaved.length - 1,
          });
          setPhase('form');
          return;
        }
        // details 없는 기존 항목 → 제목만 복원
        const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
        const items: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
        const found = items.find((it) => it.id === editId);
        if (found) {
          setDraft({
            ...EMPTY_DRAFT,
            name: found.title,
            thumbnail: found.thumbnail ?? '',
          });
        }
      } catch {
        // 무시
      }
      setPhase('form');
      return;
    }
    // 신규: 매번 새 ID 발급 (이전 작성 건은 별도 항목으로 보존됨)
    setProjectId(Date.now());
    setPhase('form');
  }, [isEdit, editId, router]);

  // 자동 저장 — projectId 슬롯에 항상 ITEMS+DETAILS 동기 저장
  // (빈 draft 는 저장 안 함 — 빈 placeholder 항목 방지)
  // 기간이 잘못된 경우(종료<시작) ITEMS 갱신은 건너뜀 — 잘못된 기간이 카드에 노출되는 것 방지
  useEffect(() => {
    if (phase !== 'form' || projectId === null) return;
    if (discardingRef.current) return;
    if (isDraftEmpty(draft)) return;
    try {
      // DETAILS 는 입력 보존을 위해 항상 저장
      const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
      const map: Record<string, Draft> = detailsRaw
        ? JSON.parse(detailsRaw)
        : {};
      map[String(projectId)] = draft;
      localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(map));

      // 기간이 잘못된 동안에는 ITEMS 를 건드리지 않음 (기존 유효 값 보존)
      const p = draft.period;
      const periodBad =
        !p.current &&
        !!p.startYear &&
        !!p.startMonth &&
        !!p.endYear &&
        !!p.endMonth &&
        Number(p.endYear) * 100 + Number(p.endMonth) <
          Number(p.startYear) * 100 + Number(p.startMonth);
      if (periodBad) return;

      const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
      const item = buildItem(projectId, draft);
      const exists = list.some((it) => it.id === projectId);
      const nextList = exists
        ? // 기존 draft 플래그/featured 등을 유지한 채 입력 내용만 갱신
          list.map((it) => (it.id === projectId ? { ...it, ...item } : it))
        : // 신규는 임시저장 (draft=true) 으로 시작
          [...list, { ...item, draft: true }];
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // 용량 초과 시 무시 — base64 이미지 누적 가능성
    }
  }, [draft, phase, projectId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  /** 기간 검증 — 진행중이 아닐 때 종료 < 시작 이면 invalid (YYYYMM 비교) */
  const periodInvalid = (() => {
    const p = draft.period;
    if (p.current) return false;
    if (!p.startYear || !p.startMonth || !p.endYear || !p.endMonth) return false;
    const s = Number(p.startYear) * 100 + Number(p.startMonth);
    const e = Number(p.endYear) * 100 + Number(p.endMonth);
    return e < s;
  })();

  const handleClose = () => {
    if (periodInvalid) {
      // 잘못된 기간으로 나가는 것 차단 — 기간 단계로 이동시켜 수정 유도
      showToast('종료 날짜는 시작 날짜 이후여야 합니다.');
      const idx = steps.findIndex((s) => s.key === 'period');
      if (idx >= 0) setDraft((d) => ({ ...d, stepIdx: idx }));
      return;
    }
    // 자동 저장이 이미 ITEMS+DETAILS 를 갱신했으므로 그대로 나가면 됨
    showToast(isEdit ? '수정 내용이 저장되었습니다.' : '저장되었습니다.');
    setTimeout(() => router.push('/portfolio'), 700);
  };

  /** 저장하지 않고 나가기 — 자동 저장으로 덮어써진 내용을 진입 시점 스냅샷으로
   *  복원(편집)하거나 통째로 제거(신규)한 뒤 목록으로 이동. */
  const handleDiscardAndExit = () => {
    const msg = isEdit
      ? '수정 내용을 저장하지 않고 나갑니다. 변경사항은 사라져요.\n계속할까요?'
      : '작성한 내용을 저장하지 않고 나갑니다. 작성 중인 항목은 사라져요.\n계속할까요?';
    if (!confirm(msg)) return;

    discardingRef.current = true;
    try {
      if (projectId !== null) {
        const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
        const detailMap: Record<string, Draft> = detailsRaw
          ? JSON.parse(detailsRaw)
          : {};
        const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
        const itemList: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];

        if (isEdit && initialDetailRef.current) {
          // 편집 모드: details 는 원본 스냅샷으로 되돌리고, items 는 그 스냅샷으로 다시 빌드
          detailMap[String(projectId)] = initialDetailRef.current;
          const restoredItem = buildItem(projectId, initialDetailRef.current);
          const nextItems = itemList.map((it) =>
            it.id === projectId ? { ...it, ...restoredItem } : it,
          );
          localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems));
          localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(detailMap));
        } else {
          // 신규 모드: 진입 후 만들어졌을 수 있는 항목/상세를 통째로 제거
          delete detailMap[String(projectId)];
          const nextItems = itemList.filter((it) => it.id !== projectId);
          localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextItems));
          localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(detailMap));
        }
      }
    } catch {
      // 저장 실패는 무시 — 어차피 페이지를 떠남
    }
    router.push('/portfolio');
  };

  /** 임시저장 목록 모달 열기 — 현재 작업 중인 항목은 제외 */
  const openDraftsModal = () => {
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : [];
      setDraftsList(
        list
          .filter((it) => it.draft && it.id !== projectId)
          .sort((a, b) => b.id - a.id),
      );
    } catch {
      setDraftsList([]);
    }
    setDraftsModalOpen(true);
  };

  const deleteDraftItem = (id: number) => {
    if (!confirm('이 임시저장을 삭제하시겠어요?')) return;
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      const list: PortfolioItem[] = raw ? JSON.parse(raw) : [];
      const next = list.filter((it) => it.id !== id);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(next));
      // details 도 같이 정리
      const detailsRaw = localStorage.getItem(DETAILS_STORAGE_KEY);
      if (detailsRaw) {
        const map: Record<string, Draft> = JSON.parse(detailsRaw);
        delete map[String(id)];
        localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(map));
      }
      setDraftsList((prev) => prev.filter((it) => it.id !== id));
    } catch {
      // 무시
    }
  };

  const next = () =>
    setDraft((d) => ({
      ...d,
      stepIdx: Math.min(d.stepIdx + 1, steps.length - 1),
    }));
  const prev = () =>
    setDraft((d) => ({ ...d, stepIdx: Math.max(d.stepIdx - 1, 0) }));

  /** 미리보기에서 질문을 클릭하면 해당 단계로 이동 */
  const jumpToStep = (key: StepKey) => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx >= 0) setDraft((d) => ({ ...d, stepIdx: idx }));
  };

  // 현재 step 의 유효성
  const isStepValid = useMemo(() => {
    switch (stepCfg.key) {
      case 'name':
        return draft.name.trim().length > 0;
      case 'period': {
        const p = draft.period;
        if (!p.startYear || !p.startMonth) return false;
        if (!p.current && (!p.endYear || !p.endMonth)) return false;
        // 종료가 시작보다 빠르면 무효 (일 무시, YYYYMM 비교)
        if (!p.current && p.endYear && p.endMonth) {
          const s = Number(p.startYear) * 100 + Number(p.startMonth);
          const e = Number(p.endYear) * 100 + Number(p.endMonth);
          if (e < s) return false;
        }
        return true;
      }
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

  /** 미리보기의 "포트폴리오에 저장" / "수정 완료" — draft 플래그 해제 후 이동 */
  const handleSaveProject = () => {
    if (periodInvalid) {
      showToast('종료 날짜는 시작 날짜 이후여야 합니다.');
      const idx = steps.findIndex((s) => s.key === 'period');
      if (idx >= 0) setDraft((d) => ({ ...d, stepIdx: idx }));
      return;
    }
    if (projectId !== null) {
      try {
        const itemsRaw = localStorage.getItem(ITEMS_STORAGE_KEY);
        const list: PortfolioItem[] = itemsRaw ? JSON.parse(itemsRaw) : [];
        const nextList = list.map((it) =>
          it.id === projectId ? { ...it, draft: false } : it,
        );
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(nextList));
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

      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-2xl flex-col justify-center px-6 py-2 sm:px-10 sm:py-2">
        {/* 상단: 모드 배너 + 자동 저장 안내 */}
        <div
          style={{ marginTop: '1rem', marginBottom: '0.5rem' }}
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
            onClick={openDraftsModal}
            aria-label="임시저장 목록"
            title="임시저장 목록"
            style={{ paddingLeft: '0.875rem', paddingRight: '0.875rem' }}
            className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-white py-2 text-xs leading-relaxed text-amber-700 shadow-sm hover:bg-amber-50"
          >
            <span aria-hidden>📂</span>
            <span className="whitespace-nowrap font-medium">임시저장</span>
          </button>
          <button
            type="button"
            onClick={handleDiscardAndExit}
            aria-label="저장하지 않고 나가기"
            title="저장하지 않고 나가기 — 변경사항이 사라집니다"
            style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
            className="ml-2 inline-flex items-center gap-2 rounded-full bg-white py-2 text-xs leading-relaxed text-red-600 shadow-sm hover:bg-red-50 hover:text-red-700"
          >
            <span aria-hidden>↩</span>
            <span className="whitespace-nowrap font-medium">
              저장하지 않고 나가기
            </span>
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label={isEdit ? '편집 완료' : '여기까지 저장하고 나가기'}
            title={isEdit ? '편집 완료' : '여기까지 저장하고 나가기'}
            style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
            className="ml-2 inline-flex items-center gap-2 rounded-full bg-white py-2 text-xs leading-relaxed text-gray-600 shadow-sm hover:bg-gray-100 hover:text-gray-800"
          >
            <span aria-hidden>{isEdit ? '✓' : '✕'}</span>
            <span className="whitespace-nowrap font-medium">
              {isEdit ? '편집 완료' : '저장하고 나가기'}
            </span>
          </button>
        </div>

        {/* 단계 카드 — min-h 로 모든 단계 카드 크기 통일 (이전/다음 버튼 위치 고정) */}
        <div
          key={stepIdx}
          style={{ minHeight: '30rem' }}
          className="mocozi-step-in flex flex-col rounded-2xl bg-white p-8 shadow-sm sm:p-6"
          onKeyDown={(e) => {
            // Enter 로 다음 단계 이동 — 작성된 질문에서 빠르게 진행
            if (e.key !== 'Enter') return;
            if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
            // 내부에서 처리한 Enter (예: 태그 직접 입력 추가) 는 건너뜀
            if (e.defaultPrevented) return;
            const target = e.target as HTMLElement | null;
            // textarea 의 Enter 는 줄바꿈으로 보존
            if (target?.tagName === 'TEXTAREA') return;
            if (!isStepValid) return;
            if (isLast) return;
            e.preventDefault();
            next();
          }}
        >
          {/* 분류 (예: 프로젝트 분야) — 작게, 회색 */}
          <h2
            style={{ marginBottom: '1rem' }}
            className="text-xs font-medium tracking-wide text-gray-500"
          >
            {stepCfg.title}
          </h2>
          {/* 실제 질문 — 크게, 검은색 볼드, 라벨 prefix + 필수 *.
              미리보기 단계에서는 우측에 메타 수정 버튼을 함께 표시 */}
          {stepCfg.subtitle && (
            <div
              style={{
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <p
                style={{ minWidth: 0, flex: '1 1 auto', margin: 0 }}
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
            </div>
          )}
          <div className="flex-1">
            <StepBody
              cfg={stepCfg}
              draft={draft}
              setDraft={setDraft}
              jumpToStep={jumpToStep}
            />
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
              질문으로 돌아가기
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

      {/* ─────── 임시저장 목록 모달 ─────── */}
      {draftsModalOpen && (
        <div
          onClick={() => setDraftsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6 py-8 sm:px-10"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h3 className="text-lg font-bold text-gray-900">
                임시저장 목록{' '}
                <span className="text-sm font-normal text-gray-400">
                  ({draftsList.length})
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setDraftsModalOpen(false)}
                aria-label="닫기"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {draftsList.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">
                  다른 임시저장 항목이 없어요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {draftsList.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-3 transition-all hover:border-amber-300 hover:bg-amber-50"
                    >
                      <div
                        className={`shrink-0 overflow-hidden rounded-lg border ${
                          it.thumbnail
                            ? 'border-gray-200'
                            : 'border-dashed border-gray-200 bg-white'
                        }`}
                        style={{ width: '3rem', height: '3rem' }}
                        aria-hidden
                      >
                        {it.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftsModalOpen(false);
                          router.push(
                            `/portfolio/edit?id=${it.id}&type=${it.type}`,
                          );
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium text-gray-900">
                          {it.title || '(제목 없음)'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {it.description || '아직 작성 중인 프로젝트'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDraftItem(it.id)}
                        aria-label="임시저장 삭제"
                        title="임시저장 삭제"
                        className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
  jumpToStep,
}: {
  cfg: StepCfg;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  jumpToStep: (key: StepKey) => void;
}) {
  switch (cfg.key) {
    case 'name':
      return (
        <>
          {EXAMPLES.name && <ChoiceExample text={EXAMPLES.name} />}
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
          <ThumbnailPicker
            value={draft.thumbnail}
            onChange={(v) => setDraft((d) => ({ ...d, thumbnail: v }))}
          />
        </>
      );
    case 'period':
      return (
        <>
          {EXAMPLES.period && <ChoiceExample text={EXAMPLES.period} />}
          <PeriodPicker
            period={draft.period}
            onChange={(p) => setDraft((d) => ({ ...d, period: p }))}
          />
        </>
      );
    case 'activity':
      return (
        <>
          {EXAMPLES.activity && <ChoiceExample text={EXAMPLES.activity} />}
          <TagSelect
            options={ACTIVITY_OPTIONS}
            selected={draft.activityTypes}
            onChange={(v) => setDraft((d) => ({ ...d, activityTypes: v }))}
            allowCustom
          />
        </>
      );
    case 'field':
      return (
        <>
          {EXAMPLES.field && <ChoiceExample text={EXAMPLES.field} />}
          <CategorizedTagSelect
            categories={FIELD_TAGS}
            selected={draft.fieldTags}
            onChange={(v) => setDraft((d) => ({ ...d, fieldTags: v }))}
            previewLimit={TAG_PREVIEW_PER_CATEGORY}
            allowCustom
          />
        </>
      );
    case 'tools':
      return (
        <>
          {EXAMPLES.tools && <ChoiceExample text={EXAMPLES.tools} />}
          <CategorizedTagSelect
            categories={TECH_STACK_TAGS}
            selected={draft.toolTags}
            onChange={(v) => setDraft((d) => ({ ...d, toolTags: v }))}
            allowCustom
            scrollable
          />
        </>
      );
    case 'roles':
      return (
        <>
          {EXAMPLES.roles && <ChoiceExample text={EXAMPLES.roles} />}
          <TagSelect
            options={ROLE_OPTIONS}
            selected={draft.roles}
            onChange={(v) => setDraft((d) => ({ ...d, roles: v }))}
          />
        </>
      );
    case 'motivation':
      return (
        <SimpleTextarea
          value={draft.motivation}
          onChange={(v) => setDraft((d) => ({ ...d, motivation: v }))}
          showHint
          example={EXAMPLES.motivation}
          placeholder="해결하고 싶었던 문제, 사용자/맥락을 간결히 적어주세요."
        />
      );
    case 'techChoice':
      return (
        <SimpleTextarea
          value={draft.techChoice}
          onChange={(v) => setDraft((d) => ({ ...d, techChoice: v }))}
          example={EXAMPLES.techChoice}
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
          example={EXAMPLES.architecture}
          stepKey="architecture"
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
          example={EXAMPLES.result}
          stepKey="result"
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
          example={EXAMPLES.retro}
          stepKey="retro"
          placeholder="잘된 점 / 아쉬운 점 / 개선할 점"
        />
      );
    case 'contribution':
      return (
        <SimpleTextarea
          value={draft.contribution}
          onChange={(v) => setDraft((d) => ({ ...d, contribution: v }))}
          example={EXAMPLES.contribution}
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
        <>
          {EXAMPLES.domainTags && <ChoiceExample text={EXAMPLES.domainTags} />}
          <TagSelect
            options={DOMAIN_OPTIONS}
            selected={draft.domainTags}
            onChange={(v) => setDraft((d) => ({ ...d, domainTags: v }))}
            allowCustom
          />
        </>
      );
    case 'domainExpertise':
      return (
        <SimpleTextarea
          value={draft.domainExpertise}
          onChange={(v) => setDraft((d) => ({ ...d, domainExpertise: v }))}
          example={EXAMPLES.domainExpertise}
          placeholder="공부한 자료, 정보 출처, 학습 방법 등."
        />
      );
    case 'domainComm':
      return (
        <SimpleTextarea
          value={draft.domainComm}
          onChange={(v) => setDraft((d) => ({ ...d, domainComm: v }))}
          example={EXAMPLES.domainComm}
          placeholder="전문가 인터뷰, 협업 방식 등."
        />
      );
    case 'domainLimits':
      return (
        <SimpleTextarea
          value={draft.domainLimits}
          onChange={(v) => setDraft((d) => ({ ...d, domainLimits: v }))}
          example={EXAMPLES.domainLimits}
          placeholder="현재 결과물의 한계, 향후 보완 방향."
        />
      );
    case 'deliverables':
      return <DeliverablesStep draft={draft} setDraft={setDraft} />;
    case 'summary':
      return <SummaryView draft={draft} setDraft={setDraft} />;
    default:
      return null;
  }
}

// ─────── Sub-components ───────

// ─────── 기간 선택 (년/월 필수, 일 선택, 진행중 토글) ───────
const PERIOD_CURRENT_YEAR = new Date().getFullYear();
const PERIOD_YEAR_OPTIONS = Array.from(
  { length: 32 },
  (_, i) => PERIOD_CURRENT_YEAR + 1 - i, // 최신 연도가 위
);
const PERIOD_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** year/month 가 비어 있으면 31을 반환 (선택 전 폴백). month 는 1-indexed 문자열. */
const getDaysInMonth = (year: string, month: string): number => {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
};

function YearMonthDayPicker({
  year,
  month,
  day,
  onChange,
  disabled,
}: {
  year: string;
  month: string;
  day: string;
  onChange: (year: string, month: string, day: string) => void;
  disabled?: boolean;
}) {
  // 다른 단계의 input/태그와 동일한 높이·radius·포커스 링 사용
  const selectClass =
    'rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';

  const maxDays = getDaysInMonth(year, month);
  const dayOptions = Array.from({ length: maxDays }, (_, i) => i + 1);

  const handleYearChange = (newYear: string) => {
    const newMax = getDaysInMonth(newYear, month);
    onChange(newYear, month, day && Number(day) > newMax ? '' : day);
  };

  const handleMonthChange = (newMonth: string) => {
    const newMax = getDaysInMonth(year, newMonth);
    onChange(year, newMonth, day && Number(day) > newMax ? '' : day);
  };

  return (
    <div
      style={{ rowGap: '0.625rem', columnGap: '0.625rem' }}
      className="flex flex-wrap items-center"
    >
      <select
        value={year}
        onChange={(e) => handleYearChange(e.target.value)}
        disabled={disabled}
        aria-label="년"
        className={selectClass}
      >
        <option value="">년</option>
        {PERIOD_YEAR_OPTIONS.map((y) => (
          <option key={y} value={String(y)}>
            {y}년
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        disabled={disabled}
        aria-label="월"
        className={selectClass}
      >
        <option value="">월</option>
        {PERIOD_MONTH_OPTIONS.map((m) => (
          <option key={m} value={String(m).padStart(2, '0')}>
            {m}월
          </option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => onChange(year, month, e.target.value)}
        disabled={disabled}
        aria-label="일 (선택)"
        className={selectClass}
      >
        <option value="">일 (선택)</option>
        {dayOptions.map((d) => (
          <option key={d} value={String(d).padStart(2, '0')}>
            {d}일
          </option>
        ))}
      </select>
    </div>
  );
}

function PeriodPicker({
  period,
  onChange,
}: {
  period: ProjectPeriod;
  onChange: (next: ProjectPeriod) => void;
}) {
  const update = (patch: Partial<ProjectPeriod>) =>
    onChange({ ...period, ...patch });

  const toggleCurrent = () => {
    const next = !period.current;
    update(
      next
        ? { current: true, endYear: '', endMonth: '', endDay: '' }
        : { current: false },
    );
  };

  // CategorizedTagSelect 의 카테고리 헤더와 동일한 라벨 스타일
  const sectionLabel =
    'text-[10px] font-semibold uppercase tracking-wider text-gray-400';

  return (
    <div className="flex flex-col" style={{ rowGap: '1rem' }}>
      <div>
        <h3 style={{ marginBottom: '0.5rem' }} className={sectionLabel}>
          시작
        </h3>
        <YearMonthDayPicker
          year={period.startYear}
          month={period.startMonth}
          day={period.startDay}
          onChange={(y, m, d) =>
            update({ startYear: y, startMonth: m, startDay: d })
          }
        />
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem' }} className={sectionLabel}>
          종료
        </h3>
        <div
          style={{ rowGap: '0.625rem', columnGap: '0.625rem' }}
          className="flex flex-wrap items-center"
        >
          <YearMonthDayPicker
            year={period.endYear}
            month={period.endMonth}
            day={period.endDay}
            onChange={(y, m, d) =>
              update({ endYear: y, endMonth: m, endDay: d })
            }
            disabled={period.current}
          />
          {/* TagSelect 칩과 동일한 토글 버튼 — 종료일과 같은 행에서 의미 명확 */}
          <button
            type="button"
            onClick={toggleCurrent}
            aria-pressed={period.current}
            className={`rounded-full border px-4 py-2.5 text-sm leading-relaxed transition-all ${
              period.current
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            진행중
          </button>
        </div>
      </div>

      {(() => {
        // 시작 > 종료 검증 (진행중이 아니고 양쪽 년·월 모두 입력된 경우)
        if (period.current) return null;
        if (
          !period.startYear ||
          !period.startMonth ||
          !period.endYear ||
          !period.endMonth
        )
          return null;
        const s = Number(period.startYear) * 100 + Number(period.startMonth);
        const e = Number(period.endYear) * 100 + Number(period.endMonth);
        if (e >= s) return null;
        return (
          <p className="text-xs leading-relaxed text-red-500">
            종료 날짜는 시작 날짜 이후여야 합니다.
          </p>
        );
      })()}

      <p className="text-[11px] leading-relaxed text-gray-400">
        * 년·월은 필수, 일은 선택입니다.
      </p>
    </div>
  );
}

/** 프로젝트 대표 이미지(썸네일) 업로더 — 카드/미리보기 우측에 표시될 이미지.
 *  비워두면 백지로 표시됨 (선택 입력). */
function ThumbnailPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch {
      // 무시
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <p className="mb-2 text-xs font-medium text-gray-500">
        대표 이미지 (선택) — 카드/미리보기에 표시됩니다
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 transition-all hover:border-blue-400 hover:text-blue-500"
          aria-label="대표 이미지 선택"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="대표 이미지 미리보기"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>+ 이미지</span>
          )}
        </button>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            {value ? '이미지 변경' : '이미지 추가'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              제거
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** 줄글(textarea) 단계 위에 표시하는 회색 예시 박스 */
function TextExample({ text }: { text: string }) {
  return (
    <div
      style={{ marginBottom: '0.75rem' }}
      className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        작성 예시
      </div>
      <p className="whitespace-pre-wrap text-xs leading-7 text-gray-400">
        {text}
      </p>
    </div>
  );
}

/** 선택형(태그/버튼) 단계 위에 표시하는 작은 회색 예시 한 줄 */
function ChoiceExample({ text }: { text: string }) {
  return (
    <p
      style={{ marginBottom: '0.75rem' }}
      className="text-[11px] leading-relaxed text-gray-400"
    >
      <span className="mr-1 font-semibold text-gray-500">예시</span>
      {text}
    </p>
  );
}

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
  scrollable,
}: {
  categories: Record<string, readonly string[]>;
  selected: string[];
  onChange: (next: string[]) => void;
  allowCustom?: boolean;
  previewLimit?: number;
  /** true면 카테고리·직접추가 버튼을 maxHeight 컨테이너에 모두 노출하고
   *  스크롤로 처리. 직접 입력창은 스크롤 밖에 둠. 전체 30rem 안에 들어감. */
  scrollable?: boolean;
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

  const categoryList = (
    <div className="flex flex-col" style={{ rowGap: '1rem' }}>
      {Object.entries(categories).map(([cat, tags]) => {
        // scrollable 모드에선 전체 노출, 아니면 previewLimit 만큼만
        const visible = scrollable ? tags : tags.slice(0, previewLimit);
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
    </div>
  );

  const customInput = allowCustom && (
    <div style={{ marginTop: '0.75rem' }} className="flex shrink-0 gap-2.5">
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
  );

  if (scrollable) {
    return (
      <div style={{ maxHeight: '20rem' }} className="flex flex-col">
        <div className="flex-1 overflow-y-auto pr-1">{categoryList}</div>
        {customInput}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ rowGap: '1rem' }}>
      {categoryList}
      {customInput}
    </div>
  );
}

function SimpleTextarea({
  value,
  onChange,
  placeholder,
  showHint,
  example,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  showHint?: boolean;
  example?: string;
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
      {example && <TextExample text={example} />}
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
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
  example,
  stepKey,
}: {
  block: Block;
  onBlockChange: (b: Block) => void;
  assets: Asset[];
  onAssetsChange: (a: Asset[]) => void;
  placeholder?: string;
  example?: string;
  /** 이 단계에 속한 자료만 표시·관리한다. 다른 단계에 속한 자료는 그대로 보존. */
  stepKey: AssetStepKey;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // 이 단계에 속한 자료만 노출 — 다른 단계의 업로드는 보이지 않음
  const myAssets = assets.filter((a) => a.stepKey === stepKey);
  const otherAssets = assets.filter((a) => a.stepKey !== stepKey);

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
    const nextMyAssets = myAssets.slice();
    for (const file of files) {
      try {
        const dataUrl = await fileToDataUrl(file);
        // alias 는 stepKey 단위에서만 유일하면 충분 (단계가 다르면 같은 A 가능)
        const alias = findNextAlias(nextMyAssets);
        nextMyAssets.push({
          id: `${Date.now()}-${stepKey}-${alias}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          alias,
          filename: file.name,
          dataUrl,
          stepKey,
        });
      } catch {
        // 개별 실패 무시
      }
    }
    onAssetsChange([...otherAssets, ...nextMyAssets]);
  };

  const removeAsset = (id: string) =>
    onAssetsChange(assets.filter((x) => x.id !== id));

  const filteredAssets = myAssets.filter((a) =>
    `${a.alias} ${a.filename}`
      .toLowerCase()
      .includes(mentionQuery.toLowerCase()),
  );

  return (
    <div>
      {example && <TextExample text={example} />}
      <div className="relative">
        <textarea
          ref={taRef}
          value={block.text}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setMentionOpen(false), 150)}
          rows={4}
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
        {myAssets.map((a) => (
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

// ─────── 블록 기반 본문 에디터 (포인터 드래그) ───────
// - 좌측 핸들(⋮⋮): pointerdown 으로 드래그 시작 → 다른 줄 위에 놓으면 그 자리에 들어감
// - ✕ 버튼: 블록 삭제
// - 글은 textarea 에 자유롭게 입력 (문단/제목/목록 별도 추가 버튼 없음)
// - 이미지 추가: 클립보드 붙여넣기(Ctrl+V), 끌어 놓기, 또는 "이미지" 버튼
// - 파일 첨부: "파일" 버튼 또는 끌어 놓기

const ensureNonEmpty = (list: ContentBlock[]): ContentBlock[] =>
  list.length > 0 ? list : [{ id: genBlockId(), type: 'p', text: '' }];

/** 블록 좌측 [+] 메뉴 — 노션처럼 형식 변경 / 굵게 / 기울임 / 아래 새 블록 */
function BlockTypeMenu({
  block,
  open,
  onOpenChange,
  onSetType,
  onWrap,
  onAddBelow,
  onDelete,
}: {
  block: ContentBlock;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetType: (t: BlockText['type']) => void;
  onWrap: (marker: string) => void;
  onAddBelow: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  const isText =
    block.type === 'p' ||
    block.type === 'h2' ||
    block.type === 'h3' ||
    block.type === 'li';
  if (!isText) return null;

  const cur = block.type;
  const item = (label: string, onClick: () => void, active?: boolean) => (
    <button
      type="button"
      onClick={() => {
        onClick();
        onOpenChange(false);
      }}
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-blue-50 ${
        active ? 'font-semibold text-blue-600' : 'text-gray-700'
      }`}
    >
      <span>{label}</span>
      {active && <span className="text-[10px]">✓</span>}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        aria-label="블록 형식 / 스타일"
        title="블록 형식 / 스타일"
        className={`flex h-5 w-5 items-center justify-center rounded text-base leading-none text-gray-400 hover:bg-white hover:text-gray-700 ${
          open ? 'bg-white text-gray-700' : ''
        }`}
      >
        +
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <div className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            형식
          </div>
          {item('제목', () => onSetType('h2'), cur === 'h2')}
          {item('소제목', () => onSetType('h3'), cur === 'h3')}
          {item('본문', () => onSetType('p'), cur === 'p')}
          {item('목록', () => onSetType('li'), cur === 'li')}
          <div className="my-1 border-t border-gray-100" />
          <div className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            스타일
          </div>
          {item('B  굵게', () => onWrap('**'))}
          {item('I  기울임', () => onWrap('*'))}
          <div className="my-1 border-t border-gray-100" />
          {item('+ 아래에 새 블록', onAddBelow)}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => {
              onDelete();
              onOpenChange(false);
            }}
            className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50"
          >
            <span>삭제하기</span>
          </button>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  value,
  onChange,
  assets,
  onAssetsChange,
  stepKey,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 자료 풀 — 제공되면 이미지 업로드를 @[A] 자료 참조로 처리한다 */
  assets?: Asset[];
  onAssetsChange?: (a: Asset[]) => void;
  stepKey?: AssetStepKey;
}) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() =>
    ensureNonEmpty(parseBlocks(value)),
  );
  const lastSerializedRef = useRef<string>(serializeBlocks(blocks));
  const blocksRef = useRef<ContentBlock[]>(blocks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dropIdxRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fileDropActive, setFileDropActive] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const useAssets = !!(stepKey && assets && onAssetsChange);
  const myAssets = useAssets
    ? (assets as Asset[]).filter((a) => a.stepKey === stepKey)
    : [];

  // 활성 textarea 의 @멘션 드롭다운 상태
  const [mention, setMention] = useState<{
    blockId: string;
    query: string;
  } | null>(null);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const setTextareaRef = (id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) textareaRefs.current.set(id, el);
    else textareaRefs.current.delete(id);
  };
  // 제목/소제목은 input 으로 렌더하므로 별도 ref 풀에서 관리 (포커스 이동용)
  const headingRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const setHeadingRef = (id: string) => (el: HTMLInputElement | null) => {
    if (el) headingRefs.current.set(id, el);
    else headingRefs.current.delete(id);
  };
  // [+] 메뉴가 열려있는 블록 id (좌측 컨트롤이 hover 가 풀려도 사라지지 않도록 lift)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  // blocks 의 최신 값을 ref 로 유지 (전역 pointermove 핸들러 클로저 안전)
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // 외부에서 value 가 갈아끼워진 경우만 다시 파싱
  useEffect(() => {
    if (value !== lastSerializedRef.current) {
      const parsed = ensureNonEmpty(parseBlocks(value));
      setBlocks(parsed);
      blocksRef.current = parsed;
      lastSerializedRef.current = value;
    }
  }, [value]);

  const commit = (next: ContentBlock[]) => {
    const safe = ensureNonEmpty(next);
    setBlocks(safe);
    blocksRef.current = safe;
    const ser = serializeBlocks(safe);
    lastSerializedRef.current = ser;
    onChange(ser);
  };

  const updateAt = (i: number, patch: Partial<ContentBlock>) => {
    const next = blocks.slice();
    next[i] = { ...next[i], ...patch } as ContentBlock;
    commit(next);
  };

  const removeAt = (i: number) => {
    const next = blocks.slice();
    next.splice(i, 1);
    commit(next);
  };

  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    const next = blocksRef.current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  const addBlock = (block: ContentBlock) => commit([...blocksRef.current, block]);

  // ─── 텍스트 블록 헬퍼 (형식 변경 / 인라인 마커 / 분할·병합·삽입) ───
  const isTextBlock = (b: ContentBlock): b is BlockText =>
    b.type === 'p' || b.type === 'h2' || b.type === 'h3' || b.type === 'li';

  const focusBlock = (id: string, caret?: number) => {
    const el =
      textareaRefs.current.get(id) ?? headingRefs.current.get(id) ?? null;
    if (!el) return;
    el.focus();
    const pos = caret ?? el.value.length;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // input type=text/textarea 모두 지원되지만 일부 환경에서 throw 가능
    }
  };

  const setBlockType = (i: number, t: BlockText['type']) => {
    const cur = blocksRef.current[i];
    if (!cur || !isTextBlock(cur)) return;
    const next = blocksRef.current.slice();
    next[i] = { ...cur, type: t };
    commit(next);
    requestAnimationFrame(() => focusBlock(cur.id));
  };

  const wrapInline = (i: number, marker: string) => {
    const cur = blocksRef.current[i];
    if (!cur || !isTextBlock(cur)) return;
    const el =
      textareaRefs.current.get(cur.id) ??
      headingRefs.current.get(cur.id) ??
      null;
    let start = 0;
    let end = cur.text.length;
    if (el) {
      start = el.selectionStart ?? 0;
      end = el.selectionEnd ?? 0;
      if (start === end) {
        // 선택 범위가 없으면 블록 전체 텍스트를 감싼다
        start = 0;
        end = cur.text.length;
      }
    }
    const before = cur.text.slice(0, start);
    const sel = cur.text.slice(start, end);
    const after = cur.text.slice(end);
    const body = sel || '텍스트';
    const text = `${before}${marker}${body}${marker}${after}`;
    const next = blocksRef.current.slice();
    next[i] = { ...cur, text };
    commit(next);
    requestAnimationFrame(() => {
      const target =
        textareaRefs.current.get(cur.id) ?? headingRefs.current.get(cur.id);
      if (!target) return;
      target.focus();
      const startPos = before.length + marker.length;
      const endPos = startPos + body.length;
      try {
        target.setSelectionRange(startPos, endPos);
      } catch {
        // 무시
      }
    });
  };

  const insertBlankBelow = (i: number) => {
    const newId = genBlockId();
    const next = blocksRef.current.slice();
    next.splice(i + 1, 0, { id: newId, type: 'p', text: '' });
    commit(next);
    requestAnimationFrame(() => focusBlock(newId, 0));
  };

  /** 현재 블록을 caret 위치 기준으로 분할해 새 블록으로 만든다 (Enter) */
  const splitAt = (i: number, caret: number) => {
    const cur = blocksRef.current[i];
    if (!cur || !isTextBlock(cur)) return;
    const before = cur.text.slice(0, caret);
    const after = cur.text.slice(caret);
    const newId = genBlockId();
    // 제목 다음 Enter 는 본문으로, 목록 다음 Enter 는 같은 목록으로 이어가기
    const newType: BlockText['type'] = cur.type === 'li' ? 'li' : 'p';
    const next = blocksRef.current.slice();
    next[i] = { ...cur, text: before };
    next.splice(i + 1, 0, { id: newId, type: newType, text: after });
    commit(next);
    requestAnimationFrame(() => focusBlock(newId, 0));
  };

  /** Backspace at start: 이전 텍스트 블록과 병합 */
  const mergeWithPrev = (i: number) => {
    if (i <= 0) return;
    const cur = blocksRef.current[i];
    const prev = blocksRef.current[i - 1];
    if (!cur || !prev || !isTextBlock(cur) || !isTextBlock(prev)) return;
    const prevLen = prev.text.length;
    const next = blocksRef.current.slice();
    next[i - 1] = { ...prev, text: prev.text + cur.text };
    next.splice(i, 1);
    commit(next);
    requestAnimationFrame(() => focusBlock(prev.id, prevLen));
  };

  const onTextKeyDown = (
    i: number,
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    // 한글 IME 조합 중에는 동작하지 않음 (Enter 분할이 조합을 끊지 않도록)
    if (e.nativeEvent.isComposing) return;
    const cur = blocksRef.current[i];
    if (!cur || !isTextBlock(cur)) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const target = e.currentTarget;
      const caret = target.selectionStart ?? cur.text.length;
      // 빈 목록 항목에서 Enter — 본문 블록으로 빠져나오는 노션 동작
      if (cur.type === 'li' && cur.text.trim() === '') {
        const next = blocksRef.current.slice();
        next[i] = { ...cur, type: 'p', text: '' };
        commit(next);
        requestAnimationFrame(() => focusBlock(cur.id, 0));
        return;
      }
      splitAt(i, caret);
      return;
    }

    if (e.key === 'Backspace') {
      const target = e.currentTarget;
      const at0 =
        (target.selectionStart ?? 0) === 0 &&
        (target.selectionEnd ?? 0) === 0;
      if (!at0) return;
      // 제목/소제목/목록은 본문으로 강등 (텍스트 보존)
      if (cur.type !== 'p') {
        e.preventDefault();
        const next = blocksRef.current.slice();
        next[i] = { ...cur, type: 'p' };
        commit(next);
        requestAnimationFrame(() => focusBlock(cur.id, 0));
        return;
      }
      // 본문이라면 이전 블록과 병합
      if (i > 0) {
        const prev = blocksRef.current[i - 1];
        if (prev && isTextBlock(prev)) {
          e.preventDefault();
          mergeWithPrev(i);
        }
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      wrapInline(i, '**');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      wrapInline(i, '*');
      return;
    }
  };

  const addImageFile = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (useAssets && stepKey && assets && onAssetsChange) {
        // 자료 풀에 등록 → 본문에는 @[alias] 만 남겨 텍스트 길이를 짧게 유지
        const myCurrent = assets.filter((a) => a.stepKey === stepKey);
        const alias = findNextAlias(myCurrent);
        const newAsset: Asset = {
          id: `${Date.now()}-${stepKey}-${alias}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          alias,
          filename: file.name,
          dataUrl,
          stepKey,
        };
        onAssetsChange([...assets, newAsset]);
        const cur = blocksRef.current;
        let target = -1;
        for (let i = cur.length - 1; i >= 0; i--) {
          const b = cur[i];
          if (b.type === 'p' || b.type === 'li') {
            target = i;
            break;
          }
        }
        if (target >= 0) {
          const lb = cur[target] as BlockText;
          const sep =
            lb.text && !/\s$/.test(lb.text) ? ' ' : '';
          const next = cur.slice();
          next[target] = {
            ...lb,
            text: `${lb.text}${sep}@[${alias}] `,
          } as ContentBlock;
          commit(next);
        } else {
          addBlock({ id: genBlockId(), type: 'p', text: `@[${alias}] ` });
        }
      } else {
        addBlock({ id: genBlockId(), type: 'img', src: dataUrl, alt: file.name });
      }
    } catch {
      // 무시
    }
  };

  // ─── @ 멘션 ───
  const handleTextareaChange = (
    i: number,
    blockId: string,
    e: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const text = e.target.value;
    updateAt(i, { text });
    if (!useAssets) return;
    const cursor = e.target.selectionStart;
    const before = text.slice(0, cursor);
    const m = before.match(/@([^\s@\]]*)$/);
    if (m) setMention({ blockId, query: m[1] });
    else setMention(null);
  };

  const insertMention = (asset: Asset) => {
    if (!mention) return;
    const ta = textareaRefs.current.get(mention.blockId);
    if (!ta) return;
    const idx = blocksRef.current.findIndex((b) => b.id === mention.blockId);
    if (idx < 0) return;
    const cur = blocksRef.current[idx];
    if (cur.type !== 'p' && cur.type !== 'li') return;
    const cursor = ta.selectionStart;
    const before = cur.text.slice(0, cursor);
    const after = cur.text.slice(cursor);
    const newBefore = before.replace(/@[^\s@\]]*$/, `@[${asset.alias}] `);
    const newText = newBefore + after;
    updateAt(idx, { text: newText });
    setMention(null);
    requestAnimationFrame(() => {
      const pos = newBefore.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const filteredMentionAssets = mention
    ? myAssets.filter((a) =>
        `${a.alias} ${a.filename}`
          .toLowerCase()
          .includes(mention.query.toLowerCase()),
      )
    : [];

  const removeAsset = (id: string) => {
    if (!useAssets || !assets || !onAssetsChange) return;
    onAssetsChange(assets.filter((x) => x.id !== id));
  };

  const renderMentionDropdown = (blockId: string, posClass: string) => {
    if (
      !useAssets ||
      mention?.blockId !== blockId ||
      filteredMentionAssets.length === 0
    )
      return null;
    return (
      <div
        className={`absolute ${posClass} top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg`}
      >
        {filteredMentionAssets.map((a) => (
          <button
            key={a.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMention(a);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.dataUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-cover"
            />
            <div className="flex-1 truncate">
              <span className="font-medium text-gray-700">@{a.filename}</span>
              <span className="ml-2 font-mono text-xs text-gray-400">
                [{a.alias}]
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const addAttachmentFile = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      addBlock({
        id: genBlockId(),
        type: 'file',
        src: dataUrl,
        filename: file.name,
      });
    } catch {
      // 무시
    }
  };

  // ─── 포인터 기반 드래그 ───
  const startDrag = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    const fromIdx = blocksRef.current.findIndex((b) => b.id === id);
    if (fromIdx < 0) return;
    setDragId(id);
    dropIdxRef.current = fromIdx;
    setDropIdx(fromIdx);

    const onMove = (ev: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const rows = root.querySelectorAll<HTMLElement>('[data-block-row]');
      let target = -1;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
          target = i;
          break;
        }
      }
      if (target >= 0) {
        dropIdxRef.current = target;
        setDropIdx(target);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const finalDrop = dropIdxRef.current;
      const cur = blocksRef.current.findIndex((b) => b.id === id);
      if (cur >= 0 && finalDrop !== null && finalDrop !== cur) {
        moveTo(cur, finalDrop);
      }
      dropIdxRef.current = null;
      setDragId(null);
      setDropIdx(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // ─── 클립보드/파일 드롭으로 이미지 추가 ───
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          addImageFile(f);
          return;
        }
      }
    }
  };

  const handleFileDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setFileDropActive(true);
  };

  const handleFileDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setFileDropActive(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setFileDropActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.type.startsWith('image/')) addImageFile(f);
    else addAttachmentFile(f);
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
      onPaste={handlePaste}
      className={`space-y-0.5 rounded-md p-1 transition-colors ${
        fileDropActive ? 'bg-blue-50 ring-2 ring-blue-300' : ''
      }`}
    >
      {blocks.map((b, i) => (
        <div
          key={b.id}
          data-block-row
          className={`group flex items-start gap-2 rounded-md px-1 py-0.5 transition-colors ${
            dragId === b.id
              ? 'opacity-50'
              : dropIdx === i && dragId !== null
                ? 'bg-blue-50 ring-1 ring-blue-300'
                : 'hover:bg-gray-50'
          }`}
        >
          {/* 좌측 [+] 메뉴 + 드래그 핸들 (삭제는 [+] 메뉴 안에서) */}
          <div
            className={`flex shrink-0 items-center gap-0.5 pt-1 transition-opacity ${
              menuOpenFor === b.id
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <BlockTypeMenu
              block={b}
              open={menuOpenFor === b.id}
              onOpenChange={(open) => setMenuOpenFor(open ? b.id : null)}
              onSetType={(t) => setBlockType(i, t)}
              onWrap={(marker) => wrapInline(i, marker)}
              onAddBelow={() => insertBlankBelow(i)}
              onDelete={() => removeAt(i)}
            />
            <div
              role="button"
              tabIndex={0}
              aria-label="드래그해서 순서 변경"
              title="드래그해서 순서 변경"
              onPointerDown={(e) => startDrag(b.id, e)}
              className="cursor-grab select-none rounded px-1 text-gray-400 hover:bg-white hover:text-gray-700 active:cursor-grabbing"
              style={{ touchAction: 'none' }}
            >
              ⋮⋮
            </div>
          </div>

          {/* 본문 */}
          <div className="min-w-0 flex-1">
            {b.type === 'img' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.src}
                alt={b.alt}
                className="max-w-full rounded-lg border border-gray-200"
              />
            ) : b.type === 'file' ? (
              <a
                href={b.src}
                download={b.filename}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <span>📎</span>
                <span className="truncate">{b.filename}</span>
              </a>
            ) : b.type === 'h2' || b.type === 'h3' ? (
              <input
                ref={setHeadingRef(b.id)}
                type="text"
                value={b.text}
                onChange={(e) => updateAt(i, { text: e.target.value })}
                onKeyDown={(e) => onTextKeyDown(i, e)}
                placeholder={b.type === 'h2' ? '큰 제목' : '소제목'}
                className={`w-full border-0 bg-transparent px-0 outline-none ${
                  b.type === 'h2'
                    ? 'text-xl font-bold text-gray-900'
                    : 'text-lg font-bold text-gray-900'
                }`}
              />
            ) : b.type === 'li' ? (
              <div className="relative flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                <textarea
                  ref={setTextareaRef(b.id)}
                  value={b.text}
                  onChange={(e) => handleTextareaChange(i, b.id, e)}
                  onKeyDown={(e) => onTextKeyDown(i, e)}
                  onBlur={() => setTimeout(() => setMention(null), 150)}
                  rows={Math.max(1, b.text.split('\n').length)}
                  className="w-full resize-none border-0 bg-transparent px-0 text-sm leading-7 text-gray-700 outline-none"
                />
                {renderMentionDropdown(b.id, 'left-4 right-0')}
              </div>
            ) : (
              <div className="relative">
                <textarea
                  ref={setTextareaRef(b.id)}
                  value={b.text}
                  onChange={(e) => handleTextareaChange(i, b.id, e)}
                  onKeyDown={(e) => onTextKeyDown(i, e)}
                  onBlur={() => setTimeout(() => setMention(null), 150)}
                  rows={Math.max(1, b.text.split('\n').length)}
                  placeholder={
                    useAssets
                      ? 'Enter 로 새 줄 · 좌측 + 로 형식·스타일 · @ 로 자료 인용'
                      : 'Enter 로 새 줄 · 좌측 + 로 형식·스타일'
                  }
                  className="w-full resize-none border-0 bg-transparent px-0 text-sm leading-7 text-gray-700 outline-none"
                />
                {renderMentionDropdown(b.id, 'left-0 right-0')}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 첨부 추가 — 글은 자유 입력, 이미지/파일만 버튼으로 추가 */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1 text-[11px] text-gray-500">
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-gray-600 hover:bg-gray-50"
        >
          + 이미지
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-gray-200 bg-white px-2 py-0.5 text-gray-600 hover:bg-gray-50"
        >
          + 파일 첨부
        </button>
        <span className="ml-1 text-gray-400">
          또는 Ctrl+V로 붙여넣기 / 파일을 여기로 끌어다 놓기
        </span>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            addImageFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            addAttachmentFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>

      {useAssets && myAssets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
          {myAssets.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
              title={a.filename}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
      )}
      {useAssets && (
        <p className="mt-1 pl-1 text-[11px] leading-6 text-gray-400">
          텍스트에서 <span className="font-mono">@</span> 를 입력하면 업로드한
          자료를 인용할 수 있어요. 예{' '}
          <span className="font-mono">@[A]</span>
        </p>
      )}
    </div>
  );
}

// ─────── 본문 섹션 — 제목 + 포인터 드래그 핸들 + 블록 에디터 ───────
function BodySection({
  title,
  value,
  onChange,
  isDragging,
  isDropTarget,
  onPointerDownHandle,
  assets,
  onAssetsChange,
  stepKey,
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onPointerDownHandle: (e: React.PointerEvent) => void;
  assets?: Asset[];
  onAssetsChange?: (a: Asset[]) => void;
  stepKey?: AssetStepKey;
}) {
  return (
    <section
      data-section-row
      className={`group/sec rounded-lg p-1 transition-colors ${
        isDragging
          ? 'opacity-50'
          : isDropTarget
            ? 'bg-blue-50 ring-2 ring-blue-300'
            : ''
      }`}
    >
      <div
        style={{ marginBottom: '0.5rem' }}
        className="flex items-center gap-2"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="섹션 드래그하여 이동"
          title="드래그해서 섹션 순서 변경"
          onPointerDown={onPointerDownHandle}
          className="cursor-grab select-none rounded px-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          ⋮⋮
        </div>
        <h4 className="text-sm font-bold text-gray-800">{title}</h4>
        <span className="text-[11px] text-gray-400">드래그해서 순서 변경</span>
      </div>
      <BlockEditor
        value={value}
        onChange={onChange}
        assets={assets}
        onAssetsChange={onAssetsChange}
        stepKey={stepKey}
      />
    </section>
  );
}

// ─────── 본문 섹션 리스트 — 섹션 단위 드래그·드롭 관리 ───────
function BodySectionsList({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const order = ((draft.bodySectionOrder ?? DEFAULT_BODY_ORDER).filter(
    (k): k is BodySectionKey => k in BODY_SECTION_LABEL,
  ));
  // 누락된 키 자동 보충
  for (const k of DEFAULT_BODY_ORDER) {
    if (!order.includes(k)) order.push(k);
  }

  const containerRef = useRef<HTMLDivElement | null>(null);
  const orderRef = useRef<BodySectionKey[]>(order);
  const [draggingKey, setDraggingKey] = useState<BodySectionKey | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const dropIdxRef = useRef<number | null>(null);

  useEffect(() => {
    orderRef.current = order;
  });

  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    const next = orderRef.current.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    orderRef.current = next;
    setDraft((d) => ({ ...d, bodySectionOrder: next }));
  };

  const startSectionDrag = (key: BodySectionKey, e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingKey(key);
    const fromIdx = orderRef.current.indexOf(key);
    dropIdxRef.current = fromIdx;
    setDropIdx(fromIdx);

    const onMove = (ev: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const rows = root.querySelectorAll<HTMLElement>('[data-section-row]');
      let target = -1;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect();
        if (ev.clientY >= r.top && ev.clientY <= r.bottom) {
          target = i;
          break;
        }
      }
      if (target >= 0) {
        dropIdxRef.current = target;
        setDropIdx(target);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const finalDrop = dropIdxRef.current;
      const cur = orderRef.current.indexOf(key);
      if (cur >= 0 && finalDrop !== null && finalDrop !== cur) {
        moveTo(cur, finalDrop);
      }
      dropIdxRef.current = null;
      setDraggingKey(null);
      setDropIdx(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const sectionValue = (k: BodySectionKey): string => {
    switch (k) {
      case 'motivation':
        return draft.motivation;
      case 'techChoice':
        return draft.techChoice;
      case 'architecture':
        return draft.architecture.text;
      case 'result':
        return draft.result.text;
      case 'retro':
        return draft.retro.text;
      case 'contribution':
        return draft.contribution;
    }
  };

  const setSectionValue = (k: BodySectionKey, v: string) => {
    setDraft((d) => {
      switch (k) {
        case 'motivation':
          return { ...d, motivation: v };
        case 'techChoice':
          return { ...d, techChoice: v };
        case 'architecture':
          return { ...d, architecture: { ...d.architecture, text: v } };
        case 'result':
          return { ...d, result: { ...d.result, text: v } };
        case 'retro':
          return { ...d, retro: { ...d.retro, text: v } };
        case 'contribution':
          return { ...d, contribution: v };
      }
    });
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {order.map((k, i) => {
        const hasAssets =
          k === 'architecture' || k === 'result' || k === 'retro';
        return (
          <BodySection
            key={k}
            title={BODY_SECTION_LABEL[k]}
            value={sectionValue(k)}
            onChange={(v) => setSectionValue(k, v)}
            isDragging={draggingKey === k}
            isDropTarget={
              draggingKey !== null && draggingKey !== k && dropIdx === i
            }
            onPointerDownHandle={(e) => startSectionDrag(k, e)}
            assets={hasAssets ? draft.assets : undefined}
            onAssetsChange={
              hasAssets
                ? (a) => setDraft((d) => ({ ...d, assets: a }))
                : undefined
            }
            stepKey={hasAssets ? (k as AssetStepKey) : undefined}
          />
        );
      })}
    </div>
  );
}

// ─────── (구) 인라인 마크다운 섹션 ───────
function EditableMarkdownSection({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const insertAtCursor = (text: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    }, 0);
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      insertAtCursor(`\n\n![${file.name}](${dataUrl})\n\n`);
    } catch {
      // 무시
    }
  };

  const toolBtnClass =
    'rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50';

  return (
    <section>
      <div
        style={{ marginBottom: '0.5rem' }}
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <h4 className="text-sm font-bold text-gray-800">{title}</h4>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => insertAtCursor('## 제목\n')}
            className={toolBtnClass}
            title="제목 (##)"
          >
            ## 제목
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('**굵게**')}
            className={toolBtnClass}
            title="굵게 (**)"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor('\n- 항목\n')}
            className={toolBtnClass}
            title="목록"
          >
            • 목록
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={toolBtnClass}
            title="이미지 추가"
          >
            🖼 이미지
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleImageUpload(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(4, value.split('\n').length)}
        placeholder="자유롭게 작성하세요. ## 제목, **굵게**, 이미지를 사용할 수 있어요."
        className="w-full resize-y rounded-lg border border-gray-200 px-4 py-3 text-sm leading-7 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      {value.trim() && (
        <div
          style={{ marginTop: '0.5rem' }}
          className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            미리보기
          </div>
          <div className="text-sm leading-7 text-gray-700">
            {renderMarkdown(value)}
          </div>
        </div>
      )}
    </section>
  );
}

// ─────── Summary view ───────
/** 도메인 섹션 — hasDomain 토글과 4개의 sub-question 을 미리보기에서 인라인 편집.
 *  하위 질문은 "수정" 토글 없이 항상 텍스트 영역으로 노출 (질문이 명확하므로). */
function DomainEditableSection({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const [editing, setEditing] = useState(false);
  const hasAny =
    draft.hasDomain === true ||
    draft.domainTags.length > 0 ||
    !!draft.domainExpertise.trim() ||
    !!draft.domainComm.trim() ||
    !!draft.domainLimits.trim();

  const labelClass =
    'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400';
  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

  return (
    <div
      className={`rounded-lg p-1 transition-colors ${
        editing ? 'bg-blue-50/40 ring-1 ring-blue-100' : ''
      }`}
    >
      <div
        style={{ marginBottom: '0.5rem' }}
        className="flex items-center justify-between gap-2"
      >
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          도메인
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
            editing
              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600'
          }`}
        >
          {editing ? '✓ 완료' : '✎ 수정'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3 px-1 pb-1">
          {/* 도메인 포함 여부 */}
          <div>
            <span className={labelClass}>도메인 포함 여부</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, hasDomain: true }))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
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
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  draft.hasDomain === false
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                아니오
              </button>
            </div>
          </div>

          {/* hasDomain === true 일 때만 하위 질문 노출 */}
          {draft.hasDomain === true && (
            <>
              <div>
                <span className={labelClass}>도메인 영역 (드래그·태그 선택)</span>
                <TagSelect
                  options={DOMAIN_OPTIONS}
                  selected={draft.domainTags}
                  onChange={(v) => setDraft((d) => ({ ...d, domainTags: v }))}
                  allowCustom
                />
              </div>
              <div>
                <span className={labelClass}>전문성 확보 방법</span>
                <textarea
                  value={draft.domainExpertise}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      domainExpertise: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="공부한 자료, 정보 출처, 학습 방법 등."
                  className={inputClass}
                />
              </div>
              <div>
                <span className={labelClass}>전문가와의 소통</span>
                <textarea
                  value={draft.domainComm}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, domainComm: e.target.value }))
                  }
                  rows={3}
                  placeholder="전문가 인터뷰, 협업 방식 등."
                  className={inputClass}
                />
              </div>
              <div>
                <span className={labelClass}>한계와 향후 개선 방향</span>
                <textarea
                  value={draft.domainLimits}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, domainLimits: e.target.value }))
                  }
                  rows={3}
                  placeholder="현재 결과물의 한계, 향후 보완 방향."
                  className={inputClass}
                />
              </div>
            </>
          )}
        </div>
      ) : hasAny ? (
        draft.hasDomain === true ? (
          <div className="space-y-2 px-1 text-sm leading-7 text-gray-700">
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
        ) : (
          <p className="px-1 text-xs text-gray-400">
            특정 도메인 없음으로 설정됨
          </p>
        )
      ) : (
        <p className="px-1 text-xs text-gray-400">
          (도메인 정보 미입력 — &ldquo;✎ 수정&rdquo; 으로 추가)
        </p>
      )}
    </div>
  );
}

/** 미리보기 안에서 한 메타 섹션을 "읽기 ↔ 인라인 편집" 으로 토글하는 래퍼 */
function InlineEditSection({
  label,
  hasValue,
  emptyText,
  children,
  preview,
  defaultEditing = false,
}: {
  label: string;
  hasValue: boolean;
  emptyText: string;
  children: ReactNode; // editor body
  preview: ReactNode; // read-only body
  defaultEditing?: boolean;
}) {
  const [editing, setEditing] = useState(defaultEditing);
  return (
    <div
      className={`rounded-lg p-1 transition-colors ${
        editing ? 'bg-blue-50/40 ring-1 ring-blue-100' : ''
      }`}
    >
      <div
        style={{ marginBottom: '0.5rem' }}
        className="flex items-center justify-between gap-2"
      >
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
            editing
              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600'
          }`}
        >
          {editing ? '✓ 완료' : '✎ 수정'}
        </button>
      </div>
      {editing ? (
        <div className="px-1 pb-1">{children}</div>
      ) : (
        <div className="px-1">
          {hasValue ? (
            preview
          ) : (
            <p className="text-xs text-gray-400">{emptyText}</p>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryView({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const [copied, setCopied] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const handleThumbFile = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setDraft((d) => ({ ...d, thumbnail: dataUrl }));
    } catch {
      // 무시
    }
  };

  /** 단계별 자료 풀 — alias 가 단계 단위로만 유일하므로 lookup 도 단계별로 분리 */
  const assetsByStep = (key: AssetStepKey) =>
    draft.assets.filter((a) => a.stepKey === key);

  const replaceMentionsMdFor = (pool: Asset[]) => (t: string) =>
    t.replace(/@\[([^\]]+)\]/g, (_, alias) => {
      const a = pool.find((x) => x.alias === alias);
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
    const pushSec = (
      h: string,
      body: string,
      pool: Asset[] | null = null,
    ) => {
      if (!body || !body.trim()) return;
      lines.push(`## ${h}`);
      lines.push(pool ? replaceMentionsMdFor(pool)(body) : body);
      lines.push('');
    };
    pushSec('왜 만들었나요?', draft.motivation);
    pushSec('왜 이 기술 조합을 선택했나요?', draft.techChoice);
    pushSec(
      '아키텍처 설계 및 과정',
      draft.architecture.text,
      assetsByStep('architecture'),
    );
    pushSec('결과물', draft.result.text, assetsByStep('result'));
    pushSec('회고', draft.retro.text, assetsByStep('retro'));
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

  const periodText = formatPeriod(draft.period);

  const tagChips = (values: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {values.map((t) => (
        <span
          key={t}
          className="rounded-full bg-blue-50 px-3 py-1 text-xs leading-relaxed text-blue-700"
        >
          {t}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-5">
        <div className="min-w-0 flex-1 space-y-3">
          {/* 제목 — 항상 인라인 편집 가능 */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              제목
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="(제목 없음)"
              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold leading-snug text-gray-900 outline-none hover:border-gray-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 기간 — 토글로 PeriodPicker 인라인 노출 */}
          <InlineEditSection
            label="기간"
            hasValue={!!periodText || draft.period.current}
            emptyText="(미입력)"
            preview={
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {periodText && <span>{periodText}</span>}
                {draft.period.current && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    진행중
                  </span>
                )}
              </div>
            }
          >
            <PeriodPicker
              period={draft.period}
              onChange={(p) => setDraft((d) => ({ ...d, period: p }))}
            />
          </InlineEditSection>

          {/* 활동 */}
          <InlineEditSection
            label="활동"
            hasValue={draft.activityTypes.length > 0}
            emptyText="(선택된 활동이 없습니다)"
            preview={tagChips(draft.activityTypes)}
          >
            <TagSelect
              options={ACTIVITY_OPTIONS}
              selected={draft.activityTypes}
              onChange={(v) => setDraft((d) => ({ ...d, activityTypes: v }))}
              allowCustom
            />
          </InlineEditSection>

          {/* 분야 */}
          <InlineEditSection
            label="분야"
            hasValue={draft.fieldTags.length > 0}
            emptyText="(선택된 분야가 없습니다)"
            preview={tagChips(draft.fieldTags)}
          >
            <CategorizedTagSelect
              categories={FIELD_TAGS}
              selected={draft.fieldTags}
              onChange={(v) => setDraft((d) => ({ ...d, fieldTags: v }))}
              previewLimit={TAG_PREVIEW_PER_CATEGORY}
              allowCustom
            />
          </InlineEditSection>

          {/* 프로그램 */}
          <InlineEditSection
            label="프로그램"
            hasValue={draft.toolTags.length > 0}
            emptyText="(선택된 프로그램이 없습니다)"
            preview={tagChips(draft.toolTags)}
          >
            <CategorizedTagSelect
              categories={TECH_STACK_TAGS}
              selected={draft.toolTags}
              onChange={(v) => setDraft((d) => ({ ...d, toolTags: v }))}
              allowCustom
              scrollable
            />
          </InlineEditSection>

          {/* 역할 */}
          <InlineEditSection
            label="역할"
            hasValue={draft.roles.length > 0}
            emptyText="(선택된 역할이 없습니다)"
            preview={tagChips(draft.roles)}
          >
            <TagSelect
              options={ROLE_OPTIONS}
              selected={draft.roles}
              onChange={(v) => setDraft((d) => ({ ...d, roles: v }))}
            />
          </InlineEditSection>
        </div>
        {/* 우측 썸네일 — 클릭하면 직접 업로드. 없으면 백지(점선 박스)로 표시. */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => thumbInputRef.current?.click()}
            aria-label={
              draft.thumbnail ? '대표 이미지 변경' : '대표 이미지 추가'
            }
            className={`block overflow-hidden rounded-xl border bg-gray-50 transition-all hover:border-blue-400 hover:shadow ${
              draft.thumbnail ? 'border-gray-200' : 'border-dashed border-gray-300'
            }`}
            style={{ width: '11rem', height: '11rem' }}
          >
            {draft.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.thumbnail}
                alt="대표 이미지"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs leading-relaxed text-gray-400">
                + 대표 이미지
              </div>
            )}
          </button>
          {draft.thumbnail && (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, thumbnail: '' }))}
              className="mt-1.5 w-full rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-500 hover:bg-gray-50"
            >
              제거
            </button>
          )}
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleThumbFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {/* 본문 섹션 — 드래그로 순서 변경 */}
      <BodySectionsList draft={draft} setDraft={setDraft} />

      {/* 도메인 — 항상 노출, 인라인 편집 */}
      <DomainEditableSection draft={draft} setDraft={setDraft} />

      {/* 결과물 / 배포물 — 항상 노출, 인라인 편집 */}
      <InlineEditSection
        label="결과물 / 배포물"
        hasValue={
          !!draft.deliverableUrl || draft.deliverableFiles.length > 0
        }
        emptyText="(등록된 결과물·배포물이 없습니다)"
        preview={
          <div className="space-y-2 text-sm leading-7">
            {draft.deliverableUrl && (
              <a
                href={draft.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-blue-600 hover:underline"
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
        }
      >
        <DeliverablesStep draft={draft} setDraft={setDraft} />
      </InlineEditSection>

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

