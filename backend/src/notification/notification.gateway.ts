import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Notification } from '@prisma/client';
import { Server } from 'socket.io';

/**
 * §B-DM-9 알림 socket emit — 별도 핸들러 없음 (서비스가 emitToUser로 트리거).
 *
 * default namespace 공유 (ChatGateway와 같음) — 같은 socket 연결을 통해 chat 이벤트와
 * notification 이벤트 모두 흐름. 클라이언트가 connect 시 ChatGateway 핸들러에서
 * `user:<id>` room에 자동 join됨 — NotificationGateway는 그 room으로 emit만.
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationGateway {
  @WebSocketServer()
  server!: Server;

  /** 알림 생성 직후 socket 푸시. NotificationService가 호출. */
  emitToUser(userId: string, notification: Notification) {
    if (!this.server) return; // 부팅 직후·테스트에서 server 미주입 케이스 방어
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
