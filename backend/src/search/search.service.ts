import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 검색 필터 인터페이스 */
interface SearchFilters {
  keyword?: string;
  skill?: string;
  role?: string;
  university?: string;
}

/** 검색 서비스 - 구인 게시글 통합 검색 */
@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  /** 구인 게시글 검색 (스킬/직군/학교 필터) */
  async searchRecruits(filters: SearchFilters) {
    const where: any = {
      status: 'OPEN',
    };

    // 키워드 검색 (제목, 설명)
    if (filters.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: 'insensitive' } },
        { description: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }

    // 기술 스택 필터
    if (filters.skill) {
      where.skills = { has: filters.skill };
    }

    // 직군 필터
    if (filters.role) {
      where.roles = { has: filters.role };
    }

    // 대학교 필터 (팀 리더 기준)
    const includeTeam: any = {
      include: {
        leader: { select: { id: true, name: true, university: true } },
      },
    };

    if (filters.university) {
      includeTeam.where = {
        leader: { university: { contains: filters.university, mode: 'insensitive' } },
      };
    }

    return this.prisma.recruitPost.findMany({
      where,
      include: { team: includeTeam },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 사용자 검색 (프로필 기반) */
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
