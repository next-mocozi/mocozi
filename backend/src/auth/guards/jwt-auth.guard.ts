import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT 인증 가드 - 보호된 라우트에 적용 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
