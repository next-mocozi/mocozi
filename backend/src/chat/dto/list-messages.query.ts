import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * GET /api/chat/rooms/:roomId/messages 쿼리 파라미터
 *
 * cursor는 base64url 인코딩된 opaque token. 클라이언트는 nextCursor를 그대로 다음 요청에 전달.
 * (서버 내부에서 (createdAt, id) tuple로 디코딩됨 — 같은 ms timestamp 두 메시지 누락 방지)
 */
export class ListMessagesQuery {
  /** 페이지 크기 (기본 50, 최대 100 — 서비스에서 clamp) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** 직전 페이지 nextCursor (base64url opaque token) */
  @IsOptional()
  @IsString()
  cursor?: string;
}
