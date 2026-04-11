import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

/** 채팅 게이트웨이 - Socket.IO 기반 실시간 채팅 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  /** 클라이언트 연결 */
  handleConnection(client: Socket) {
    console.log(`클라이언트 연결: ${client.id}`);
  }

  /** 클라이언트 연결 해제 */
  handleDisconnect(client: Socket) {
    console.log(`클라이언트 연결 해제: ${client.id}`);
  }

  /** 채팅방 입장 */
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.join(roomId);
    console.log(`${client.id}가 채팅방 ${roomId}에 입장`);
  }

  /** 채팅방 퇴장 */
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.leave(roomId);
  }

  /** 메시지 전송 */
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; senderId: string; content: string },
  ) {
    const message = await this.chatService.saveMessage(
      data.roomId,
      data.senderId,
      data.content,
    );

    // 같은 방의 모든 클라이언트에게 메시지 브로드캐스트
    this.server.to(data.roomId).emit('newMessage', message);
  }
}
