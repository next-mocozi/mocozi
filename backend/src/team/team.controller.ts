import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApplicationContactType } from '@prisma/client';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  async createTeam(@CurrentUser() user: { id: string }, @Body() createTeamDto: CreateTeamDto) {
    return this.teamService.createTeam(user.id, createTeamDto);
  }

  @Get()
  async getTeams() {
    return this.teamService.getTeams();
  }

  @Get('my')
  async getMyTeams(@CurrentUser() user: { id: string }) {
    return this.teamService.getMyTeams(user.id);
  }

  @Get(':id')
  async getTeam(
    @Param('id') teamId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.teamService.getTeam(teamId, user.id);
  }

  @Post(':id/proposal')
  async createProposal(
    @Param('id') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() createProposalDto: CreateProposalDto,
  ) {
    return this.teamService.createProposal(teamId, user.id, createProposalDto);
  }

  @Patch(':id/proposal')
  async updateProposal(
    @Param('id') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() updateProposalDto: UpdateProposalDto,
  ) {
    return this.teamService.updateProposal(teamId, user.id, updateProposalDto);
  }

  @Patch(':id/proposal/visibility')
  async updateVisibility(
    @Param('id') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() updateVisibilityDto: UpdateVisibilityDto,
  ) {
    return this.teamService.updateVisibility(teamId, user.id, updateVisibilityDto);
  }

  @Patch(':id')
  async updateTeam(
    @Param('id') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamService.updateTeam(teamId, user.id, updateTeamDto);
  }

  @Delete(':id')
  async deleteTeam(@Param('id') teamId: string, @CurrentUser() user: any) {
    return this.teamService.deleteTeam(teamId, user.id);
  }

  @Get(':id/members')
  async getMembers(@Param('id') teamId: string) {
    return this.teamService.getMembers(teamId);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') teamId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.teamService.removeMember(teamId, user.id, targetUserId);
  }

  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Param('id') teamId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { id: string },
    @Body('role') role: string,
  ) {
    return this.teamService.updateMemberRole(teamId, user.id, targetUserId, role);
  }

  // -------------------------------------------------------
  // 지원 라우팅 (양식 시스템 — Phase A)
  // -------------------------------------------------------

  /** 지원 시 누구에게 연락 갈지 + 모집 직군 — 채팅 양식 시스템 사용처 */
  @Get(':id/contact')
  async getApplicationContact(@Param('id') teamId: string) {
    return this.teamService.resolveApplicationContact(teamId);
  }

  /** 지원 contact 갱신 — 팀장만 */
  @Patch(':id/contact')
  async updateApplicationContact(
    @Param('id') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { type: ApplicationContactType; contactUserId?: string | null },
  ) {
    return this.teamService.updateApplicationContact(
      teamId,
      user.id,
      body.type,
      body.contactUserId ?? null,
    );
  }
}
