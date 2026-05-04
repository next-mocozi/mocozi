import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * POST /api/chat/rooms 요청 DTO
 *
 * - DIRECT: memberIds 길이 정확히 1, name 무시
 * - GROUP: memberIds 길이 1 이상(creator 제외), name 필수
 *
 * (값 범위 검증은 ChatService.createRoom 내부에서 처리)
 */
export class CreateRoomDto {
  /** 방 종류 — Phase A는 DIRECT/GROUP만 허용 */
  @IsIn(['DIRECT', 'GROUP'])
  type: 'DIRECT' | 'GROUP';

  /** 방 이름 (GROUP일 때만 필수) */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  /** 방 설명 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** 초대할 사용자 ID 배열 (creator 제외) */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  memberIds: string[];
}
