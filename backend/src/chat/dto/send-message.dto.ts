import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/**
 * Socket 'message:send' 이벤트 페이로드
 *
 * senderId는 토큰에서 추출되므로 클라이언트가 보내지 않는다 (위조 방지).
 */
export class SendMessageDto {
  /** 채팅방 ID */
  @IsString()
  @IsNotEmpty()
  roomId: string;

  /** 메시지 내용 (최대 4000자 — UI/DB 부담 한계) */
  @IsString()
  @IsNotEmpty({ message: '메시지를 입력해주세요.' })
  @MaxLength(4000)
  content: string;

  /** 답글일 때 부모 메시지 ID (같은 방의 메시지여야 함 — 서비스에서 검증) */
  @IsOptional()
  @IsString()
  parentId?: string;
}
