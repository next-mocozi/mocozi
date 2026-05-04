import { IsNotEmpty, IsString } from 'class-validator';

/** POST /api/chat/rooms/:roomId/read 요청 DTO */
export class MarkAsReadDto {
  /** 마지막으로 읽은 메시지 ID (해당 방에 속한 메시지여야 함 — 서비스에서 검증) */
  @IsString()
  @IsNotEmpty()
  messageId: string;
}
