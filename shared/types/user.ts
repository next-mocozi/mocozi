/** 사용자 기본 정보 인터페이스 */
export interface User {
  id: string;
  email: string;
  name: string;
  university: string;
  department: string;
  role: string;
  profileImage: string | null;
  bio: string | null;
  skills: string[];
  createdAt: Date;
}

/** 사용자 프로필 (기본 정보 + 대표 활동 및 경력 요약) */
export interface UserProfile extends User {
  /** 대표 활동 목록 */
  representativeActivities: RepresentativeActivity[];
  /** 경력 요약 */
  careerSummary: string | null;
  /** 포트폴리오 수 */
  portfolioCount: number;
}

/** 대표 활동 */
export interface RepresentativeActivity {
  title: string;
  description: string;
  period: string;
  role: string;
}
