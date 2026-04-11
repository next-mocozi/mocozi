/** 팀 기본 정보 */
export interface Team {
  id: string;
  name: string;
  leaderId: string;
  members: TeamMember[];
  createdAt: Date;
}

/** 팀원 정보 */
export interface TeamMember {
  userId: string;
  name: string;
  role: string;
  joinedAt: Date;
}

/**
 * 팀 기획서
 * - 필수 공개 정보와 선택 공개 정보를 분리하여 아이디어 재산권 보호
 */
export interface TeamProposal {
  id: string;
  teamId: string;
  /** 팀명 */
  teamName: string;
  /** 프로젝트 개요 및 목표 (필수 공개) */
  overview: string;
  /** 상세 기획 내용 (선택 공개 - 지원자에게만 공개 가능) */
  detailedPlan: string | null;
  /** 진행 일정 */
  schedule: string;
  /** 구인 직군 목록 */
  recruitingRoles: string[];
  /** 필수 공개 정보 */
  requiredPublicInfo: RequiredPublicInfo;
  /** 선택 공개 정보 (팀장이 공개 여부 결정) */
  optionalPublicInfo: OptionalPublicInfo;
  createdAt: Date;
}

/** 필수 공개 정보 - 모든 사용자에게 공개 */
export interface RequiredPublicInfo {
  projectType: string;
  expectedDuration: string;
  recruitingRoles: string[];
  requiredSkills: string[];
}

/** 선택 공개 정보 - 팀장이 공개 범위 설정 */
export interface OptionalPublicInfo {
  techStack: string[] | null;
  referenceLinks: string[] | null;
  detailedSchedule: string | null;
  expectedOutcome: string | null;
}
