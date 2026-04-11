/** 구인 게시글 상태 */
export type RecruitStatus = 'OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED';

/** 공개 범위 */
export type RecruitVisibility = 'PUBLIC' | 'UNIVERSITY_ONLY';

/** 구인 게시글 */
export interface RecruitPost {
  id: string;
  teamId: string;
  title: string;
  description: string;
  /** 구인 직군 목록 */
  roles: string[];
  /** 요구 기술 스택 */
  skills: string[];
  /** 모집 마감일 */
  deadline: Date;
  status: RecruitStatus;
  visibility: RecruitVisibility;
  createdAt: Date;
  updatedAt: Date;
}

/** 지원 상태 */
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** 지원서 */
export interface Application {
  id: string;
  recruitId: string;
  userId: string;
  status: ApplicationStatus;
  /** 지원 메시지 */
  message: string;
  createdAt: Date;
}
