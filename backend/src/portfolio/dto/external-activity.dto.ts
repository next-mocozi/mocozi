import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** 포트폴리오 - 대외 활동 생성 DTO */
export class CreateExternalActivityDto {
  /** 4자리 연도 — 표시용 raw string */
  @IsString()
  @IsNotEmpty({ message: '연도를 입력해주세요.' })
  year: string;

  /** "01"~"12" — optional (기존 데이터 호환) */
  @IsOptional()
  @IsString()
  month?: string;

  @IsString()
  @IsNotEmpty({ message: '활동 내용을 입력해주세요.' })
  content: string;
}

export class UpdateExternalActivityDto {
  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
