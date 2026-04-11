import { IsString, IsArray, IsEnum, IsOptional } from 'class-validator';
import { PortfolioItemType } from './create-portfolio.dto';

/** 포트폴리오 아이템 수정 DTO */
export class UpdatePortfolioDto {
  @IsOptional()
  @IsEnum(PortfolioItemType)
  type?: PortfolioItemType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
