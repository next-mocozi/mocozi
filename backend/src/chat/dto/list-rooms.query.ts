import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * GET /api/chat/rooms 쿼리 파라미터
 *
 * cursor는 base64url 인코딩된 opaque token. 클라이언트는 nextCursor를 그대로 다음 요청에 전달.
 * (서버 내부에서 (lastMessageAt, id) tuple로 디코딩됨)
 */
export class ListRoomsQuery {
  /** 채팅방 종류 필터 */
  @IsOptional()
  @IsIn(['DIRECT', 'GROUP', 'CHANNEL'])
  type?: 'DIRECT' | 'GROUP' | 'CHANNEL';

  /** 페이지 크기 (기본 20, 최대 50 — 서비스에서 clamp) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** 직전 페이지 nextCursor (base64url opaque token) */
  @IsOptional()
  @IsString()
  cursor?: string;

  /** 숨긴 채팅도 포함 (default: false) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeHidden?: boolean;

  /** 숨긴 채팅만 (숨김 채팅 보기 화면 전용) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyHidden?: boolean;
}
