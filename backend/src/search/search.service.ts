import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SearchFilters {
  keyword?: string;
  skill?: string;
  role?: string;
  university?: string;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchTeams(filters: SearchFilters) {
    const where: any = {};

    if (filters.keyword) {
      where.OR = [
        { name: { contains: filters.keyword, mode: 'insensitive' } },
        { proposal: { overview: { contains: filters.keyword, mode: 'insensitive' } } },
      ];
    }

    if (filters.skill) {
      where.proposal = { requiredSkills: { has: filters.skill } };
    }

    if (filters.role) {
      where.proposal = { recruitingRoles: { has: filters.role } };
    }

    if (filters.university) {
      where.leader = { university: { contains: filters.university, mode: 'insensitive' } };
    }

    return this.prisma.team.findMany({
      where,
      include: {
        leader: { select: { id: true, name: true, university: true } },
        proposal: { select: { projectName: true, overview: true, recruitingRoles: true, requiredSkills: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchUsers(filters: { keyword?: string; skills?: string[]; role?: string; university?: string }) {
    const where: any = {};

    if (filters.keyword) {
      where.OR = [
        { name: { contains: filters.keyword, mode: 'insensitive' } },
        { bio: { contains: filters.keyword, mode: 'insensitive' } },
        { department: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    if (filters.skills?.length) {
      where.skills = { hasSome: filters.skills };
    }

    if (filters.role) {
      where.roles = { has: filters.role };
    }

    if (filters.university) {
      where.university = { contains: filters.university, mode: 'insensitive' };
    }

    where.emailVerified = true;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        university: true,
        department: true,
        skills: true,
        roles: true,
        profileImage: true,
        bio: true,
        // 구인 카드 헤더 그라데이션 색상 — frontend 가 사용자별로 적용
        bannerColor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
