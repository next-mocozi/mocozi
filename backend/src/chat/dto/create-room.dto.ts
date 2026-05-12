import { MessageContext } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
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

  /**
   * 진입 컨텍스트 — 어떤 페이지/맥락에서 시작된 방인지 (§17 정책).
   * RoomList에서 색 점 표시용. nullable — 옛 클라이언트 호환.
   * DIRECT find-or-create 시 기존 방이 있으면 그 방의 context 유지 (첫 값 보존).
   */
  @IsOptional()
  @IsEnum(MessageContext)
  context?: MessageContext;

  /**
   * 방 생성과 동시에 보낼 첫 메시지 (예: SCOUT_FROM_TEAM의 modal 메시지).
   * - 본문 raw text. 마커(`[[link:team:teamId|팀명]]` 등)도 inline 가능
   * - 비어있으면 메시지 전송 안 함 (옛 흐름과 동일)
   * - DIRECT find-or-create로 기존 방 재사용 시도 첫 메시지 전송 (자유 대화 trigger)
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  firstMessage?: string;
}
