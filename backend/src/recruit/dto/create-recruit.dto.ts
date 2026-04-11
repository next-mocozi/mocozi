import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';

/** 공개 범위 */
export enum RecruitVisibility {
  PUBLIC = 'PUBLIC',
  UNIVERSITY_ONLY = 'UNIVERSITY_ONLY',
}

/** 구인 게시글 생성 DTO */
export class CreateRecruitDto {
  /** 게시글 제목 */
  @IsString()
  @IsNotEmpty({ message: '제목을 입력해주세요.' })
  title: string;

  /** 게시글 설명 */
  @IsString()
  @IsNotEmpty({ message: '설명을 입력해주세요.' })
  description: string;

  /** 구인 직군 목록 */
  @IsArray()
  @IsString({ each: true })
  roles: string[];

  /** 요구 기술 스택 */
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  /** 모집 마감일 */
  @IsDateString({}, { message: '올바른 날짜 형식이 아닙니다.' })
  deadline: string;

  /** 공개 범위 */
  @IsOptional()
  @IsEnum(RecruitVisibility)
  visibility?: RecruitVisibility;

  /** 팀 ID */
  @IsString()
  @IsNotEmpty()
  teamId: string;
}
