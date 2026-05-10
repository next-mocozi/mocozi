import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

/** 포트폴리오 메타(공개여부, 첫게시시각) 부분 수정 DTO */
export class UpdatePortfolioMetaDto {
  /** 공개/비공개 토글 */
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /** 첫 게시 시각 — 메인/내 피드 정렬 기준. 한 번만 세팅하는 용도. */
  @IsOptional()
  @IsDateString()
  firstPostAt?: string;
}
