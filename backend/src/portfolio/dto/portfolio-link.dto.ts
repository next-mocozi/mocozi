import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** 포트폴리오 - 외부 링크 생성 DTO */
export class CreatePortfolioLinkDto {
  @IsString()
  @IsNotEmpty({ message: 'URL을 입력해주세요.' })
  url: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class UpdatePortfolioLinkDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
