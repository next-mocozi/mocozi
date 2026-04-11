import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** 팀 컨트롤러 - 팀 생성/조회, 기획서 관리 API */
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /** POST /teams - 팀 생성 */
  @UseGuards(JwtAuthGuard)
  @Post()
  createTeam(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.createTeam(user.id, dto);
  }

  /** POST /teams/:id/proposal - 기획서 작성 */
  @UseGuards(JwtAuthGuard)
  @Post(':id/proposal')
  createProposal(@Param('id') id: string, @Body() dto: CreateProposalDto) {
    return this.teamService.createProposal(id, dto);
  }

  /** GET /teams - 팀 목록 조회 */
  @Get()
  getTeams() {
    return this.teamService.getTeams();
  }

  /** GET /teams/:id - 팀 상세 조회 */
  @Get(':id')
  getTeam(@Param('id') id: string) {
    return this.teamService.getTeam(id);
  }
}
