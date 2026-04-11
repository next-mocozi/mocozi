/** 직군 분류 */
export enum Role {
  FRONTEND = 'FRONTEND',
  BACKEND = 'BACKEND',
  FULLSTACK = 'FULLSTACK',
  DESIGNER = 'DESIGNER',
  PM = 'PM',
  AI_ML = 'AI_ML',
  DATA = 'DATA',
  DEVOPS = 'DEVOPS',
  OTHER = 'OTHER',
}

/** 직군 한국어 라벨 매핑 */
export const RoleLabel: Record<Role, string> = {
  [Role.FRONTEND]: '프론트엔드',
  [Role.BACKEND]: '백엔드',
  [Role.FULLSTACK]: '풀스택',
  [Role.DESIGNER]: '디자이너',
  [Role.PM]: '기획자/PM',
  [Role.AI_ML]: 'AI/ML',
  [Role.DATA]: '데이터',
  [Role.DEVOPS]: 'DevOps',
  [Role.OTHER]: '기타',
};
