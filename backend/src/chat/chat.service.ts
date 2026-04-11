import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 채팅 서비스 - 채팅방 및 메시지 관리 */
@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /** 채팅방 생성 또는 기존 채팅방 조회 */
  async getOrCreateRoom(userIds: string[]) {
    // 두 사용자 간 기존 채팅방 검색
    const existingRoom = await this.prisma.chatRoom.findFirst({
      where: {
        users: {
          every: { userId: { in: userIds } },
        },
      },
      include: { users: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (existingRoom) return existingRoom;

    // 새 채팅방 생성
    return this.prisma.chatRoom.create({
      data: {
        users: {
          create: userIds.map((userId) => ({ userId })),
        },
      },
      include: { users: true },
    });
  }

  /** 메시지 저장 */
  async saveMessage(roomId: string, senderId: string, content: string) {
    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderId,
        content,
        readBy: [senderId],
      },
    });

    // 채팅방 마지막 메시지 업데이트
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessage: content },
    });

    return message;
  }

  /** 채팅방 메시지 목록 조회 */
  async getMessages(roomId: string, take = 50) {
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        sender: { select: { id: true, name: true, profileImage: true } },
      },
    });
  }

  /** 사용자의 채팅방 목록 조회 */
  async getUserRooms(userId: string) {
    return this.prisma.chatRoom.findMany({
      where: {
        users: { some: { userId } },
      },
      include: {
        users: {
          include: {
            user: { select: { id: true, name: true, profileImage: true } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
