import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** 포트폴리오 - 실무 경험 생성 DTO */
export class CreateWorkExperienceDto {
  @IsString()
  @IsNotEmpty({ message: '회사명을 입력해주세요.' })
  company: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsString()
  @IsNotEmpty({ message: '역할을 입력해주세요.' })
  role: string;

  /** "2024.06 - 2024.08" / "2024.06 - 현재" */
  @IsString()
  @IsNotEmpty({ message: '기간을 입력해주세요.' })
  period: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

/** 부분 수정 — 모두 옵셔널 */
export class UpdateWorkExperienceDto {
  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;
}
