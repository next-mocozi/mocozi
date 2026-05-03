import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
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

  @Get(':id')
  async getTeam(@Param('id') teamId: string) {
    return this.teamService.getTeam(teamId);
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
}
