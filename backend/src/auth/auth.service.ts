import { Injectable } from '@nestjs/common';
import { BadRequestException, ConflictException, UnauthorizedException} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, university, department, grade } = registerDto;

    if (!email.endsWith('.ac.kr')){
      throw new BadRequestException('학교 이메일을 사용해주세요.');
    }
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser){
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        university,
        department,
        grade,
        verificationToken,
      },
    });

    // Resend 의존성을 lockfile에서 제거한 상태(5030bfc 부분 revert)이므로 실제 메일 발송은 생략.
    // 프론트는 응답의 verificationToken으로 /verify-email?token=... 호출해 dev 환경에서 직접 인증.
    return {
      message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.',
      userId: user.id,
      verificationToken: user.verificationToken,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    // production만 이메일 인증 강제. dev/local에선 Resend 미설정·메일 미수신 상황이라
    // 인증 단계를 막으면 진입 자체가 불가 — 따라서 우회. verify-email API 자체는 유지.
    if (!user.emailVerified && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('이메일 인증이 필요합니다.');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        university: user.university,
        department: user.department,
        grade: user.grade,
        bio: user.bio,
        skills: user.skills,
        roles: user.roles,
        careerSummary: user.careerSummary,
      },
      message: '로그인에 성공하였습니다.',
    };
  }

  async refresh(refreshToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
    });
    if (!user) {
      throw new UnauthorizedException('유효하지 않은 리프레시 토큰입니다.');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: '로그아웃되었습니다.' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) {
      throw new BadRequestException('유효하지 않은 토큰입니다.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });
    return { message: '이메일 인증이 완료되었습니다.' };
  }
}
