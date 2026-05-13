import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** 사용자 서비스 - 프로필 조회 및 수정 */
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /** 전체 가입자 수 — 랜딩 페이지 CTA "전체 N명" 표시용. 공개 endpoint. */
  async getUserCount(): Promise<number> {
    return this.prisma.user.count();
  }

  /** 사용자 프로필 조회 */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        lastName: true,
        firstName: true,
        university: true,
        department: true,
        grade: true,
        role: true,
        profileImage: true,
        bio: true,
        skills: true,
        roles: true,
        careerSummary: true,
        bannerColor: true,
        createdAt: true,
        portfolio: { include: { items: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return user;
  }

  /** 프로필 수정 */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        lastName: true,
        firstName: true,
        university: true,
        department: true,
        profileImage: true,
        bio: true,
        skills: true,
        roles: true,
        careerSummary: true,
        bannerColor: true,
      },
    });
  }
}
