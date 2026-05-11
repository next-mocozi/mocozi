import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { UpdatePortfolioMetaDto } from './dto/update-portfolio-meta.dto';
import {
  CreateWorkExperienceDto,
  UpdateWorkExperienceDto,
} from './dto/work-experience.dto';
import {
  CreateExternalActivityDto,
  UpdateExternalActivityDto,
} from './dto/external-activity.dto';
import {
  CreatePortfolioLinkDto,
  UpdatePortfolioLinkDto,
} from './dto/portfolio-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('portfolios')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  /** GET /portfolios/me */
  @Get('me')
  getMyPortfolio(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getMyPortfolio(user.id);
  }

  /** GET /portfolios/feed — 메인 피드 (공개 포트폴리오 전체, 본인 제외) */
  @Get('feed')
  getFeed(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getFeed(user.id);
  }

  /** GET /portfolios/users/:userId — 타인 포트폴리오 조회.
   *  본인이 보면 비공개 무관 전체, 타인이 보면 isPublic=true 일 때만 본문 노출. */
  @Get('users/:userId')
  getByUserId(
    @CurrentUser() user: { id: string },
    @Param('userId') userId: string,
  ) {
    return this.portfolioService.getPortfolioByUserId(user.id, userId);
  }

  /** PATCH /portfolios/me - 내 포트폴리오 메타(isPublic, firstPostAt) 부분 수정 */
  @Patch('me')
  updateMyMeta(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePortfolioMetaDto,
  ) {
    return this.portfolioService.updateMyMeta(user.id, dto);
  }

  /** POST /portfolios/items */
  @Post('items')
  createItem(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.createItem(user.id, dto);
  }

  /** PUT /portfolios/items/:id */
  @Put('items/:id')
  updateItem(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfolioService.updateItem(user.id, id, dto);
  }

  /** DELETE /portfolios/items/:id */
  @Delete('items/:id')
  deleteItem(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.portfolioService.deleteItem(user.id, id);
  }

  // =====================================================
  // Phase 3 — 부속 메타 (실무경험 / 대외활동 / 외부 링크)
  // =====================================================

  /** POST /portfolios/work */
  @Post('work')
  createWork(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWorkExperienceDto,
  ) {
    return this.portfolioService.createWorkExperience(user.id, dto);
  }

  /** PUT /portfolios/work/:id */
  @Put('work/:id')
  updateWork(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateWorkExperienceDto,
  ) {
    return this.portfolioService.updateWorkExperience(user.id, id, dto);
  }

  /** DELETE /portfolios/work/:id */
  @Delete('work/:id')
  deleteWork(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.portfolioService.deleteWorkExperience(user.id, id);
  }

  /** POST /portfolios/activities */
  @Post('activities')
  createActivity(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateExternalActivityDto,
  ) {
    return this.portfolioService.createActivity(user.id, dto);
  }

  /** PUT /portfolios/activities/:id */
  @Put('activities/:id')
  updateActivity(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateExternalActivityDto,
  ) {
    return this.portfolioService.updateActivity(user.id, id, dto);
  }

  /** DELETE /portfolios/activities/:id */
  @Delete('activities/:id')
  deleteActivity(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.portfolioService.deleteActivity(user.id, id);
  }

  /** POST /portfolios/links */
  @Post('links')
  createLink(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePortfolioLinkDto,
  ) {
    return this.portfolioService.createLink(user.id, dto);
  }

  /** PUT /portfolios/links/:id */
  @Put('links/:id')
  updateLink(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioLinkDto,
  ) {
    return this.portfolioService.updateLink(user.id, id, dto);
  }

  /** DELETE /portfolios/links/:id */
  @Delete('links/:id')
  deleteLink(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.portfolioService.deleteLink(user.id, id);
  }
}
