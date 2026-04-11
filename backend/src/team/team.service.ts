import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';

/** 팀 서비스 - 팀 생성, 기획서 관리 */
@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  /** 팀 생성 */
  async createTeam(leaderId: string, dto: CreateTeamDto) {
    return this.prisma.team.create({
      data: {
        name: dto.name,
        leaderId,
        members: {
          create: {
            userId: leaderId,
            role: 'LEADER',
          },
        },
      },
      include: { members: true },
    });
  }

  /** 팀 기획서 작성 */
  async createProposal(teamId: string, dto: CreateProposalDto) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }

    return this.prisma.teamProposal.create({
      data: {
        teamId,
        ...dto,
        techStack: dto.techStack || [],
        referenceLinks: dto.referenceLinks || [],
      },
    });
  }

  /** 팀 목록 조회 */
  async getTeams() {
    return this.prisma.team.findMany({
      include: {
        leader: { select: { id: true, name: true, university: true } },
        members: true,
        proposal: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 팀 상세 조회 */
  async getTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        leader: { select: { id: true, name: true, university: true, profileImage: true } },
        members: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
        proposal: true,
        recruits: true,
      },
    });

    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }

    return team;
  }
}
