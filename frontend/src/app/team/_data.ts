// 팀 mock 데이터 + 타입.
// TODO: 백엔드 연동 시 이 파일을 교체하고
//       `GET /api/teams`, `GET /api/teams/:id` 호출로 대체 (CLAUDE.md §11 TODO)
//       타입은 shared/types/team.ts 의 Team 으로 통일 예정.

export type TeamCategory = '스터디' | '공모전' | '해커톤' | '개발';
export const TEAM_CATEGORIES: TeamCategory[] = ['스터디', '공모전', '해커톤', '개발'];

export type TeamStatus = 'recruiting' | 'closed';

export type Team = {
  id: number;
  name: string;
  leader: string;
  currentMembers: number;
  totalMembers: number;
  period: string;
  recruitingRoles: string[];
  skills: string[];
  intro: string;
  category: TeamCategory;
  status: TeamStatus;
};

export const MOCK_TEAMS: Team[] = [
  {
    id: 1,
    name: '모코지',
    leader: '홍길동',
    currentMembers: 3,
    totalMembers: 5,
    period: '2026.05 ~ 2026.08',
    recruitingRoles: ['프론트엔드', '백엔드'],
    skills: ['Next.js', 'NestJS', 'PostgreSQL'],
    intro: 'IT계열 대학생을 위한 구인/네트워킹 플랫폼을 만듭니다.',
    category: '개발',
    status: 'recruiting',
  },
  {
    id: 2,
    name: '캠퍼스픽',
    leader: '김민준',
    currentMembers: 2,
    totalMembers: 4,
    period: '2026.06 ~ 2026.09',
    recruitingRoles: ['프론트엔드', 'UI/UX 디자이너'],
    skills: ['React', 'TypeScript', 'Figma'],
    intro: '대학 행사 정보를 모아주는 큐레이션 서비스를 개발 중입니다.',
    category: '개발',
    status: 'recruiting',
  },
  {
    id: 3,
    name: '딥서치',
    leader: '이서연',
    currentMembers: 4,
    totalMembers: 6,
    period: '2026.04 ~ 2026.07',
    recruitingRoles: ['AI/ML', '데이터'],
    skills: ['Python', 'PyTorch', 'LangChain'],
    intro: 'LLM 기반 학술 검색 도구를 만드는 팀입니다.',
    category: '공모전',
    status: 'recruiting',
  },
  {
    id: 4,
    name: '핀트리',
    leader: '박지훈',
    currentMembers: 5,
    totalMembers: 5,
    period: '2026.05 ~ 2026.10',
    recruitingRoles: ['백엔드', 'DevOps/인프라'],
    skills: ['Spring Boot', 'AWS', 'Docker'],
    intro: '대학생 가계부 핀테크 서비스를 함께 개발할 팀원을 찾습니다.',
    category: '개발',
    status: 'closed',
  },
  {
    id: 5,
    name: '코드스터디',
    leader: '최유진',
    currentMembers: 5,
    totalMembers: 8,
    period: '2026.05 ~ 2026.06',
    recruitingRoles: ['프론트엔드', '백엔드', '풀스택'],
    skills: ['JavaScript', 'TypeScript'],
    intro: '알고리즘과 CS 스터디를 함께할 팀원을 모집합니다.',
    category: '스터디',
    status: 'recruiting',
  },
  {
    id: 6,
    name: '잇플',
    leader: '정하늘',
    currentMembers: 2,
    totalMembers: 5,
    period: '2026.07 ~ 2026.09',
    recruitingRoles: ['모바일', '백엔드'],
    skills: ['React Native', 'NestJS', 'PostgreSQL'],
    intro: '식단 추천 모바일 앱을 만드는 해커톤 팀입니다.',
    category: '해커톤',
    status: 'recruiting',
  },
  {
    id: 7,
    name: '게임잼',
    leader: '강수빈',
    currentMembers: 4,
    totalMembers: 4,
    period: '2026.06 ~ 2026.06',
    recruitingRoles: ['게임', '프론트엔드'],
    skills: ['Unity', 'JavaScript'],
    intro: '주말 게임잼에 출전할 인디 게임 개발 팀입니다.',
    category: '해커톤',
    status: 'closed',
  },
  {
    id: 8,
    name: '데이터로그',
    leader: '윤도현',
    currentMembers: 4,
    totalMembers: 6,
    period: '2026.05 ~ 2026.08',
    recruitingRoles: ['데이터', 'AI/ML'],
    skills: ['Python', 'Pandas', 'TensorFlow'],
    intro: '교내 학생 데이터를 분석해 인사이트를 만드는 팀입니다.',
    category: '공모전',
    status: 'recruiting',
  },
  {
    id: 9,
    name: '시큐브',
    leader: '한지원',
    currentMembers: 2,
    totalMembers: 4,
    period: '2026.05 ~ 2026.11',
    recruitingRoles: ['보안', '백엔드'],
    skills: ['Python', 'Linux', 'AWS'],
    intro: '오픈소스 보안 분석 도구 개발 팀입니다.',
    category: '스터디',
    status: 'recruiting',
  },
];

// TODO: 백엔드 연동 시 `GET /api/teams/:id` 호출로 교체
export function getTeamById(id: number): Team | undefined {
  return MOCK_TEAMS.find((t) => t.id === id);
}
