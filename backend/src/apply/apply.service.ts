import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyDto } from './dto/apply.dto';

@Injectable()
export class ApplyService {
  constructor(private prisma: PrismaService) {}

  async apply(teamId: string, userId: string, dto: ApplyDto) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId === userId) {
      throw new BadRequestException('자신의 팀에는 지원할 수 없습니다.');
    }
    const existing = await this.prisma.application.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) {
      throw new ConflictException('이미 지원한 팀입니다.');
    }
    return this.prisma.application.create({
      data: { teamId, userId, message: dto.message },
    });
  }

  async getApplications(teamId: string, leaderId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 지원자 목록을 볼 수 있습니다.');
    }
    return this.prisma.application.findMany({
      where: { teamId },
      include: {
        user: { select: { id: true, name: true, university: true, department: true, skills: true } },
      },
    });
  }

  async updateApplicationStatus(applicationId: string, leaderId: string, status: 'ACCEPTED' | 'REJECTED') {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException('지원서를 찾을 수 없습니다.');
    }
    const team = await this.prisma.team.findUnique({ where: { id: application.teamId } });
    if (!team || team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 지원을 처리할 수 있습니다.');
    }

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status },
    });

    if (status === 'ACCEPTED') {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: application.teamId, userId: application.userId } },
        create: { teamId: application.teamId, userId: application.userId, role: 'MEMBER' },
        update: {},
      });
    }

    return updated;
  }
}
