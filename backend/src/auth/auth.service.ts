import { Injectable } from '@nestjs/common';
import { BadRequestException, ConflictException, UnauthorizedException} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private resend = new Resend(process.env.RESEND_API_KEY);

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

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await this.resend.emails.send({
      from: 'mocozi <onboarding@resend.dev>',
      to: email,
      subject: '[모코지] 이메일 인증을 완료해주세요',
      html: `
        <p>안녕하세요 ${name}님,</p>
        <p>아래 버튼을 클릭하여 이메일 인증을 완료해주세요.</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          이메일 인증하기
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:16px;">링크가 작동하지 않으면 아래 URL을 복사해서 브라우저에 붙여넣기 해주세요.<br/>${verifyUrl}</p>
      `,
    }).catch((err) => {
      console.error('인증 메일 발송 실패:', err);
    });

    return {
      message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.',
      userId: user.id,
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
    if (!user.emailVerified) {
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
