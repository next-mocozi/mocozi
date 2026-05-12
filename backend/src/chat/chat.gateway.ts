import {
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { WsAllExceptionFilter } from '../common/filters/ws-exception.filter';
import { ChatService } from './chat.service';
import { ReactionEventDto } from './dto/add-reaction.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * 채팅 Socket.IO 게이트웨이 — 실시간 메시지 송수신
 *
 * 보안:
 * - 핸드셰이크 시 토큰 검증 (handleConnection). 실패 시 즉시 disconnect
 * - @UseGuards(WsJwtGuard)로 모든 @SubscribeMessage 핸들러도 토큰 검증
 *   (handleConnection은 가드가 적용되지 않으므로 수동 검증과 이중 안전망)
 * - senderId는 client.data.user.id에서만 가져온다 (클라이언트 페이로드 신뢰 금지)
 *
 * Room 구조:
 * - room:<roomId>  채팅방 단위 broadcast (그 방 화면을 보고 있는 사용자)
 * - user:<userId>  사용자 글로벌 (인앱 알림 — 다른 방 메시지 토스트 등 Day 5에서 wire)
 *
 * 참고: docs/chat/05-api-spec.md §2
 */
@UseFilters(WsAllExceptionFilter)
@UseGuards(WsJwtGuard)
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 핸드셰이크 시 토큰 검증 + 사용자 글로벌 room 가입.
   * @UseGuards는 handleConnection에 적용되지 않으므로 직접 verify.
   */
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{ sub: string; email: string }>(
        token,
      );
      client.data.user = { id: payload.sub, email: payload.email };
      // socket 단위 멤버십 캐시 — message:send마다 DB 조회 안 하기 위해
      // Map<roomId, joinedAtMs> — 5분 TTL 후 자동 stale로 처리되어 DB 재검증
      // (Phase B에서 강퇴/leftAt 기능 추가 시 cache invalidate 안전망)
      client.data.activeRoomIds = new Map<string, number>();

      // 인앱 알림 수신용 — 본인 ID 글로벌 room. message:send 시 멤버별로 broadcast됨 (Day 5)
      await client.join(`user:${payload.sub}`);

      this.logger.log(`Connected: ${client.id} (user=${payload.sub})`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${(err as Error).message}`);
      client.emit('exception', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.id ?? '?';
    this.logger.log(`Disconnected: ${client.id} (user=${userId})`);
  }

  // ---------------------------------------------------------
  // 채팅방 입퇴장 (Socket room 단위)
  // ---------------------------------------------------------

  /**
   * 채팅방 입장 — 멤버 검증 + room 가입 + 자동 읽음 처리.
   *
   * Phase A 정책: 방에 들어오면 그 시점의 마지막 메시지까지 읽은 것으로 간주.
   *  - lastReadMessageId 자동 갱신
   *  - 본인의 다른 디바이스 사이드바 동기화를 위해 user:<id>로 unreadCountChanged broadcast
   * (참고: docs/chat/01-decisions.md §12)
   */
  @SubscribeMessage('conversation:join')
  async onConversationJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data?.roomId) throw new WsException('roomId가 필요합니다.');
    const userId = this.requireUserId(client);

    await this.chatService.assertMembership(data.roomId, userId);
    await client.join(`room:${data.roomId}`);
    // 캐시 — message:send 시 DB 조회 회피. timestamp 기록해 TTL 체크용
    (client.data.activeRoomIds as Map<string, number>).set(
      data.roomId,
      Date.now(),
    );

    // 자동 읽음 처리 — 입장 즉시 unreadCount=0이라는 사실은 정책상 결정됨 (Phase A ①).
    // 따라서 ack는 즉시 0으로 반환하고 DB 갱신은 background로 분리:
    //  - 사용자 응답 latency: ~150ms → ~10ms (DB 4 query 제거)
    //  - 빠른 join/leave 반복 시 connection 한도 초과 방지
    //  - skipMembershipCheck로 위에서 이미 통과한 검증 중복 호출 제거 (5 → 3 query)
    void this.chatService
      .markRoomAsReadToLatest(data.roomId, userId, {
        skipMembershipCheck: true,
      })
      .then((unreadCount) => {
        if (unreadCount !== null) {
          this.server
            .to(`user:${userId}`)
            .emit('notification:unreadCountChanged', {
              roomId: data.roomId,
              unreadCount,
            });
        }
      })
      .catch((err) => {
        this.logger.warn(
          `[conversation:join] background mark-as-read failed: ${(err as Error).message}`,
        );
      });

    return { ok: true, roomId: data.roomId, unreadCount: 0 };
  }

  /** 채팅방 떠남 — Socket room leave (논리적 leftAt 갱신은 별도 REST) */
  @SubscribeMessage('conversation:leave')
  async onConversationLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data?.roomId) throw new WsException('roomId가 필요합니다.');
    await client.leave(`room:${data.roomId}`);
    (client.data.activeRoomIds as Map<string, number> | undefined)?.delete(
      data.roomId,
    );
    return { ok: true, roomId: data.roomId };
  }

  // ---------------------------------------------------------
  // 메시지
  // ---------------------------------------------------------

  /**
   * 메시지 전송 — 저장 + dual broadcast.
   * senderId는 토큰에서 추출 (위조 방지).
   *
   * Broadcast 두 갈래:
   *   1) room:<roomId>           — 그 방 화면을 보고 있는 사람들에게 message:new
   *   2) user:<멤버Id> 각각      — 사이드바 갱신 + 다른 방이면 토스트용 notification:newMessage
   *
   * 클라이언트 처리:
   *   - message:new          → 채팅창에 메시지 추가
   *   - notification:newMessage → 사이드바 unreadCount 갱신, 다른 방 메시지면 토스트
   */
  @SubscribeMessage('message:send')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const senderId = this.requireUserId(client);

    // 캐시 hit + TTL valid 시 assertMembership DB 쿼리 1개 절감 (~130ms RTT)
    // TTL: 5분. Phase B에서 강퇴/leftAt 도입 시 stale 안전망
    // 캐시 miss(에지: socket이 conversation:join 안 거치고 message:send) 시 fallback
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const cache = client.data.activeRoomIds as Map<string, number> | undefined;
    const cachedAt = cache?.get(dto.roomId);
    const isCacheFresh =
      cachedAt !== undefined && Date.now() - cachedAt < CACHE_TTL_MS;

    let skipMembershipCheck = isCacheFresh;
    if (!isCacheFresh) {
      await this.chatService.assertMembership(dto.roomId, senderId);
      cache?.set(dto.roomId, Date.now());
      skipMembershipCheck = true;
    }

    const message = await this.chatService.saveMessage(
      dto.roomId,
      senderId,
      dto.content,
      dto.parentId,
      { skipMembershipCheck },
    );

    // 1) 방 단위 broadcast
    this.server.to(`room:${dto.roomId}`).emit('message:new', message);

    // 2) 멤버별 글로벌 broadcast (인앱 알림)
    const notifications = await this.chatService.buildNewMessageNotifications(
      dto.roomId,
      message.sender.name,
      message.content,
      message.createdAt,
    );
    for (const { userId, payload } of notifications) {
      this.server.to(`user:${userId}`).emit('notification:newMessage', payload);
    }

    return message; // ack로 전송자에게 즉시 반환 (낙관적 UI에서 최종 ID 확정용)
  }

  /**
   * 메시지 수정 — 본인 메시지만, editedAt 갱신, room 브로드캐스트.
   * 서비스가 권한·존재·삭제 여부 검증을 모두 담당. Gateway는 senderId(=토큰) 추출 + broadcast.
   */
  @SubscribeMessage('message:edit')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onMessageEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: EditMessageDto,
  ) {
    const userId = this.requireUserId(client);
    const updated = await this.chatService.editMessage(
      dto.messageId,
      userId,
      dto.content,
    );
    this.server.to(`room:${updated.roomId}`).emit('message:edited', updated);
    return updated;
  }

  /**
   * 메시지 삭제 (소프트) — 본인 메시지만, deletedAt 설정, room 브로드캐스트.
   * 답글 부모 보존을 위해 row는 유지. 클라이언트는 deletedAt !== null 메시지를 placeholder로 렌더.
   */
  @SubscribeMessage('message:delete')
  async onMessageDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    if (!data?.messageId) throw new WsException('messageId가 필요합니다.');
    const userId = this.requireUserId(client);
    const result = await this.chatService.deleteMessage(data.messageId, userId);

    // message:deleted broadcast — 같은 방 사용자에게 메시지 삭제 알림
    // roomLastMessage가 null이 아니면 사이드바 lastMessage도 함께 갱신 가능
    this.server.to(`room:${result.roomId}`).emit('message:deleted', {
      messageId: result.messageId,
      roomId: result.roomId,
      // 삭제로 lastMessage가 갱신됐을 때만 포함 (옛 메시지 삭제면 null → 클라가 무시)
      roomLastMessage: result.roomLastMessage,
    });

    // 다른 방을 보고 있는 멤버들의 사이드바도 동기화 — user:<id> room으로 broadcast
    if (result.roomLastMessage) {
      const memberIds = await this.chatService.getActiveMemberIds(
        result.roomId,
      );
      for (const memberId of memberIds) {
        this.server
          .to(`user:${memberId}`)
          .emit('notification:roomLastMessageChanged', {
            roomId: result.roomId,
            lastMessage: result.roomLastMessage.lastMessage,
            lastMessageAt: result.roomLastMessage.lastMessageAt,
          });
      }
    }

    return { ok: true, ...result };
  }

  /**
   * 이모지 반응 추가 — 본인 멤버 검증 후 반응 INSERT, room broadcast.
   * 같은 (messageId, userId, emoji) 중복은 ConflictException → exception(Conflict)
   */
  @SubscribeMessage('reaction:add')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onReactionAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ReactionEventDto,
  ) {
    const userId = this.requireUserId(client);
    const reaction = await this.chatService.addReaction(
      dto.messageId,
      userId,
      dto.emoji,
    );
    this.server.to(`room:${reaction.roomId}`).emit('reaction:added', {
      id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      createdAt: reaction.createdAt,
    });
    return reaction;
  }

  /**
   * 이모지 반응 제거 — 본인 반응만 (where 조건에 userId 포함). 멱등.
   * 0건 삭제도 정상 응답. Room broadcast로 'reaction:removed' 알림.
   */
  @SubscribeMessage('reaction:remove')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async onReactionRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ReactionEventDto,
  ) {
    const userId = this.requireUserId(client);
    const result = await this.chatService.removeReaction(
      dto.messageId,
      userId,
      dto.emoji,
    );
    this.server.to(`room:${result.roomId}`).emit('reaction:removed', {
      messageId: result.messageId,
      userId: result.userId,
      emoji: result.emoji,
    });
    return { ok: true, ...result };
  }

  /**
   * 읽음 표시 — lastReadMessageId 갱신 + 다중 디바이스 사이드바 동기화.
   * 클라이언트는 보통 화면에 마지막 메시지가 보일 때마다 호출.
   *
   * 본인의 다른 디바이스/탭에 notification:unreadCountChanged broadcast.
   * (한쪽에서 읽으면 다른 쪽 사이드바 뱃지가 0으로 갱신됨)
   */
  @SubscribeMessage('message:read')
  async onMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; messageId: string },
  ) {
    if (!data?.roomId || !data?.messageId) {
      throw new WsException('roomId와 messageId가 필요합니다.');
    }
    const userId = this.requireUserId(client);

    await this.chatService.markAsRead(data.roomId, userId, data.messageId);

    const unreadCount = await this.chatService.getUnreadCount(
      data.roomId,
      userId,
    );
    this.server.to(`user:${userId}`).emit('notification:unreadCountChanged', {
      roomId: data.roomId,
      unreadCount,
    });

    // 같은 방의 다른 멤버에게 broadcast — 사용자 X가 메시지 Y까지 읽었음.
    // 받는 측은 client-side로 본인 메시지 옆 "안 읽은 사람 수" badge 재계산.
    // (per-message readByCount를 backend에서 계산하지 않고 lastReadMessageId만 전파)
    this.server.to(`room:${data.roomId}`).emit('room:readUpdated', {
      roomId: data.roomId,
      userId,
      lastReadMessageId: data.messageId,
    });

    return { ok: true, unreadCount };
  }

  // ---------------------------------------------------------
  // 타이핑 인디케이터 — in-memory broadcast (DB 저장 X).
  // 클라이언트 측 onChange debounce + idle timeout으로 stop 자동 호출 권장.
  // ---------------------------------------------------------
  @SubscribeMessage('typing:update')
  async onTypingUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    if (!data?.roomId || typeof data.isTyping !== 'boolean') {
      throw new WsException('roomId와 isTyping이 필요합니다.');
    }
    const userId = this.requireUserId(client);
    // 멤버 검증 — 비멤버가 spam 못 하게 (캐시 hit이면 DB query 절감)
    await this.chatService.assertMembership(data.roomId, userId);

    // 본인 제외 같은 방 멤버에게만 broadcast. `client.to(...)`가 sender exclude.
    client.to(`room:${data.roomId}`).emit('typing:update', {
      roomId: data.roomId,
      userId,
      isTyping: data.isTyping,
    });
    return { ok: true };
  }

  // ---------------------------------------------------------
  // 내부 유틸
  // ---------------------------------------------------------

  /**
   * 토큰 검증을 통과한 socket이라면 client.data.user.id가 반드시 존재해야 함.
   * 만에 하나 누락 시 즉시 차단.
   */
  private requireUserId(client: Socket): string {
    const id = client.data.user?.id as string | undefined;
    if (!id) throw new WsException('Unauthorized');
    return id;
  }
}
