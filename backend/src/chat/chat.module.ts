import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

/**
 * 채팅 모듈 - Socket.IO 기반 실시간 채팅 + REST CRUD
 *
 * JwtModule을 자체 등록하는 이유: WsJwtGuard와 ChatGateway가 JwtService.verify로
 * 핸드셰이크 토큰을 검증해야 하기 때문. AuthModule은 JwtModule을 export 하지 않으므로
 * 이쪽에서 같은 secret으로 별도 register. (env가 동일하면 두 모듈은 같은 키로 동작)
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, WsJwtGuard],
  exports: [ChatService],
})
export class ChatModule {}
