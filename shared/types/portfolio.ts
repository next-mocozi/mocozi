/** 포트폴리오 아이템 유형 */
export type PortfolioItemType = 'project' | 'research' | 'activity' | 'etc';

/** 포트폴리오 */
export interface Portfolio {
  id: string;
  userId: string;
  items: PortfolioItem[];
}

/** 포트폴리오 아이템 - 카드 형태로 표시 */
export interface PortfolioItem {
  id: string;
  type: PortfolioItemType;
  /** 활동 제목 */
  title: string;
  /** 활동 설명 */
  description: string;
  /** 사용 기술 스택 */
  techStack: string[];
  /** 활동 기간 */
  duration: string;
  /** 담당 역할 */
  role: string;
  /** 도메인 분류 */
  domain: string;
  /** 도메인 태그 */
  tags: string[];
  createdAt: Date;
}
