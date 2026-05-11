import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatRoomType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ATTACHMENT_MIME_WHITELIST,
  getSizeLimitFor,
  StorageService,
} from './storage.service';

const MESSAGE_PAGE_DEFAULT = 50;
const MESSAGE_PAGE_MAX = 100;
const ROOM_PAGE_DEFAULT = 20;
const ROOM_PAGE_MAX = 50;

interface CreateRoomInput {
  type: 'DIRECT' | 'GROUP';
  name?: string;
  description?: string;
  memberIds: string[];
}

/**
 * Cursor 페이로드 — base64url로 직렬화되어 클라이언트에 opaque token으로 전달.
 * 클라이언트는 내부 구조 파악 불필요. 서버만 인코딩/디코딩.
 *
 * timestamp 필드 + id 조합으로 tie-breaking. JS Date의 ms 정밀도 한계로
 * 같은 ms에 INSERT된 두 row가 페이지 경계에 걸리는 누락 시나리오를 방어.
 */
interface MessageCursor {
  /** ChatMessage.createdAt (ISO 8601) */
  createdAt: string;
  /** ChatMessage.id (UUID) */
  id: string;
}

interface RoomCursor {
  /** ChatRoom.lastMessageAt (ISO 8601). null 방은 cursor 미발급 */
  lastMessageAt: string;
  /** ChatRoom.id (UUID) */
  id: string;
}

/** 인앱 알림 — 'notification:newMessage' 페이로드 (shared/types/chat.ts와 동기화) */
export interface NewMessageNotificationPayload {
  roomId: string;
  roomName: string | null;
  senderName: string;
  preview: string;
  unreadCount: number;
}

/** Gateway가 멤버별로 emit할 수 있게 묶어 반환 */
export interface MemberNotification {
  userId: string;
  payload: NewMessageNotificationPayload;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ---------------------------------------------------------
  // 첨부 마커 파싱·검증 — §16 정책
  //
  // 메시지 본문에 [[file:path|name|size|mime]] / [[image:path|name|size|mime]]
  // 마커가 inline으로 들어옴. saveMessage / editMessage에서 호출해 마커 형식을
  // 검증(path 형식, MIME 화이트리스트, size 한도). 검증 실패 시 400.
  //
  // 메시지가 실제로 path에 파일이 업로드됐는지까지는 검증 X — 사용자가 upload-url을
  // 정상 흐름으로 받았다면 path는 backend가 발급한 형식. 위조 시도 시 isValidPath
  // 정규식이 차단. 위조 path는 다음 sign 단계에서 404로 자연 차단(파일 없음).
  // ---------------------------------------------------------

  private readonly ATTACHMENT_MARKER_REGEX =
    /\[\[(file|image):([^|\]]+)\|([^|\]]*)\|(\d+)\|([^\]]+)\]\]/g;

  validateAttachmentMarkers(content: string): void {
    let m: RegExpExecArray | null;
    const re = new RegExp(this.ATTACHMENT_MARKER_REGEX.source, 'g');
    let count = 0;
    while ((m = re.exec(content)) !== null) {
      count += 1;
      if (count > 10) {
        throw new BadRequestException('한 메시지에 최대 10개까지 첨부할 수 있습니다.');
      }
      const [, , path, , sizeStr, mime] = m;
      if (!this.storage.isValidPath(path)) {
        throw new BadRequestException('유효하지 않은 첨부 경로입니다.');
      }
      if (!ATTACHMENT_MIME_WHITELIST.has(mime)) {
        throw new BadRequestException(`지원하지 않는 첨부 형식입니다: ${mime}`);
      }
      const size = Number(sizeStr);
      const limit = getSizeLimitFor(mime);
      if (limit !== null && size > limit) {
        const mb = Math.round(limit / 1024 / 1024);
        throw new BadRequestException(`첨부 파일이 한도(${mb}MB)를 초과합니다.`);
      }
    }
  }

  /**
   * 메시지 본문에서 첨부 path 추출.
   *
   * sign-url endpoint가 path별 채팅방 멤버 검증 + deletedAt 검증할 때 사용.
   * 한 사용자가 자기 멤버십 외 path에 sign 요청해도 검증으로 막힘.
   */
  extractAttachmentPaths(content: string): string[] {
    const paths: string[] = [];
    const re = new RegExp(this.ATTACHMENT_MARKER_REGEX.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      paths.push(m[2]);
    }
    return paths;
  }

  /**
   * 표시/다운로드용 signed URL 일괄 발급.
   *
   * 검증:
   *  1. 각 path가 어떤 ChatMessage.content에 포함되어 있는지 prisma 조회
   *  2. 그 메시지의 채팅방 멤버여야 발급 (사용자가 보지 못할 path는 access 차단)
   *  3. 메시지 deletedAt이면 발급 X (null)
   *
   * 결과: { path, url, expiresAt } 배열. url이 null이면 사용자가 접근 불가.
   */
  async signAttachmentUrls(
    userId: string,
    paths: string[],
  ): Promise<
    Array<{
      path: string;
      url: string | null;
      expiresAt: string | null;
    }>
  > {
    // 1. paths 중 유효 형식인 것만 통과
    const validPaths = paths.filter((p) => this.storage.isValidPath(p));

    // 2. 그 paths를 content에 포함하는 메시지 + 멤버십 일괄 조회
    //    (path는 UUID 기반이라 cross-room 충돌 X — content LIKE로 충분)
    //    효율: 메시지 한 번 조회 + per-path filter. N+1 회피.
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: validPaths.map((p) => ({ content: { contains: p } })),
      },
      select: {
        roomId: true,
        deletedAt: true,
        content: true,
        room: {
          select: {
            members: {
              where: { userId },
              select: { leftAt: true },
            },
          },
        },
      },
    });

    // path → {roomMember 여부, deletedAt} 매핑
    const pathStatus = new Map<string, { allowed: boolean }>();
    for (const path of validPaths) {
      const msg = messages.find((m) => m.content.includes(path));
      const isMember =
        msg !== undefined &&
        msg.room.members.length > 0 &&
        msg.room.members[0].leftAt === null;
      const visible = msg !== undefined && msg.deletedAt === null;
      pathStatus.set(path, { allowed: isMember && visible });
    }

    // 3. 허용된 path만 signed URL 발급
    const results = await Promise.all(
      paths.map(async (path) => {
        const status = pathStatus.get(path);
        if (!status || !status.allowed) {
          return { path, url: null, expiresAt: null };
        }
        const signed = await this.storage.createSignedUrl(path, 3600);
        if (!signed) {
          return { path, url: null, expiresAt: null };
        }
        return { path, url: signed.url, expiresAt: signed.expiresAt };
      }),
    );
    return results;
  }

  // ---------------------------------------------------------
  // 채팅방 생성
  // ---------------------------------------------------------

  /**
   * 채팅방 생성. DIRECT는 동일한 양자 조합이 이미 있으면 기존 방 반환.
   * GROUP은 매번 새 방 생성.
   * creator는 자동으로 멤버에 포함된다.
   */
  async createRoom(creatorId: string, input: CreateRoomInput) {
    const { type, name, description, memberIds } = input;
    const allMemberIds = Array.from(new Set([creatorId, ...memberIds]));

    if (type === 'DIRECT') {
      if (memberIds.length !== 1) {
        throw new BadRequestException(
          'DIRECT 채팅방은 상대방 한 명만 지정할 수 있습니다.',
        );
      }
      const otherUserId = memberIds[0];
      if (otherUserId === creatorId) {
        throw new BadRequestException('자기 자신과는 DIRECT 방을 만들 수 없습니다.');
      }

      // 기존 양자 DIRECT 방 조회 (양쪽 모두 활성 멤버)
      const existing = await this.findDirectRoomBetween(creatorId, otherUserId);
      if (existing) return this.getRoom(existing.id, creatorId);
    } else if (type === 'GROUP') {
      if (!name || name.trim().length === 0) {
        throw new BadRequestException('GROUP 채팅방은 이름이 필요합니다.');
      }
      if (allMemberIds.length < 2) {
        throw new BadRequestException(
          'GROUP 채팅방은 본인 외 1명 이상이 필요합니다.',
        );
      }
    }

    const room = await this.prisma.chatRoom.create({
      data: {
        type: type as ChatRoomType,
        name: type === 'GROUP' ? name : null,
        description: description ?? null,
        creatorId,
        members: {
          create: allMemberIds.map((userId) => ({ userId })),
        },
      },
      include: this.roomInclude(),
    });

    return this.shapeRoom(room, creatorId, 0);
  }

  /**
   * 두 사용자 사이의 활성 DIRECT 방을 찾는다 (양쪽 모두 leftAt: null).
   * 없으면 null.
   */
  private async findDirectRoomBetween(userA: string, userB: string) {
    return this.prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId: userA, leftAt: null } } },
          { members: { some: { userId: userB, leftAt: null } } },
        ],
      },
    });
  }

  // ---------------------------------------------------------
  // 채팅방 조회
  // ---------------------------------------------------------

  /**
   * 사용자가 속한 채팅방 목록 (unreadCount 포함, 사이드바용)
   *
   * 정렬: lastMessageAt DESC nulls last → 메시지 있는 방이 먼저, id desc로 tie-break
   * Cursor: base64url 인코딩된 (lastMessageAt, id) — opaque token
   *
   * null lastMessageAt(메시지 없는 방)은 cursor 영역 밖 (nulls last로 끝에 위치).
   * 마지막 페이지가 null 방으로 끝나면 nextCursor=null로 종료.
   */
  async getUserRooms(
    userId: string,
    opts: {
      type?: ChatRoomType;
      limit?: number;
      cursor?: string;
      /** true면 hiddenAt 있는 방도 포함 (default: false — 숨긴 채팅 제외) */
      includeHidden?: boolean;
      /** true면 hidden인 방만 반환 (숨김 채팅 보기 전용 화면) */
      onlyHidden?: boolean;
    } = {},
  ) {
    const limit = Math.min(opts.limit ?? ROOM_PAGE_DEFAULT, ROOM_PAGE_MAX);
    const decoded = opts.cursor
      ? this.decodeCursor<RoomCursor>(opts.cursor)
      : null;

    // 멤버십 필터 — 항상 leftAt: null (나간 방 제외)
    // hiddenAt: includeHidden / onlyHidden 옵션에 따라 분기
    const memberFilter = {
      userId,
      leftAt: null,
      ...(opts.onlyHidden
        ? { hiddenAt: { not: null } }
        : opts.includeHidden
          ? {}
          : { hiddenAt: null }),
    };

    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        members: { some: memberFilter },
        ...(opts.type ? { type: opts.type } : {}),
        ...(decoded
          ? {
              OR: [
                // 명백히 이전 시각의 방
                { lastMessageAt: { lt: new Date(decoded.lastMessageAt) } },
                // 같은 시각이면 id로 tie-break
                {
                  AND: [
                    { lastMessageAt: new Date(decoded.lastMessageAt) },
                    { id: { lt: decoded.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
      take: limit,
      include: this.roomInclude(),
    });

    const roomsWithUnread = await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await this.getUnreadCount(room.id, userId);
        return this.shapeRoom(room, userId, unreadCount);
      }),
    );

    const last = rooms[rooms.length - 1];
    const nextCursor =
      rooms.length === limit && last.lastMessageAt
        ? this.encodeCursor<RoomCursor>({
            lastMessageAt: last.lastMessageAt.toISOString(),
            id: last.id,
          })
        : null;

    return { rooms: roomsWithUnread, nextCursor };
  }

  /**
   * 단일 채팅방 상세. 멤버가 아니면 ForbiddenException.
   */
  async getRoom(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: this.roomInclude(),
    });
    if (!room) throw new NotFoundException('채팅방을 찾을 수 없습니다.');

    const myMembership = room.members.find(
      (m) => m.userId === userId && m.leftAt === null,
    );
    if (!myMembership) {
      throw new ForbiddenException('해당 채팅방의 멤버가 아닙니다.');
    }

    const unreadCount = await this.getUnreadCount(roomId, userId);
    return this.shapeRoom(room, userId, unreadCount);
  }

  // ---------------------------------------------------------
  // 메시지 조회 (cursor-based 페이징)
  // ---------------------------------------------------------

  /**
   * 채팅방 메시지 페이징 조회.
   *
   * 정렬: createdAt DESC (최신이 먼저), id desc로 tie-break
   *   → 클라이언트가 화면 표시 시 reverse
   * Cursor: base64url 인코딩된 (createdAt, id) — opaque token
   *
   * 같은 ms timestamp 두 메시지가 페이지 경계에 걸려 누락되는 시나리오 방어:
   *   WHERE createdAt < cursor.createdAt
   *      OR (createdAt = cursor.createdAt AND id < cursor.id)
   *
   * deletedAt 메시지도 포함됨 (클라이언트가 placeholder 렌더).
   */
  async getMessages(
    roomId: string,
    userId: string,
    opts: { cursor?: string; limit?: number } = {},
  ) {
    await this.assertMembership(roomId, userId);

    const limit = Math.min(opts.limit ?? MESSAGE_PAGE_DEFAULT, MESSAGE_PAGE_MAX);
    const decoded = opts.cursor
      ? this.decodeCursor<MessageCursor>(opts.cursor)
      : null;

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: new Date(decoded.createdAt) } },
                {
                  AND: [
                    { createdAt: new Date(decoded.createdAt) },
                    { id: { lt: decoded.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      include: this.messageInclude(),
    });

    const last = messages[messages.length - 1];
    const nextCursor =
      messages.length === limit
        ? this.encodeCursor<MessageCursor>({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return { messages, nextCursor };
  }

  // ---------------------------------------------------------
  // 메시지 저장 (Socket 'message:send' 가 사용)
  // ---------------------------------------------------------

  /**
   * 새 메시지 저장 + 채팅방의 lastMessage·lastMessageAt 갱신.
   * Gateway 핸들러는 senderId를 client.data.user.id에서 가져와 호출 (위조 불가).
   */
  async saveMessage(
    roomId: string,
    senderId: string,
    content: string,
    parentId?: string,
    options?: { skipMembershipCheck?: boolean },
  ) {
    if (!options?.skipMembershipCheck) {
      await this.assertMembership(roomId, senderId);
    }

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('메시지 내용이 비어 있습니다.');
    }
    // §16 첨부 마커 검증 (path 형식 / MIME 화이트리스트 / size 한도)
    this.validateAttachmentMarkers(content);
    if (parentId) {
      const parent = await this.prisma.chatMessage.findUnique({
        where: { id: parentId },
        select: { roomId: true },
      });
      if (!parent || parent.roomId !== roomId) {
        throw new BadRequestException(
          '답글 대상 메시지가 존재하지 않거나 다른 방의 메시지입니다.',
        );
      }
    }

    // 메시지 INSERT만 await — ack/broadcast critical path
    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        content,
        parentId: parentId ?? null,
      },
      include: this.messageInclude(),
    });

    // 방 lastMessage 갱신은 fire-and-forget — 사용자 응답 latency에서 제외
    // (broadcast 페이로드에 메시지 정보 이미 들어가 사이드바도 즉시 갱신됨)
    // 실패 시 exponential backoff로 최대 3회 재시도 → 일관성 보장 강화
    this.updateLastMessageWithRetry(roomId, content, message.createdAt);

    return message;
  }

  // ---------------------------------------------------------
  // 메시지 수정 / 삭제 (Day 6)
  // ---------------------------------------------------------

  /**
   * 본인 메시지 내용 수정. editedAt 갱신.
   *
   * - 시간 제한 없음 (Phase A 정책 — 01-decisions.md §3)
   * - 이미 deletedAt이 설정된 메시지는 수정 불가 (404)
   * - senderId !== userId면 403
   */
  async editMessage(messageId: string, userId: string, newContent: string) {
    const trimmed = newContent?.trim() ?? '';
    if (trimmed.length === 0) {
      throw new BadRequestException('메시지 내용이 비어 있습니다.');
    }
    // §16 첨부 마커 검증 — 편집 시 마커가 새로 들어오거나 변경된 경우 대비
    this.validateAttachmentMarkers(trimmed);

    const existing = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, deletedAt: true, roomId: true },
    });
    if (!existing) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }
    if (existing.deletedAt !== null) {
      throw new NotFoundException('이미 삭제된 메시지입니다.');
    }
    if (existing.senderId !== userId) {
      throw new ForbiddenException('본인 메시지만 수정할 수 있습니다.');
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content: trimmed, editedAt: new Date() },
      include: this.messageInclude(),
    });
  }

  /**
   * 본인 메시지 소프트 삭제. deletedAt 설정만, row 보존.
   *
   * - 답글의 부모로 참조되는 경우에도 row 유지 (부모-자식 관계 무결성)
   * - 이미 삭제된 메시지면 멱등 (재호출해도 ok)
   * - senderId !== userId면 403
   *
   * 반환: { messageId, roomId } — gateway가 room broadcast 할 때 사용
   */
  async deleteMessage(messageId: string, userId: string) {
    const existing = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        deletedAt: true,
        roomId: true,
        createdAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }
    if (existing.senderId !== userId) {
      throw new ForbiddenException('본인 메시지만 삭제할 수 있습니다.');
    }
    if (existing.deletedAt !== null) {
      // 이미 소프트 삭제된 경우 멱등 처리 (재호출 시 별도 update 없이 그대로 반환)
      return {
        messageId,
        roomId: existing.roomId,
        roomLastMessage: null as null | {
          lastMessage: string | null;
          lastMessageAt: Date | null;
        },
      };
    }

    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    // 사이드바 lastMessage 일관성: 삭제한 메시지가 그 방의 lastMessage였다면 재계산
    // - 다른 메시지가 있으면 그 중 가장 최신(deletedAt is null)으로 set
    // - 모두 삭제됐으면 null
    // 사용자 응답 critical path 밖. 실패해도 broadcast/ack는 정상
    const roomLastMessage = await this.recomputeRoomLastMessageIfNeeded(
      existing.roomId,
      existing.createdAt,
    );

    return { messageId, roomId: existing.roomId, roomLastMessage };
  }

  /**
   * chat_rooms.lastMessage 재계산 — 삭제된 메시지가 lastMessage였던 케이스용.
   *
   * - 비교 기준: room.lastMessageAt === deletedMessage.createdAt 이면 그 메시지가 lastMessage
   * - 일치 시 chat_messages 중 deletedAt is null인 가장 최신 메시지로 재set
   * - 일치 안 함(삭제된 게 옛 메시지) 또는 활성 메시지 0건이면 명확히 처리
   *
   * 반환: 갱신된 { lastMessage, lastMessageAt } 또는 null (no-op 케이스)
   *       Gateway가 message:deleted broadcast에 포함시켜 frontend 사이드바도 즉시 갱신.
   */
  private async recomputeRoomLastMessageIfNeeded(
    roomId: string,
    deletedMessageCreatedAt: Date,
  ): Promise<{ lastMessage: string | null; lastMessageAt: Date | null } | null> {
    try {
      const room = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { lastMessageAt: true },
      });
      // lastMessageAt이 정확히 일치할 때만 재계산 — 삭제된 게 옛 메시지면 영향 없음
      if (
        !room?.lastMessageAt ||
        room.lastMessageAt.getTime() !== deletedMessageCreatedAt.getTime()
      ) {
        return null;
      }

      // 활성 메시지 중 가장 최신 1개 (자기 자신은 이미 deletedAt 됨)
      const fallback = await this.prisma.chatMessage.findFirst({
        where: { roomId, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { content: true, createdAt: true },
      });

      const lastMessage = fallback ? this.preview(fallback.content) : null;
      const lastMessageAt = fallback?.createdAt ?? null;

      await this.prisma.chatRoom.update({
        where: { id: roomId },
        data: { lastMessage, lastMessageAt },
      });

      return { lastMessage, lastMessageAt };
    } catch (err) {
      // 실패해도 핵심 동작(소프트 삭제) 정상. 다음 메시지 도착 시 자동 회복
      // eslint-disable-next-line no-console
      console.error(
        `recomputeRoomLastMessage failed for room ${roomId}`,
        err,
      );
      return null;
    }
  }

  // ---------------------------------------------------------
  // 메시지 반응 (이모지) — Day 7 후반에서 Day 8 앞당김
  // ---------------------------------------------------------

  /**
   * 본인이 메시지에 이모지 반응 추가.
   * - 멤버십 검증 (해당 메시지 방의 활성 멤버여야 함)
   * - 삭제된 메시지에는 반응 불가 (NotFound)
   * - 같은 (messageId, userId, emoji) 중복 시 ConflictException (@@unique 제약 활용)
   *
   * 반환: MessageReaction + roomId (Gateway가 broadcast 시 사용)
   */
  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, roomId: true, deletedAt: true },
    });
    if (!message) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }
    if (message.deletedAt !== null) {
      throw new NotFoundException('삭제된 메시지에는 반응할 수 없습니다.');
    }

    await this.assertMembership(message.roomId, userId);

    try {
      const reaction = await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
      return { ...reaction, roomId: message.roomId };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('이미 같은 이모지 반응이 있습니다.');
      }
      throw err;
    }
  }

  /**
   * 본인 반응 제거. 본인이 추가한 반응만 삭제됨 (where 조건에 userId 포함).
   * 멱등 — 없는 반응 삭제 시도는 0건 삭제 후 정상 응답.
   *
   * 반환: { messageId, userId, emoji, roomId } (Gateway가 broadcast 시 사용)
   */
  async removeReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { roomId: true },
    });
    if (!message) {
      throw new NotFoundException('메시지를 찾을 수 없습니다.');
    }

    await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId, emoji },
    });

    return { messageId, userId, emoji, roomId: message.roomId };
  }

  // ---------------------------------------------------------
  // 인앱 알림 페이로드 빌더 (Gateway가 user:<id> room으로 broadcast)
  // ---------------------------------------------------------

  /**
   * 새 메시지 알림 페이로드를 멤버별로 생성한다.
   * Gateway는 반환된 배열을 순회하며 server.to(`user:${userId}`).emit(...) 한다.
   *
   * 멤버별로 unreadCount가 다르므로 개별 계산 필요 (N+1 쿼리, Phase A 트래픽엔 OK).
   * 송신자도 포함됨 — 본인의 다른 디바이스 사이드바 갱신 위해 (preview/lastMessageAt).
   */
  /**
   * 방의 활성 멤버 ID 목록 — message:deleted 등에서 user:<id> broadcast 대상 산출용.
   * leftAt is null인 멤버만 반환 (Phase A에선 leftAt 갱신 기능 없어 사실상 모든 멤버).
   */
  async getActiveMemberIds(roomId: string): Promise<string[]> {
    const members = await this.prisma.chatRoomMember.findMany({
      where: { roomId, leftAt: null },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // -----------------------------------------------------
  // 방 멤버십 관리 — 나가기 / 숨기기 / 숨김 해제
  // -----------------------------------------------------

  /**
   * 방에서 영구 나가기. leftAt 갱신.
   * - 이후 message:send broadcast 대상에서 제외
   * - 옛 메시지는 보존 (작성자 row 그대로)
   * - 다시 들어가려면 다른 멤버가 invite (Phase B) — 또는 같은 사용자 다시 추가
   * - 멱등 — 이미 나간 멤버면 no-op
   */
  async leaveRoom(roomId: string, userId: string) {
    const membership = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { leftAt: true },
    });
    if (!membership) {
      throw new NotFoundException('방 멤버가 아닙니다.');
    }
    if (membership.leftAt !== null) {
      return { ok: true, alreadyLeft: true };
    }
    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { leftAt: new Date() },
    });
    return { ok: true, alreadyLeft: false };
  }

  /**
   * 방을 목록에서 숨기기. hiddenAt만 갱신.
   * - 메시지는 정상 수신 (broadcast 그대로)
   * - GET /rooms 기본 응답에서 제외 (?includeHidden=true 또는 ?onlyHidden=true로 조회 가능)
   * - 멤버십 유지 (leftAt 영향 없음)
   * - mutedAt은 그대로 — 명시 mute와 hide의 의미를 분리
   *   토스트 차단은 frontend가 hidden 방을 별도 분기로 처리 (mute와 OR 조건)
   *   숨김 해제 시 hide 전 mute 상태로 자연스럽게 복귀
   */
  async hideRoom(roomId: string, userId: string) {
    await this.assertMembership(roomId, userId);
    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { hiddenAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * 방 숨김 해제. hiddenAt = null.
   * - mutedAt은 그대로 — hide 전에 mute였다면 그대로 mute / 아니었으면 그대로 unmute
   */
  async unhideRoom(roomId: string, userId: string) {
    await this.assertMembership(roomId, userId);
    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { hiddenAt: null },
    });
    return { ok: true };
  }

  /**
   * 알림 끄기 (mute). mutedAt 갱신.
   * - 메시지 데이터는 정상 수신 (broadcast 그대로) — 사이드바 unreadCount 등 정상 동작
   * - 클라이언트에서 토스트 알림만 skip (notification:newMessage 받아도 표시 X)
   * - 목록에서는 그대로 보임 (hidden과 별개)
   */
  async muteRoom(roomId: string, userId: string) {
    await this.assertMembership(roomId, userId);
    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { mutedAt: new Date() },
    });
    return { ok: true };
  }

  /** 알림 켜기. mutedAt = null. */
  async unmuteRoom(roomId: string, userId: string) {
    await this.assertMembership(roomId, userId);
    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { mutedAt: null },
    });
    return { ok: true };
  }

  async buildNewMessageNotifications(
    roomId: string,
    senderName: string,
    fullContent: string,
  ): Promise<MemberNotification[]> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: {
        name: true,
        members: {
          where: { leftAt: null },
          select: { userId: true },
        },
      },
    });
    if (!room) return [];

    const preview = this.preview(fullContent);

    return Promise.all(
      room.members.map(async ({ userId }) => ({
        userId,
        payload: {
          roomId,
          roomName: room.name,
          senderName,
          preview,
          unreadCount: await this.getUnreadCount(roomId, userId),
        },
      })),
    );
  }

  // ---------------------------------------------------------
  // 읽음 처리 (모델 C: lastReadMessageId)
  // ---------------------------------------------------------

  /**
   * 채팅방의 가장 최근 메시지로 lastReadMessageId 갱신.
   * 방 진입(conversation:join) 시 자동 읽음 처리에 사용.
   *
   * 반환:
   *  - 메시지가 있어 갱신했으면 갱신 후 unreadCount (보통 0)
   *  - 메시지가 없는 방이면 null (아무것도 갱신 안 함)
   */
  async markRoomAsReadToLatest(
    roomId: string,
    userId: string,
    options?: { skipMembershipCheck?: boolean },
  ): Promise<number | null> {
    if (!options?.skipMembershipCheck) {
      await this.assertMembership(roomId, userId);
    }

    const lastMessage = await this.prisma.chatMessage.findFirst({
      where: { roomId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!lastMessage) return null;

    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadMessageId: lastMessage.id },
    });

    return this.getUnreadCount(roomId, userId);
  }

  /**
   * 사용자의 lastReadMessageId 갱신.
   * messageId가 해당 방의 메시지인지 검증 후 갱신.
   */
  async markAsRead(roomId: string, userId: string, messageId: string) {
    await this.assertMembership(roomId, userId);

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { roomId: true },
    });
    if (!message || message.roomId !== roomId) {
      throw new NotFoundException(
        '해당 메시지가 존재하지 않거나 다른 방의 메시지입니다.',
      );
    }

    await this.prisma.chatRoomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadMessageId: messageId },
    });
  }

  // ---------------------------------------------------------
  // 내부 유틸
  // ---------------------------------------------------------

  /**
   * 사용자가 활성 멤버인지 검증. 아니면 ForbiddenException.
   * 방 자체가 없으면 NotFoundException.
   *
   * 외부(Gateway 등)에서도 호출 가능하도록 public.
   * 비싼 fetch(getRoom)를 피하고 싶을 때 직접 사용.
   */
  async assertMembership(roomId: string, userId: string) {
    const membership = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { leftAt: true, room: { select: { id: true } } },
    });
    if (!membership) {
      // 방이 아예 없는지 / 내가 속하지 않은 건지 구분
      const roomExists = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { id: true },
      });
      if (!roomExists) {
        throw new NotFoundException('채팅방을 찾을 수 없습니다.');
      }
      throw new ForbiddenException('해당 채팅방의 멤버가 아닙니다.');
    }
    if (membership.leftAt !== null) {
      throw new ForbiddenException('이미 나간 채팅방입니다.');
    }
  }

  /**
   * unreadCount 계산 — 모델 C 기반.
   * lastReadMessageId 이후 메시지 중 deletedAt 없고 본인이 보낸 게 아닌 것 COUNT.
   * 한 번도 안 읽은 경우(lastReadMessageId === null)는 모든 미삭제·타인 메시지 카운트.
   *
   * 외부(Gateway 등)에서 다중 디바이스 동기화 등에 사용 가능하도록 public.
   *
   * 쿼리 2회: membership(+lastReadMessage include) → count.
   * 직전 구현은 membership / lastReadMessage / count 3회. include로 1회 절감.
   */
  async getUnreadCount(
    roomId: string,
    userId: string,
  ): Promise<number> {
    const member = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { lastReadMessage: { select: { createdAt: true } } },
    });
    if (!member) return 0;

    return this.prisma.chatMessage.count({
      where: {
        roomId,
        deletedAt: null,
        senderId: { not: userId },
        ...(member.lastReadMessage && {
          createdAt: { gt: member.lastReadMessage.createdAt },
        }),
      },
    });
  }

  /**
   * 사이드바용 메시지 미리보기 — 길면 잘라서 저장.
   */
  private preview(content: string, max = 100) {
    // 마커는 절대 raw로 잘리면 안 됨 — 100자 슬라이스 전에 사람용 문구로 치환.
    // (잘린 마커가 frontend regex와 안 매치되면 raw `[[file:rooms/...` 같은 게 그대로 노출됨)
    // 텍스트 + 첨부 혼합 시 "텍스트 (이미지)" / "텍스트 (파일)" 형식.
    // 혼합 시 (이미지+파일 동시) → "(파일)"로 통합. frontend `summarizePreview`와 동일 로직.
    const hasFile = /\[\[file:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/.test(content);
    const hasImage = /\[\[image:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/.test(content);

    let s = content
      .replace(/\[\[link:[^|\]]+\|([^\]]+)\]\]/g, '$1')
      .replace(/\[\[file:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/g, '')
      .replace(/\[\[image:[^|\]]+\|[^|\]]*\|\d+\|[^\]]+\]\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (s) {
      // 텍스트 + 첨부 — 라벨 append
      if (hasFile) s = `${s} (파일)`;
      else if (hasImage) s = `${s} (이미지)`;
    } else {
      // 텍스트 없음 — 첨부 안내 문구
      if (hasFile) s = '파일을 보냈습니다.';
      else if (hasImage) s = '이미지를 보냈습니다.';
    }
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }

  /**
   * 방 lastMessage / lastMessageAt 갱신 with exponential backoff retry.
   * - 사용자 응답 critical path 밖에서 실행 (fire-and-forget)
   * - 실패 시 1s → 2s → 4s 간격으로 최대 3회 재시도
   * - lastMessageAt에 메시지의 실제 createdAt을 사용 — retry 동안 다른 메시지가
   *   먼저 갱신해도 시간 비교로 더 최신 것만 적용 (out-of-order 방지)
   *
   * Phase A 트레이드오프: 트랜잭션 atomicity 일부 약화 대신 ack latency -130ms.
   * 실패가 누적되면 다음 메시지에서 자동 회복되거나 재시도가 처리.
   */
  private updateLastMessageWithRetry(
    roomId: string,
    content: string,
    messageCreatedAt: Date,
    attempt = 0,
  ): void {
    const MAX_ATTEMPTS = 3;

    // updateMany로 조건부 갱신 — 더 늦은 lastMessageAt이 이미 있으면 no-op (out-of-order 방지)
    void this.prisma.chatRoom
      .updateMany({
        where: {
          id: roomId,
          OR: [
            { lastMessageAt: null },
            { lastMessageAt: { lt: messageCreatedAt } },
          ],
        },
        data: {
          lastMessage: this.preview(content),
          lastMessageAt: messageCreatedAt,
        },
      })
      .catch((err) => {
        if (attempt < MAX_ATTEMPTS - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          // eslint-disable-next-line no-console
          console.warn(
            `chatRoom.lastMessage update failed (attempt ${attempt + 1}/${MAX_ATTEMPTS}), retrying in ${delayMs}ms`,
            err,
          );
          setTimeout(() => {
            this.updateLastMessageWithRetry(
              roomId,
              content,
              messageCreatedAt,
              attempt + 1,
            );
          }, delayMs);
        } else {
          // eslint-disable-next-line no-console
          console.error(
            `chatRoom.lastMessage update final failure after ${MAX_ATTEMPTS} attempts. Room ${roomId} will recover on next message.`,
            err,
          );
        }
      });
  }

  /**
   * Cursor를 base64url로 직렬화 (URL-safe + 패딩 없음).
   * 클라이언트는 내부 구조 파악 불필요 — opaque token으로 취급.
   */
  private encodeCursor<T>(payload: T): string {
    return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  }

  /**
   * Cursor 디코딩. 잘못된 형식이면 BadRequestException.
   */
  private decodeCursor<T>(token: string): T {
    try {
      return JSON.parse(
        Buffer.from(token, 'base64url').toString('utf-8'),
      ) as T;
    } catch {
      throw new BadRequestException('잘못된 cursor 형식입니다.');
    }
  }

  // ---------------------------------------------------------
  // include 헬퍼 (Prisma payload 반복 제거)
  // ---------------------------------------------------------

  private roomInclude() {
    return {
      members: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, profileImage: true } },
        },
      },
    } satisfies Prisma.ChatRoomInclude;
  }

  private messageInclude() {
    return {
      sender: { select: { id: true, name: true, profileImage: true } },
      reactions: true,
      parent: {
        select: {
          id: true,
          content: true,
          senderId: true,
          deletedAt: true,
        },
      },
    } satisfies Prisma.ChatMessageInclude;
  }

  /**
   * Prisma 결과에 unreadCount + 본인 멤버십 메타(mutedAt/hiddenAt)를 더해 응답 형태로 가공.
   * (확장 필드가 늘어나면 여기에 추가)
   */
  private shapeRoom<
    T extends {
      members: Array<{
        userId: string;
        mutedAt: Date | null;
        hiddenAt: Date | null;
      }>;
    },
  >(
    room: T,
    userId: string,
    unreadCount: number,
  ): T & {
    unreadCount: number;
    mutedAt: Date | null;
    hiddenAt: Date | null;
  } {
    const my = room.members.find((m) => m.userId === userId);
    return {
      ...room,
      unreadCount,
      mutedAt: my?.mutedAt ?? null,
      hiddenAt: my?.hiddenAt ?? null,
    };
  }
}
