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

    return { message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.', userId: user.id, };
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
    
    const payload = {sub: user.id, email: user.email};
    const token = this.jwtService.sign(payload);
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      message: '로그인에 성공하였습니다.'
  };
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
