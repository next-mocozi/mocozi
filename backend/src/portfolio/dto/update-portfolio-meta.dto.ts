import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

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
}
