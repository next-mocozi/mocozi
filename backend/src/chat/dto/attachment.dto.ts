import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';

/**
 * Phase A 첨부 정책 — `docs/chat/01-decisions.md` §16 / API spec 1-X
 */

/** 한 메시지에 동시에 처리 가능한 최대 첨부 수 — UX 안전 한도 */
export const MAX_ATTACHMENTS_PER_REQUEST = 10;

/** POST /api/chat/rooms/:roomId/attachments/upload-url — 단일 파일 메타 */
export class UploadAttachmentFileDto {
  /** 원본 파일명 (UI 표시용. backend가 별도 검증하지는 않음) */
  @IsString()
  @MaxLength(256)
  name: string;

  /** 파일 크기 (bytes). MIME별 한도는 StorageService가 검증 */
  @IsInt()
  @Min(1)
  size: number;

  /** MIME. 화이트리스트(ATTACHMENT_MIME_WHITELIST)와 매치되어야 통과 */
  @IsString()
  @Matches(/^[a-z]+\/[a-z0-9\-.+]+$/i, { message: '유효하지 않은 MIME 형식입니다.' })
  mime: string;
}

export class UploadAttachmentUrlDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => UploadAttachmentFileDto)
  files: UploadAttachmentFileDto[];
}

/** POST /api/chat/attachments/sign-url — path 배치 */
export class SignAttachmentUrlDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50) // 한 메시지에 10개 × 5메시지 = 50 정도 충분
  @IsString({ each: true })
  paths: string[];
}
