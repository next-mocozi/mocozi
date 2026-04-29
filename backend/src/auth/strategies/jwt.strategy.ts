import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
        });
    }

    async validate(payload: { sub: string; email: string }) {
        // payload = 토큰 안에 담긴 { sub: user.id, email }
        // 여기서 DB 조회해서 실제 사용자 반환
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
            throw new UnauthorizedException('유효하지 않은 토큰입니다.');
        }
        return user; // request.user에 담김
    }
}