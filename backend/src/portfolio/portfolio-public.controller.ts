import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

/** JWT 인증 없는 공개 포트폴리오 엔드포인트.
 *  비로그인 외부인이 /p/[slug] 페이지에서 호출하는 용도. */
@Controller('portfolios/public')
export class PortfolioPublicController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const portfolio = await this.portfolioService.getPublicBySlug(slug);
    if (!portfolio) {
      throw new NotFoundException('포트폴리오를 찾을 수 없거나 비공개 상태입니다.');
    }
    return { data: portfolio };
  }
}
