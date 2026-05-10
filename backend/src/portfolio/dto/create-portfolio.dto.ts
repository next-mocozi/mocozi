import {
  IsString,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

/** 포트폴리오 아이템 유형 */
export enum PortfolioItemType {
  PROJECT = 'PROJECT',
  RESEARCH = 'RESEARCH',
  STUDY = 'STUDY',
  ACTIVITY = 'ACTIVITY',
  ETC = 'ETC',
}

/** 포트폴리오 아이템 생성 DTO */
export class CreatePortfolioDto {
  /** 활동 유형 */
  @IsEnum(PortfolioItemType, { message: '올바른 활동 유형을 선택해주세요.' })
  type: PortfolioItemType;

  /** 활동 제목 */
  @IsString()
  @IsNotEmpty({ message: '제목을 입력해주세요.' })
  title: string;

  /** 활동 설명 */
  @IsString()
  @IsNotEmpty({ message: '설명을 입력해주세요.' })
  description: string;

  /** 사용 기술 스택 */
  @IsArray()
  @IsString({ each: true })
  techStack: string[];

  /** 활동 기간 */
  @IsString()
  @IsNotEmpty()
  duration: string;

  /** 담당 역할 */
  @IsString()
  @IsNotEmpty()
  role: string;

  /** 도메인 분류 */
  @IsString()
  @IsNotEmpty()
  domain: string;

  /** 태그 목록 */
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  // ─── 확장 필드 (옵셔널) ─────────────────────────────

  /** 한 줄 요약 (피드 노출용) */
  @IsOptional()
  @IsString()
  summary?: string;

  /** 대표(featured) 여부 */
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  /** 썸네일 이미지 URL/Data URL */
  @IsOptional()
  @IsString()
  thumbnail?: string;

  /** 표시용 기간 문자열 (예: "2024.03 - 2024.07") */
  @IsOptional()
  @IsString()
  period?: string;

  /** 진행중 여부 */
  @IsOptional()
  @IsBoolean()
  current?: boolean;

  /** type별 상세 데이터 (인터뷰 답변, 에셋 등) — 자유 형식 JSON */
  @IsOptional()
  details?: unknown;
}
