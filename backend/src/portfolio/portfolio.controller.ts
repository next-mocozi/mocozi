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
  createItem(@CurrentUser() user: { id: string }, @Body() dto: CreatePortfolioDto) {
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
}
