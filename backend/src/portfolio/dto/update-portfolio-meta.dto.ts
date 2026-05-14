import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, Matches } from 'class-validator';

/** 포트폴리오 메타(공개여부, 첫게시시각, 자기소개) 부분 수정 DTO */
export class UpdatePortfolioMetaDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsDateString()
  firstPostAt?: string;

  @IsOptional()
  @IsString()
  intro?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  profileSections?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]{1,2}$/, {
    message: '슬러그는 3~30자, 소문자·숫자·하이픈만 사용 가능하며 하이픈으로 시작/끝날 수 없습니다',
  })
  slug?: string | null;
}
