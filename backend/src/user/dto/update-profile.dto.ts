import { IsOptional, IsString, IsArray } from 'class-validator';

/** 프로필 수정 요청 DTO */
export class UpdateProfileDto {
  /** 이름 */
  @IsOptional()
  @IsString()
  name?: string;

  /** 학교 */
  @IsOptional()
  @IsString()
  university?: string;

  /** 학과 */
  @IsOptional()
  @IsString()
  department?: string;

  /** 자기소개 */
  @IsOptional()
  @IsString()
  bio?: string;

  /** 프로필 이미지 URL */
  @IsOptional()
  @IsString()
  profileImage?: string;

  /** 보유 기술 스택 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  /** 경력 요약 */
  @IsOptional()
  @IsString()
  careerSummary?: string;
}
