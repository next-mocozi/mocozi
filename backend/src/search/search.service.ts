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

  async searchUsers(filters: { skill?: string; university?: string }) {
    const where: any = {};

    if (filters.skill) {
      where.skills = { has: filters.skill };
    }

    if (filters.university) {
      where.university = { contains: filters.university, mode: 'insensitive' };
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        university: true,
        department: true,
        skills: true,
        profileImage: true,
        bio: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
