import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { v4 as uuidv4 } from 'uuid';

/** 인증 서비스 - 회원가입, 로그인, 메일 인증 처리 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /** 회원가입 - 대학 메일(.ac.kr) 검증 포함 */
  async register(dto: RegisterDto) {
    // 대학 메일 검증
    if (!dto.email.endsWith('.ac.kr')) {
      throw new BadRequestException('대학교 메일(.ac.kr)만 사용 가능합니다.');
    }

    // 이메일 중복 확인
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const verificationToken = uuidv4();

    // 사용자 생성
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        university: dto.university,
        department: dto.department,
        verificationToken,
      },
    });

    // TODO: 인증 메일 발송 로직 구현
    // await this.sendVerificationEmail(user.email, verificationToken);

    return {
      message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.',
      userId: user.id,
    };
  }

  /** 로그인 - JWT 토큰 발급 */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('이메일 인증이 필요합니다.');
    }

    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        university: user.university,
      },
    };
  }

  /** 이메일 인증 처리 */
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('유효하지 않은 인증 토큰입니다.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    return { message: '이메일 인증이 완료되었습니다.' };
  }
}
