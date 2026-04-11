import { IsString, IsNotEmpty } from 'class-validator';

/** 메시지 전송 DTO */
export class SendMessageDto {
  /** 채팅방 ID */
  @IsString()
  @IsNotEmpty()
  roomId: string;

  /** 메시지 내용 */
  @IsString()
  @IsNotEmpty({ message: '메시지를 입력해주세요.' })
  content: string;
}
