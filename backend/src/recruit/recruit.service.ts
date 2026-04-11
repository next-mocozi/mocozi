import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecruitDto } from './dto/create-recruit.dto';
import { ApplyRecruitDto } from './dto/apply-recruit.dto';

/** 구인 서비스 - 구인 게시글 CRUD + 지원 관리 */
@Injectable()
export class RecruitService {
  constructor(private prisma: PrismaService) {}

  /** 구인 게시글 생성 */
  async create(dto: CreateRecruitDto) {
    return this.prisma.recruitPost.create({
      data: {
        ...dto,
        deadline: new Date(dto.deadline),
      },
    });
  }

  /** 구인 게시글 목록 조회 */
  async findAll(filters?: { skill?: string; role?: string; status?: string }) {
    const where: any = {};

    if (filters?.skill) {
      where.skills = { has: filters.skill };
    }
    if (filters?.role) {
      where.roles = { has: filters.role };
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.recruitPost.findMany({
      where,
      include: {
        team: {
          include: {
            leader: { select: { id: true, name: true, university: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 구인 게시글 상세 조회 */
  async findOne(id: string) {
    const post = await this.prisma.recruitPost.findUnique({
      where: { id },
      include: {
        team: {
          include: {
            leader: { select: { id: true, name: true, university: true, profileImage: true } },
            proposal: true,
          },
        },
        applications: {
          include: {
            user: { select: { id: true, name: true, university: true } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('구인 게시글을 찾을 수 없습니다.');
    }

    return post;
  }

  /** 구인 지원 */
  async apply(recruitId: string, userId: string, dto: ApplyRecruitDto) {
    // 중복 지원 확인
    const existing = await this.prisma.application.findUnique({
      where: { recruitId_userId: { recruitId, userId } },
    });

    if (existing) {
      throw new ConflictException('이미 지원한 게시글입니다.');
    }

    return this.prisma.application.create({
      data: {
        recruitId,
        userId,
        message: dto.message,
      },
    });
  }
}
