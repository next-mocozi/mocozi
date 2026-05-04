import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * REST POST /api/chat/messages/:messageId/reactions 의 body
 * (URL param에서 messageId를 받으므로 body에는 emoji만)
 */
export class AddReactionDto {
  /**
   * 이모지 문자열. 일반 이모지(👍)는 4byte, skin-tone modifier 포함 시 더 길어짐.
   * 32자 제한은 합성 이모지(가족 이모지 등)도 수용 가능한 안전 폭.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  emoji: string;
}

/**
 * Socket 'reaction:add' / 'reaction:remove' 페이로드
 * (URL이 없으므로 messageId 동봉)
 */
export class ReactionEventDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  emoji: string;
}
