import { Injectable } from '@nestjs/common';
import { ApplicationContactType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  async createTeam(userId: string, createTeamDto: CreateTeamDto) {
    const { name, teamType } = createTeamDto;
    const existingTeam = await this.prisma.team.findUnique({ where: { name } });
    if (existingTeam) {
      throw new BadRequestException('이미 존재하는 팀 이름입니다.');
    }
    const team = await this.prisma.team.create({
      data: {
        name,
        teamType,
        leaderId: userId,
      }
    });

    await this.prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        role: 'LEADER',
      }
    });

    return team;
  }
  async createProposal(teamId: string, userId: string, createProposalDto: CreateProposalDto) {
    const { projectName, overview, schedule, recruitingRoles, requiredSkills, referenceLinks, detailedPlan, expectedOutcome } = createProposalDto;
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== userId) {
      throw new BadRequestException('팀장만 제안서를 작성할 수 있습니다.');
    }
    const proposal = await this.prisma.teamProposal.create({
      data: {
        teamId,
        projectName,
        overview,
        schedule,
        recruitingRoles,
        requiredSkills,
        referenceLinks: referenceLinks ?? [],
        detailedPlan,
        expectedOutcome,
        publicFields: [],
      }
    });

    return proposal;
  }

  async getMyTeams(userId: string) {
    return this.prisma.team.findMany({
      where: { leaderId: userId },
      select: { id: true, name: true, teamType: true },
    });
  }

  async getTeams() {
    return this.prisma.team.findMany({
      include: {
        leader: { select: { id: true, lastName: true, firstName: true } },
        proposal: {
          select: {
            projectName: true,
            overview: true,
            recruitingRoles: true,
            requiredSkills: true,
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTeam(teamId: string, requesterId?: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        leader: {
          select: {
            lastName: true,
            firstName: true,
          }
        },
        proposal: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                lastName: true,
                firstName: true,
              }
            }
          }
        }
      }
    });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }

    if (team.proposal) {
      // 팀장은 공개 여부 관계없이 전체 데이터 반환
      if (requesterId && team.leaderId === requesterId) {
        return team;
      }

      const { publicFields, detailedPlan, expectedOutcome, referenceLinks, ...rest } = team.proposal;
      const filteredProposal = {
        ...rest,
        publicFields,
        detailedPlan: publicFields.includes('detailedPlan') ? detailedPlan : undefined,
        expectedOutcome: publicFields.includes('expectedOutcome') ? expectedOutcome : undefined,
        referenceLinks: publicFields.includes('referenceLinks') ? referenceLinks : undefined,
      };
      return { ...team, proposal: filteredProposal };
    }

    return team;
  }

  async updateTeam(teamId: string, userId: string, updateTeamDto: UpdateTeamDto) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== userId) {
      throw new BadRequestException('팀장만 팀 정보를 수정할 수 있습니다.');
    }
    return this.prisma.team.update({
      where: { id: teamId },
      data: updateTeamDto,
    });
  }

  async updateProposal(teamId: string, userId: string, updateProposalDto: UpdateProposalDto) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== userId) {
      throw new BadRequestException('팀장만 기획서를 수정할 수 있습니다.');
    }
    const proposal = await this.prisma.teamProposal.findUnique({ where: { teamId } });
    if (!proposal) {
      throw new NotFoundException('기획서가 존재하지 않습니다.');
    }
    return this.prisma.teamProposal.update({
      where: { teamId },
      data: updateProposalDto,
    });
  }

  async updateVisibility(teamId: string, userId: string, updateVisibilityDto: UpdateVisibilityDto) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== userId) {
      throw new BadRequestException('팀장만 공개 범위를 설정할 수 있습니다.');
    }
    const proposal = await this.prisma.teamProposal.findUnique({ where: { teamId } });
    if (!proposal) {
      throw new NotFoundException('기획서가 존재하지 않습니다.');
    }
    return this.prisma.teamProposal.update({
      where: { teamId },
      data: { publicFields: updateVisibilityDto.publicFields },
    });
  }

  async getMembers(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, lastName: true, firstName: true, university: true, department: true },
        },
      },
    });
  }

  async removeMember(teamId: string, leaderId: string, targetUserId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 팀원을 추방할 수 있습니다.');
    }
    if (targetUserId === leaderId) {
      throw new BadRequestException('팀장은 추방할 수 없습니다.');
    }
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    return { message: '팀원이 추방되었습니다.' };
  }

  async updateMemberRole(teamId: string, leaderId: string, targetUserId: string, role: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 역할을 수정할 수 있습니다.');
    }
    return this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      data: { role },
    });
  }

  // -------------------------------------------------------
  // 지원 라우팅 (Phase A — 채팅 양식 시스템과 통합)
  // -------------------------------------------------------

  /**
   * 팀 지원 시 누구에게 연락 가야 하는지 결정.
   *
   * - LEADER (default): 팀장 1명 → DIRECT 방
   * - MEMBER: 지정된 팀원 1명 → DIRECT (null이면 LEADER fallback)
   * - TEAM_CHAT: 팀원 전체 → GROUP 방
   *
   * 모집 직군(recruitingRoles)도 함께 반환 — 양식 직군 선택 단계에서 사용.
   */
  async resolveApplicationContact(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: { select: { userId: true } },
        proposal: { select: { recruitingRoles: true } },
      },
    });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');

    const teamName = team.name;
    const recruitingRoles = team.proposal?.recruitingRoles ?? [];

    if (
      team.applicationContactType === ApplicationContactType.MEMBER &&
      team.applicationContactUserId
    ) {
      return {
        type: 'DIRECT' as const,
        recipientUserIds: [team.applicationContactUserId],
        teamName,
        recruitingRoles,
      };
    }

    if (team.applicationContactType === ApplicationContactType.TEAM_CHAT) {
      return {
        type: 'GROUP' as const,
        recipientUserIds: team.members.map((m) => m.userId),
        suggestedRoomName: `${teamName} 지원 문의`,
        teamName,
        recruitingRoles,
      };
    }

    // LEADER (default + MEMBER fallback)
    return {
      type: 'DIRECT' as const,
      recipientUserIds: [team.leaderId],
      teamName,
      recruitingRoles,
    };
  }

  /**
   * 팀 contact 설정 갱신 — 팀장만 가능.
   * MEMBER 선택 시 contactUserId가 실제 활성 팀원이어야.
   */
  async updateApplicationContact(
    teamId: string,
    leaderId: string,
    type: ApplicationContactType,
    contactUserId: string | null,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { select: { userId: true } } },
    });
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.');
    if (team.leaderId !== leaderId) {
      throw new BadRequestException('팀장만 지원 라우팅을 변경할 수 있습니다.');
    }

    if (type === ApplicationContactType.MEMBER) {
      if (!contactUserId) {
        throw new BadRequestException(
          'MEMBER 선택 시 contactUserId 필수입니다.',
        );
      }
      const isMember = team.members.some((m) => m.userId === contactUserId);
      if (!isMember) {
        throw new BadRequestException(
          'contactUserId는 활성 팀원이어야 합니다.',
        );
      }
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        applicationContactType: type,
        applicationContactUserId:
          type === ApplicationContactType.MEMBER ? contactUserId : null,
      },
      select: {
        id: true,
        applicationContactType: true,
        applicationContactUserId: true,
      },
    });
  }

  async deleteTeam(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }
    if (team.leaderId !== userId) {
      throw new BadRequestException('팀장만 팀을 해산할 수 있습니다.');
    }
    await this.prisma.teamMember.deleteMany({ where: { teamId } });
    await this.prisma.teamProposal.deleteMany({ where: { teamId } });
    await this.prisma.application.deleteMany({ where: { teamId } });
    await this.prisma.team.delete({ where: { id: teamId } });
    return { message: '팀이 해산되었습니다.' };
  }
}