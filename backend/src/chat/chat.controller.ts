import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AddReactionDto } from './dto/add-reaction.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateMessageBodyDto } from './dto/edit-message.dto';
import { ListMessagesQuery } from './dto/list-messages.query';
import { ListRoomsQuery } from './dto/list-rooms.query';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * 채팅 REST 컨트롤러 — 채팅방·메시지·읽음 처리
 *
 * 모든 엔드포인트가 JWT 인증 필요. 사용자 ID는 @CurrentUser()로 주입.
 * 실시간 통신(메시지 수신, 타이핑)은 ChatGateway(Socket.IO) 담당.
 *
 * 참고: docs/chat/05-api-spec.md
 */
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** POST /api/chat/rooms — 채팅방 생성 (DIRECT는 find-or-create) */
  @Post('rooms')
  createRoom(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateRoomDto,
  ) {
    return this.chatService.createRoom(user.id, dto);
  }

  /** GET /api/chat/rooms — 내가 속한 채팅방 목록 (unreadCount 포함) */
  @Get('rooms')
  listRooms(
    @CurrentUser() user: { id: string },
    @Query() query: ListRoomsQuery,
  ) {
    return this.chatService.getUserRooms(user.id, {
      type: query.type,
      limit: query.limit,
      cursor: query.cursor,
      includeHidden: query.includeHidden,
      onlyHidden: query.onlyHidden,
    });
  }

  /**
   * POST /api/chat/rooms/:roomId/hide — 방 목록에서 숨기기
   * 메시지는 정상 수신, 표시만 hidden. 멤버십 유지.
   */
  @Post('rooms/:roomId/hide')
  @HttpCode(204)
  async hideRoom(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
  ) {
    await this.chatService.hideRoom(roomId, user.id);
  }

  /** POST /api/chat/rooms/:roomId/unhide — 숨김 해제 (mutedAt 보존) */
  @Post('rooms/:roomId/unhide')
  @HttpCode(204)
  async unhideRoom(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
  ) {
    await this.chatService.unhideRoom(roomId, user.id);
  }

  /**
   * POST /api/chat/rooms/:roomId/mute — 알림 끄기
   * 메시지는 정상 수신, 토스트만 클라이언트가 skip.
   */
  @Post('rooms/:roomId/mute')
  @HttpCode(204)
  async muteRoom(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
  ) {
    await this.chatService.muteRoom(roomId, user.id);
  }

  /** POST /api/chat/rooms/:roomId/unmute — 알림 켜기 */
  @Post('rooms/:roomId/unmute')
  @HttpCode(204)
  async unmuteRoom(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
  ) {
    await this.chatService.unmuteRoom(roomId, user.id);
  }

  /**
   * POST /api/chat/rooms/:roomId/leave — 방에서 영구 나가기
   * leftAt 갱신. 이후 메시지 수신 X. 옛 메시지 보존.
   */
  @Post('rooms/:roomId/leave')
  async leaveRoom(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.leaveRoom(roomId, user.id);
  }

  /** GET /api/chat/rooms/:roomId — 채팅방 상세 (멤버십 검증 포함) */
  @Get('rooms/:roomId')
  getRoom(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
  ) {
    return this.chatService.getRoom(roomId, user.id);
  }

  /** GET /api/chat/rooms/:roomId/messages — 메시지 cursor 페이징 */
  @Get('rooms/:roomId/messages')
  listMessages(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
    @Query() query: ListMessagesQuery,
  ) {
    return this.chatService.getMessages(roomId, user.id, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  /** POST /api/chat/rooms/:roomId/read — 읽음 표시 (lastReadMessageId 갱신) */
  @Post('rooms/:roomId/read')
  @HttpCode(204)
  async markAsRead(
    @CurrentUser() user: { id: string },
    @Param('roomId') roomId: string,
    @Body() dto: MarkAsReadDto,
  ): Promise<void> {
    await this.chatService.markAsRead(roomId, user.id, dto.messageId);
  }

  /**
   * PATCH /api/chat/messages/:messageId — 메시지 수정 (본인만)
   *
   * Socket 'message:edit'은 broadcast까지 처리하지만, REST는 단순 갱신만.
   * 실시간 알림이 필요하면 클라이언트가 수정 후 별도 fetch 또는 socket 사용.
   */
  @Patch('messages/:messageId')
  editMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageBodyDto,
  ) {
    return this.chatService.editMessage(messageId, user.id, dto.content);
  }

  /** DELETE /api/chat/messages/:messageId — 메시지 소프트 삭제 (본인만) */
  @Delete('messages/:messageId')
  @HttpCode(204)
  async deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
  ): Promise<void> {
    await this.chatService.deleteMessage(messageId, user.id);
  }

  /**
   * POST /api/chat/messages/:messageId/reactions — 이모지 반응 추가
   * 409 if 같은 이모지가 이미 있음 (idempotent하지 않음, spec 따름)
   */
  @Post('messages/:messageId/reactions')
  addReaction(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.chatService.addReaction(messageId, user.id, dto.emoji);
  }

  /**
   * DELETE /api/chat/messages/:messageId/reactions/:emoji — 본인 반응 제거 (멱등)
   * URL의 emoji는 NestJS/Express가 자동 decodeURIComponent
   */
  @Delete('messages/:messageId/reactions/:emoji')
  @HttpCode(204)
  async removeReaction(
    @CurrentUser() user: { id: string },
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
  ): Promise<void> {
    await this.chatService.removeReaction(messageId, user.id, emoji);
  }
}
