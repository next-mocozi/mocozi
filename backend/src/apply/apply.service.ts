import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyDto } from './dto/apply.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ApplyService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

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
    const application = await this.prisma.application.create({
      data: { teamId, userId, message: dto.message },
    });

    // §B-DM-9 — 지원 접수 시 팀장에게 알림. fire-and-forget (지원 자체 응답에 latency X).
    void this.notifyApplicationReceived(
      teamId,
      team.leaderId,
      team.name,
      userId,
    ).catch(
      // eslint-disable-next-line no-console
      (e) => console.error('[notification] APPLICATION_RECEIVED trigger failed', e),
    );

    return application;
  }

  /**
   * §B-DM-9 — 팀장에게 APPLICATION_RECEIVED 알림 생성.
   * linkTo는 /team/:id/applications (팀 지원자 목록 페이지).
   */
  private async notifyApplicationReceived(
    teamId: string,
    leaderId: string,
    teamName: string,
    applicantId: string,
  ): Promise<void> {
    const applicant = await this.prisma.user.findUnique({
      where: { id: applicantId },
      select: { lastName: true, firstName: true },
    });
    const applicantName = applicant ? applicant.lastName + applicant.firstName : '누군가';
    await this.notifications.create({
      userId: leaderId,
      type: 'APPLICATION_RECEIVED',
      title: `${applicantName}님이 ${teamName} 팀에 지원했습니다`,
      linkTo: `/team/${teamId}/applications`,
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
        user: { select: { id: true, lastName: true, firstName: true, university: true, department: true, skills: true } },
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
