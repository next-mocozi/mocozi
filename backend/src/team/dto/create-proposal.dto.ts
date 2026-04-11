import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
} from 'class-validator';

/** 팀 기획서 생성 DTO - 필수/선택 공개 정보 분리 */
export class CreateProposalDto {
  /** 팀명 */
  @IsString()
  @IsNotEmpty({ message: '팀명을 입력해주세요.' })
  teamName: string;

  /** 프로젝트 개요/목표 (필수 공개) */
  @IsString()
  @IsNotEmpty({ message: '프로젝트 개요를 입력해주세요.' })
  overview: string;

  /** 상세 기획 내용 (선택 공개) */
  @IsOptional()
  @IsString()
  detailedPlan?: string;

  /** 진행 일정 */
  @IsString()
  @IsNotEmpty({ message: '진행 일정을 입력해주세요.' })
  schedule: string;

  /** 구인 직군 목록 */
  @IsArray()
  @IsString({ each: true })
  recruitingRoles: string[];

  // --- 필수 공개 정보 ---

  /** 프로젝트 유형 */
  @IsString()
  @IsNotEmpty()
  projectType: string;

  /** 예상 기간 */
  @IsString()
  @IsNotEmpty()
  expectedDuration: string;

  /** 요구 기술 스택 */
  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  // --- 선택 공개 정보 ---

  /** 사용 기술 스택 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  /** 참고 링크 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceLinks?: string[];

  /** 상세 일정 */
  @IsOptional()
  @IsString()
  detailedSchedule?: string;

  /** 예상 결과물 */
  @IsOptional()
  @IsString()
  expectedOutcome?: string;
}
