import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Socket 'message:edit' 페이로드 — messageId + content
 * (REST PATCH /messages/:messageId 는 messageId가 URL param이므로 별도 DTO 사용)
 */
export class EditMessageDto {
  /** 수정할 메시지 ID */
  @IsString()
  @IsNotEmpty()
  messageId: string;

  /** 새 내용 (최대 4000자 — DB 부담 한계) */
  @IsString()
  @IsNotEmpty({ message: '메시지 내용을 입력해주세요.' })
  @MaxLength(4000)
  content: string;
}

/**
 * REST PATCH /api/chat/messages/:messageId 의 body 파트.
 * URL param에서 messageId를 받으므로 body에는 content만 필요.
 */
export class UpdateMessageBodyDto {
  /** 새 내용 */
  @IsString()
  @IsNotEmpty({ message: '메시지 내용을 입력해주세요.' })
  @MaxLength(4000)
  content: string;
}
