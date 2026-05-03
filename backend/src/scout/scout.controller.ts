import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ScoutService } from './scout.service';
import { ScoutDto } from './dto/scout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('scout')
@UseGuards(JwtAuthGuard)
export class ScoutController {
  constructor(private readonly scoutService: ScoutService) {}

  @Post(':targetUserId')
  scout(
    @Param('targetUserId') targetUserId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ScoutDto,
  ) {
    return this.scoutService.scout(user.id, targetUserId, dto);
  }

  @Get('received')
  getReceivedScouts(@CurrentUser() user: { id: string }) {
    return this.scoutService.getReceivedScouts(user.id);
  }

  @Get('sent/:teamId')
  getSentScouts(
    @Param('teamId') teamId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.scoutService.getSentScouts(teamId, user.id);
  }

  @Patch(':scoutId/:status')
  updateStatus(
    @Param('scoutId') scoutId: string,
    @Param('status') status: 'ACCEPTED' | 'REJECTED',
    @CurrentUser() user: { id: string },
  ) {
    return this.scoutService.updateScoutStatus(scoutId, user.id, status);
  }
}
