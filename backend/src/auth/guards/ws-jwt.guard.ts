import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket용 JWT 인증 가드
 *
 * 클라이언트가 socket.io 핸드셰이크 시 보낸 토큰(`auth.token`)을 검증하고,
 * 성공하면 `client.data.user`에 사용자 정보를 주입한다. 게이트웨이 핸들러에서는
 * `client.data.user.id`로 안전하게 senderId를 얻을 수 있다 (위조 불가).
 *
 * 사용 위치: backend/src/auth/guards/ (재사용 위해 인증 폴더에 둠)
 * 참고: docs/chat/04-auth-interface.md §3
 */
interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const token = client.handshake.auth?.token as string | undefined;

      if (!token) throw new WsException('No token provided');

      const payload = this.jwtService.verify<JwtPayload>(token);
      // socket 인스턴스에 인증 정보 주입 — 핸들러에서 client.data.user.id로 접근
      client.data.user = { id: payload.sub, email: payload.email };

      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      throw new WsException('Unauthorized');
    }
  }
}
