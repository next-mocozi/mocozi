import { Injectable, Logger } from '@nestjs/common';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';

const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // RESEND_API_KEY 미설정이어도 backend 부팅은 가능해야 함 — Resend SDK는
  // 빈 키에서 생성자 단계로 throw 하므로, 키가 있을 때만 인스턴스화.
  // 실제 메일 발송 시점에 null 체크 후 graceful skip (StorageService와 동일 패턴).
  private resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    if (!this.resend) {
      this.logger.warn(
        '[AuthService] RESEND_API_KEY 미설정 — 인증 메일 발송 비활성.',
      );
    }
  }

  private async sendVerificationEmail(to: string, name: string, token: string) {
    if (!this.resend) {
      this.logger.warn(
        `[AuthService] Resend 미설정 — ${to} 에게 인증 메일 발송 스킵.`,
      );
      return;
    }
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    await this.resend.emails
      .send({
        from: process.env.RESEND_FROM_EMAIL ?? 'mocozi <onboarding@resend.dev>',
        to,
        subject: '[모코지] 이메일 인증을 완료해주세요',
        html: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>[모코지] 이메일 인증</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR','Apple SD Gothic Neo',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

          <tr>
            <td align="center" style="padding-bottom:20px;">
              <span style="font-size:24px;font-weight:700;color:#4f46e5;letter-spacing:-0.5px;">모코지</span>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;border-radius:20px;border:1px solid #f0f0ef;box-shadow:0 2px 12px -2px rgba(0,0,0,0.07);padding:40px;">

              <div style="text-align:center;margin-bottom:16px;font-size:44px;">✉️</div>

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;text-align:center;">이메일 인증</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;text-align:center;line-height:1.7;">
                안녕하세요, <strong style="color:#111827;">${name}</strong>님!<br>
                아래 버튼을 눌러 이메일 인증을 완료해주세요.
              </p>

              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 28px;">

              <div style="text-align:center;margin-bottom:24px;">
                <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
                  이메일 인증하기
                </a>
              </div>

              <div style="background:#eef2ff;border-radius:10px;padding:12px 16px;margin-bottom:28px;text-align:center;">
                <p style="margin:0;font-size:13px;color:#4338ca;">
                  ⏰ 이 링크는 <strong>24시간</strong> 동안만 유효합니다
                </p>
              </div>

              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                버튼이 작동하지 않으면 아래 링크를 브라우저에 복사해주세요.
              </p>
              <p style="margin:0;font-size:11px;text-align:center;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#6366f1;text-decoration:none;">${verifyUrl}</a>
              </p>

            </td>
          </tr>

          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
                본 메일은 모코지 서비스에서 자동 발송되었습니다.<br>
                회원가입을 요청하지 않으셨다면 이 메일을 무시해주세요.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      })
      .catch((err: unknown) => {
        console.error('인증 메일 발송 실패:', err);
      });
  }

  async register(registerDto: RegisterDto) {
    const { email, password, name, university, department, grade } = registerDto;

    if (!email.endsWith('.ac.kr')) {
      throw new BadRequestException('학교 이메일을 사용해주세요.');
    }
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        university,
        department,
        grade,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    await this.sendVerificationEmail(email, name, verificationToken);

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
    // production만 이메일 인증 강제. dev에선 Resend 미설정·메일 미수신 상황이 있으므로 우회.
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
        bannerColor: user.bannerColor,
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
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new BadRequestException('인증 링크가 만료되었습니다. 재발송을 요청해주세요.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });
    return { message: '이메일 인증이 완료되었습니다.' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // 사용자 존재 여부를 외부에 노출하지 않기 위해 이미 인증됐거나 없는 경우도 동일 응답 반환
    if (!user || user.emailVerified) {
      return { message: '인증 메일을 발송했습니다. 메일함을 확인해주세요.' };
    }

    const verificationToken = uuidv4();
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_EXPIRY_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry },
    });

    await this.sendVerificationEmail(email, user.name, verificationToken);

    return { message: '인증 메일을 발송했습니다. 메일함을 확인해주세요.' };
  }
}
