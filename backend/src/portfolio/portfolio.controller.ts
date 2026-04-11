import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** 포트폴리오 컨트롤러 - 포트폴리오 CRUD API */
@Controller('portfolios')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  /** GET /portfolios/me - 내 포트폴리오 조회 */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyPortfolio(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getMyPortfolio(user.id);
  }

  /** POST /portfolios/items - 포트폴리오 아이템 추가 */
  @UseGuards(JwtAuthGuard)
  @Post('items')
  createItem(
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfolioService.createItem(user.id, dto);
  }

  /** PUT /portfolios/items/:id - 포트폴리오 아이템 수정 */
  @UseGuards(JwtAuthGuard)
  @Put('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdatePortfolioDto) {
    return this.portfolioService.updateItem(id, dto);
  }

  /** DELETE /portfolios/items/:id - 포트폴리오 아이템 삭제 */
  @UseGuards(JwtAuthGuard)
  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.portfolioService.deleteItem(id);
  }
}
