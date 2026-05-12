import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

/**
 * §B-DM-9 알림 서비스.
 *
 * 다른 모듈(chat, apply 등)의 트리거 지점에서 `create()`를 호출해 row를 만들고,
 * NotificationGateway가 socket으로 user:<id>에 emit. 받는 사람의 NotificationCenter가
 * dropdown 열 때 list / 클릭 시 markRead.
 *
 * 알림 수 증가 대비:
 *  - createdAt index로 최신순 빠른 조회
 *  - readAt index로 unread count 빠른 카운팅
 *  - hard limit: 클라이언트는 50개 페이지로 끊어 받음 (현 phase는 paging 단순 처리)
 */
@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationGateway,
  ) {}

  /**
   * 알림 생성 + 즉시 socket emit. 트리거 모듈(chat·apply 등)에서 호출.
   * 본인이 본인에게 보내는 케이스(senderId === userId)는 호출자가 사전에 거르는 것이 권장.
   */
  async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    linkTo?: string;
  }): Promise<Notification> {
    const notif = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        linkTo: input.linkTo ?? null,
      },
    });
    // 실시간 socket 푸시 — `user:<id>` 채널 (ChatGateway connect 시 join됨).
    this.gateway.emitToUser(input.userId, notif);
    return notif;
  }

  /**
   * 사용자의 알림 목록 — 최신순. 페이지는 cursor-less single page (50개).
   * Phase B 후속 필요 시 cursor 추가.
   */
  async list(userId: string, opts: { limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 100);
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** 안 읽은 알림 수 — badge용. */
  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  /**
   * 단일 알림 읽음 처리. 권한 체크 — 본인 알림만 read 가능.
   */
  async markRead(id: string, userId: string): Promise<Notification> {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('알림을 찾을 수 없습니다.');
    if (notif.userId !== userId) {
      throw new ForbiddenException('본인 알림만 처리할 수 있습니다.');
    }
    // 이미 읽음이면 같은 readAt 유지 (멱등). update가 마지막 readAt을 갱신하진 않게 분기.
    if (notif.readAt) return notif;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /** 본인 모든 안 읽은 알림을 일괄 read 처리. */
  async markAllRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
