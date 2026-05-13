// 포트폴리오 피드/타인 상세 페이지용 mock 데이터.
// 백엔드 미연동 상태 — 본인 포트폴리오는 localStorage 에서 가져오고,
// 다른 사용자의 포트폴리오는 이 파일에서 하드코딩으로 제공.

import type { PortfolioItem } from '@/app/portfolio/_lib';
import type {
  FeedAuthor,
  FeedPost,
  FeedPostCareer,
  FeedPostExperience,
  FeedPostItem,
  FeedPostProfile,
} from '@/lib/feed/types';

export type FeedExperience = {
  company: string;
  team?: string;
  role: string;
  period: string;
  current: boolean;
};

export type FeedCareerItem = {
  year: string;
  content: string;
};

export type FeedLink = {
  label?: string;
  url: string;
};

export type FeedUser = {
  userId: string;
  name: string;
  university: string;
  department: string;
  /** 학년 — 숫자(예: '3') 또는 빈 문자열 */
  grade: string;
  /** 한 줄 자기소개 (User.bio 100자) — 카드/프로필 요약용 */
  bio: string;
  /** 프로필 사진 URL (mock 단계에서는 모두 미설정) */
  profileImage?: string | null;
  /** 프로필 직군 — 메인 + 서브 */
  mainRole?: string;
  subRoles?: string[];
  /** 기술 스택 태그 */
  skills: string[];
  /** 포트폴리오 — 피드에 노출되는 데이터는 항상 isPublic=true */
  portfolio: {
    isPublic: true;
    /** 상세 페이지용 자기소개 (500자) */
    introduction: string;
    workExperiences: FeedExperience[];
    externalActivities: FeedCareerItem[];
    items: PortfolioItem[];
    links: FeedLink[];
  };
};

export const MOCK_FEED_USERS: FeedUser[] = [
  {
    userId: 'mock-user-1',
    name: '김지수',
    university: '서울대학교',
    department: '컴퓨터공학과',
    grade: '3',
    bio: '백엔드 + AI 인프라에 관심 많은 개발자. 검색 시스템과 분산 처리에 매력을 느낍니다.',
    mainRole: '백엔드',
    subRoles: ['AI/ML'],
    skills: ['Python', 'Go', 'Kubernetes', 'PostgreSQL', 'Elasticsearch'],
    portfolio: {
      isPublic: true,
      introduction:
        '검색·랭킹 시스템과 ML 인프라를 좋아합니다. 학부 연구실에서 추천 시스템을 다루며 대용량 로그 처리와 모델 서빙 최적화를 직접 다뤄봤어요. 안정적이고 관측 가능한 백엔드 구축에 관심이 많고, 팀에 합류하면 성능 분석과 시스템 설계 쪽으로 기여하고 싶습니다.',
      workExperiences: [
        {
          company: '네이버',
          team: '검색팀',
          role: '백엔드 인턴',
          period: '2025.06 - 2025.08',
          current: false,
        },
      ],
      externalActivities: [
        { year: '2024', content: 'SW 마에스트로 14기 수료' },
        { year: '2023', content: '대학생 알고리즘 대회 동상' },
      ],
      items: [
        {
          id: 1001,
          type: 'project',
          title: '대학생 검색 엔진',
          description: '학교 내 자료/공지/스터디를 통합 검색하는 사이드 프로젝트',
          period: '2024.09 - 2025.01',
          current: false,
          domain: '검색',
          tags: ['Go', 'Elasticsearch', 'Next.js'],
          featured: true,
        },
        {
          id: 1002,
          type: 'research',
          title: '대규모 추천 시스템에서의 임베딩 압축',
          description: '연구실에서 진행한 임베딩 양자화 비교 실험',
          period: '2024.03 - 2024.08',
          current: false,
          domain: 'ML',
          tags: ['PyTorch', 'CUDA'],
        },
      ],
      links: [
        { url: 'https://github.com/jisoo-kim' },
        { url: 'https://jisoo.dev', label: '블로그' },
      ],
    },
  },
  {
    userId: 'mock-user-2',
    name: '박서연',
    university: '카이스트',
    department: '산업디자인학과',
    grade: '4',
    bio: '사용자의 시간을 아껴주는 인터페이스를 디자인합니다.',
    mainRole: '프로덕트 디자이너',
    subRoles: ['UX 리서치'],
    skills: ['Figma', 'Framer', 'Protopie', 'After Effects'],
    portfolio: {
      isPublic: true,
      introduction:
        '대학에서 산업디자인을 전공하며 사용자 경험에 흥미를 느꼈습니다. B2B SaaS 인턴 경험을 바탕으로 데이터 기반 디자인 의사결정을 즐깁니다. 작은 팀에서 디자인 시스템부터 인터랙션 프로토타이핑까지 다양한 일을 경험해봤어요.',
      workExperiences: [
        {
          company: '토스',
          team: 'PO Lab',
          role: '프로덕트 디자인 인턴',
          period: '2025.01 - 2025.03',
          current: false,
        },
      ],
      externalActivities: [
        { year: '2024', content: '서울대 디자인전공 연합 전시 참여' },
      ],
      items: [
        {
          id: 2001,
          type: 'project',
          title: '리딩 앱 리디자인',
          description: '독서량을 늘리는 마이크로 인터랙션 중심 모바일 앱',
          period: '2024.07 - 2024.09',
          current: false,
          domain: '모바일',
          tags: ['Figma', 'Protopie'],
          featured: true,
        },
        {
          id: 2002,
          type: 'activity',
          title: '디자인 시스템 컨트리뷰톤',
          description: '오픈소스 디자인 토큰 기여',
          period: '2024.05 - 2024.06',
          current: false,
          tags: ['Tokens Studio', 'GitHub'],
        },
      ],
      links: [
        { url: 'https://www.behance.net/seoyeonpark' },
        { url: 'https://linkedin.com/in/seoyeonpark' },
      ],
    },
  },
  {
    userId: 'mock-user-3',
    name: '이민호',
    university: '연세대학교',
    department: '경영학과',
    grade: '4',
    bio: '데이터로 가설을 검증하는 그로스 마케터.',
    mainRole: '그로스/마케팅',
    skills: ['SQL', 'Mixpanel', 'GA4', 'Notion', 'Looker Studio'],
    portfolio: {
      isPublic: true,
      introduction:
        '학부 시절 학회에서 SaaS 스타트업 자문 프로젝트를 다수 수행하며 마케팅·운영 데이터 분석에 푹 빠졌습니다. SQL 쿼리로 funnel 을 직접 뜯어보는 작업을 가장 좋아합니다.',
      workExperiences: [
        {
          company: '쿠팡',
          team: 'Grocery PMM',
          role: '마케팅 인턴',
          period: '2025.07 - 2025.09',
          current: false,
        },
      ],
      externalActivities: [
        { year: '2024', content: '경영전략 학회 SUM 21기 수료' },
        { year: '2023', content: '대학생 마케팅 공모전 대상' },
      ],
      items: [
        {
          id: 3001,
          type: 'project',
          title: '캠퍼스 중고거래 그로스 실험',
          description: '학교 단위 신규 유저 retention 최적화',
          period: '2024.10 - 2024.12',
          current: false,
          domain: '커머스',
          tags: ['SQL', 'Mixpanel'],
        },
      ],
      links: [{ url: 'https://linkedin.com/in/minho-lee' }],
    },
  },
  {
    userId: 'mock-user-4',
    name: '최유진',
    university: '고려대학교',
    department: '전기전자공학부',
    grade: '2',
    bio: '하드웨어와 소프트웨어 사이를 좋아합니다.',
    mainRole: '임베디드',
    subRoles: ['로보틱스'],
    skills: ['C++', 'ROS2', 'Rust', 'Verilog'],
    portfolio: {
      isPublic: true,
      introduction:
        '소형 자율주행 로봇과 공장 자동화에 관심 있어요. 로봇 동아리에서 PCB 설계와 펌웨어를 같이 다뤘고, 최근에는 ROS2 기반 SLAM 을 공부 중입니다.',
      workExperiences: [],
      externalActivities: [
        { year: '2024', content: '대학생 로봇 경진대회 본선 진출' },
      ],
      items: [
        {
          id: 4001,
          type: 'project',
          title: '실내 자율주행 미니로봇',
          description: 'ROS2 + LiDAR 기반 실내 매핑/주행',
          period: '2024.04 - 2024.10',
          current: false,
          domain: '로보틱스',
          tags: ['ROS2', 'C++', 'SLAM'],
          featured: true,
        },
        {
          id: 4002,
          type: 'study',
          title: 'Rust 임베디드 스터디',
          description: 'embassy 프레임워크로 STM32 펌웨어 작성',
          period: '2025.01 - 현재',
          current: true,
          tags: ['Rust', 'embassy'],
        },
      ],
      links: [
        { url: 'https://github.com/yujin-choi' },
        { url: 'https://yujin.notion.site' },
      ],
    },
  },
  {
    userId: 'mock-user-5',
    name: '정하늘',
    university: '성균관대학교',
    department: '소프트웨어학과',
    grade: '3',
    bio: '프론트엔드 + WebGL. 인터랙티브 웹을 좋아합니다.',
    mainRole: '프론트엔드',
    subRoles: ['크리에이티브 코딩'],
    skills: ['TypeScript', 'React', 'WebGL', 'Three.js', 'GSAP'],
    portfolio: {
      isPublic: true,
      introduction:
        '인터랙티브 웹 경험에 빠져 있는 프론트엔드 개발자입니다. Awwwards 스타일의 스크롤 인터랙션과 3D 시각화에 관심이 많고, 사이드 프로젝트로 그래픽 데모 사이트를 자주 만들어요. 협업할 때는 디자이너와 함께 기획 단계부터 들어가는 걸 선호합니다.',
      workExperiences: [
        {
          company: '당근마켓',
          role: '프론트엔드 인턴',
          period: '2025.06 - 2025.08',
          current: false,
        },
      ],
      externalActivities: [
        { year: '2025', content: 'GDG 캠퍼스 발표 — Three.js 인터랙션' },
        { year: '2024', content: '카카오 테크 캠퍼스 1기 수료' },
      ],
      items: [
        {
          id: 5001,
          type: 'project',
          title: '인터랙티브 포트폴리오 사이트',
          description: 'Three.js + GSAP 기반 스크롤 인터랙션',
          period: '2024.11 - 2025.02',
          current: false,
          domain: '웹',
          tags: ['Three.js', 'GSAP', 'TypeScript'],
          featured: true,
        },
      ],
      links: [
        { url: 'https://github.com/sky-jeong' },
        { url: 'https://sky-jeong.dev' },
      ],
    },
  },
  {
    userId: 'mock-user-6',
    name: '한지원',
    university: '한양대학교',
    department: '바이오의공학과',
    grade: '4',
    bio: '의료 데이터로 진단을 돕는 ML을 연구합니다.',
    mainRole: 'AI/ML',
    subRoles: ['헬스케어'],
    skills: ['Python', 'PyTorch', 'MONAI', 'Docker'],
    portfolio: {
      isPublic: true,
      introduction:
        '의료 영상 + 딥러닝 관심사로 학부 4년을 보냈습니다. 병원 협력 프로젝트로 흉부 X-ray 분류 모델을 만들어 논문 1편을 학회에 제출했어요. 최근에는 MLOps 와 모델 모니터링 쪽으로 관심을 넓히는 중입니다.',
      workExperiences: [],
      externalActivities: [
        { year: '2025', content: 'KCC 학부생 논문 1편 게재' },
      ],
      items: [
        {
          id: 6001,
          type: 'research',
          title: '흉부 X-ray 분류를 위한 self-supervised pretraining',
          description: 'MAE 기반 사전학습으로 라벨 효율 30% 개선',
          period: '2024.03 - 2025.02',
          current: false,
          domain: '헬스케어',
          tags: ['PyTorch', 'MONAI', 'Self-Supervised'],
          paperUrl: 'https://example.com/paper',
          featured: true,
        },
      ],
      links: [{ url: 'https://github.com/jiwon-han' }],
    },
  },
  {
    userId: 'mock-user-7',
    name: '서지훈',
    university: '포항공과대학교',
    department: '수학과',
    grade: '3',
    bio: '수학 → ML. 모델 내부 동작을 이해하는 걸 좋아합니다.',
    mainRole: 'AI/ML',
    skills: ['Python', 'JAX', 'PyTorch', 'C++'],
    portfolio: {
      isPublic: true,
      introduction:
        '수학과를 전공하면서 최적화·확률 이론에 흥미를 느껴 ML 분야로 자연스럽게 옮겨왔습니다. 평소엔 논문 구현을 즐기고, 작년부터는 LLM inference 최적화 쪽으로 사이드 프로젝트를 진행 중이에요.',
      workExperiences: [],
      externalActivities: [
        { year: '2024', content: '국제 수학경시 동상' },
      ],
      items: [
        {
          id: 7001,
          type: 'project',
          title: 'LLM inference 라이브러리',
          description: 'KV cache compression 실험',
          period: '2025.02 - 현재',
          current: true,
          domain: 'ML 인프라',
          tags: ['CUDA', 'PyTorch'],
        },
      ],
      links: [{ url: 'https://github.com/jihoon-seo' }],
    },
  },
  {
    userId: 'mock-user-8',
    name: '노하영',
    university: '이화여자대학교',
    department: '커뮤니케이션·미디어학부',
    grade: '4',
    bio: '브랜드 스토리를 만드는 콘텐츠 기획자.',
    mainRole: '콘텐츠/마케팅',
    skills: ['Notion', 'Premiere Pro', 'Canva', 'Adobe Illustrator'],
    portfolio: {
      isPublic: true,
      introduction:
        '브랜드 톤앤매너에 맞는 스토리를 만들고 싶은 콘텐츠 기획자입니다. 인스타그램 채널을 0에서 5만 팔로워까지 키워본 경험이 있어 SNS 운영·기획에 자신 있어요.',
      workExperiences: [
        {
          company: '스타트업 X',
          role: '콘텐츠 마케터 인턴',
          period: '2025.03 - 2025.06',
          current: false,
        },
      ],
      externalActivities: [
        { year: '2024', content: '대학생 광고제 입선' },
      ],
      items: [
        {
          id: 8001,
          type: 'project',
          title: '뷰티 브랜드 인스타그램 운영',
          description: '6개월간 팔로워 5만 명 달성',
          period: '2024.06 - 2024.12',
          current: false,
          domain: '브랜딩',
          tags: ['SNS', '브랜딩', '카피라이팅'],
        },
      ],
      links: [{ url: 'https://www.instagram.com/hayoung-brand' }],
    },
  },
];

/** userId 로 mock 피드 사용자 검색 — 없으면 undefined */
export function findMockFeedUser(userId: string): FeedUser | undefined {
  return MOCK_FEED_USERS.find((u) => u.userId === userId);
}

// ──────── FeedPost 변환 ────────
// SSR/CSR 일관성을 위해 base time 을 고정. (Date.now() 를 module scope 에서
// 사용하면 hydration 불일치 발생 가능.)
const MOCK_BASE_TIME = new Date('2026-05-08T00:00:00Z').getTime();
const DAY = 86_400_000;

function makeAuthor(user: FeedUser): FeedAuthor {
  return {
    userId: user.userId,
    lastName: user.name[0] ?? '',
    firstName: user.name.slice(1),
    university: user.university,
    department: user.department,
    grade: user.grade,
    profileImage: user.profileImage ?? null,
    mainRole: user.mainRole,
  };
}

/** 사용자별 ProfilePost 의 createdAt — 사용자 인덱스가 클수록 더 옛날 (분포용) */
function getUserFirstPostAt(userIdx: number): number {
  return MOCK_BASE_TIME - (60 + userIdx * 5) * DAY;
}

/** PortfolioItem 의 createdAt — 명시값이 있으면 그대로, 없으면 deterministic 계산.
 *  사용자 인덱스 + 항목 인덱스로 다양한 시간대 분포. */
function getItemCreatedAt(
  userIdx: number,
  itemIdx: number,
  item: PortfolioItem,
): number {
  if (item.createdAt) return item.createdAt;
  const offset = (userIdx * 4 + itemIdx * 7 + 2) % 55;
  return MOCK_BASE_TIME - offset * DAY;
}

/** 모든 mock 사용자의 모든 게시물(item·experience·career·profile)을 평탄화해서 반환.
 *  메인 피드(`/portfolio`)에서 사용. 정렬은 호출자가 수행. */
export function getMockFeedPosts(): FeedPost[] {
  const posts: FeedPost[] = [];
  MOCK_FEED_USERS.forEach((user, ui) => {
    const author = makeAuthor(user);
    // ProfilePost — 최초 작성 게시물
    const firstAt = getUserFirstPostAt(ui);
    posts.push({
      kind: 'profile',
      postId: `${user.userId}-profile`,
      author,
      createdAt: firstAt,
      intro: user.portfolio.introduction,
      skills: user.skills,
    } satisfies FeedPostProfile);

    // PortfolioItem 들
    user.portfolio.items.forEach((item, ii) => {
      posts.push({
        kind: 'item',
        postId: `${user.userId}-item-${item.id}`,
        author,
        createdAt: getItemCreatedAt(ui, ii, item),
        item,
      } satisfies FeedPostItem);
    });

    // 실무 경험
    user.portfolio.workExperiences.forEach((exp, ei) => {
      posts.push({
        kind: 'experience',
        postId: `${user.userId}-exp-${ei}`,
        author,
        createdAt: firstAt + (ei + 1) * 3 * DAY,
        exp: {
          id: ei + 1,
          company: exp.company,
          team: exp.team ?? '',
          role: exp.role,
          period: exp.period,
          current: exp.current,
        },
      } satisfies FeedPostExperience);
    });

    // 대외 활동
    user.portfolio.externalActivities.forEach((c, ci) => {
      posts.push({
        kind: 'career',
        postId: `${user.userId}-career-${ci}`,
        author,
        createdAt: firstAt + (ci + 1) * 7 * DAY,
        career: { id: ci + 1, year: c.year, content: c.content },
      } satisfies FeedPostCareer);
    });
  });
  return posts;
}
