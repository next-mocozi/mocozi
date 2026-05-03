import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoutDto } from './dto/scout.dto';

@Injectable()
export class ScoutService {
  constructor(private prisma: PrismaService) {}

  async scout(leaderId: string, targetUserId: string, dto: ScoutDto) {
    const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 스카우트 제안을 보낼 수 있습니다.');
    }
    if (targetUserId === leaderId) {
      throw new BadRequestException('자기 자신에게 스카우트 제안을 보낼 수 없습니다.');
    }
    const existing = await this.prisma.scout.findUnique({
      where: { teamId_targetUserId: { teamId: dto.teamId, targetUserId } },
    });
    if (existing) {
      throw new ConflictException('이미 스카우트 제안을 보낸 유저입니다.');
    }
    return this.prisma.scout.create({
      data: {
        teamId: dto.teamId,
        targetUserId,
        leaderId,
        message: dto.message,
      },
    });
  }

  async getReceivedScouts(userId: string) {
    return this.prisma.scout.findMany({
      where: { targetUserId: userId },
      include: {
        team: { select: { id: true, name: true, teamType: true } },
        leader: { select: { id: true, name: true, university: true, department: true } },
      },
    });
  }

  async getSentScouts(teamId: string, leaderId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 보낸 스카우트 목록을 볼 수 있습니다.');
    }
    return this.prisma.scout.findMany({
      where: { teamId },
      include: {
        targetUser: { select: { id: true, name: true, university: true, department: true, skills: true } },
      },
    });
  }

  async updateScoutStatus(scoutId: string, userId: string, status: 'ACCEPTED' | 'REJECTED') {
    const scout = await this.prisma.scout.findUnique({ where: { id: scoutId } });
    if (!scout) {
      throw new NotFoundException('스카우트 제안을 찾을 수 없습니다.');
    }
    if (scout.targetUserId !== userId) {
      throw new BadRequestException('본인에게 온 스카우트 제안만 처리할 수 있습니다.');
    }
    if (scout.status !== 'PENDING') {
      throw new BadRequestException('이미 처리된 스카우트 제안입니다.');
    }
    return this.prisma.scout.update({
      where: { id: scoutId },
      data: { status },
    });
  }
}
