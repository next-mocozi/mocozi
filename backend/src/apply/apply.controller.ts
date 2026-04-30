import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApplyService } from './apply.service';
import { ApplyDto } from './dto/apply.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('apply')
@UseGuards(JwtAuthGuard)
export class ApplyController {
  constructor(private readonly applyService: ApplyService) {}

  @Post(':teamId')
  apply(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApplyDto,
  ) {
    return this.applyService.apply(teamId, user.id, dto);
  }

  @Get(':teamId/applications')
  getApplications(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.applyService.getApplications(teamId, user.id);
  }

  @Patch('applications/:applicationId/:status')
  updateStatus(
    @Param('applicationId') applicationId: string,
    @Param('status') status: 'ACCEPTED' | 'REJECTED',
    @CurrentUser() user: { id: string },
  ) {
    return this.applyService.updateApplicationStatus(applicationId, user.id, status);
  }
}
