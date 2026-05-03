import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class ProposalController {
  constructor(private readonly teamService: TeamService) {}

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
}
