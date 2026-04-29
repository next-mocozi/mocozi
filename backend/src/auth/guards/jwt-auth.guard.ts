import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

// TODO: JWT 검증 구현 전까지 임시로 모든 요청 허용
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
