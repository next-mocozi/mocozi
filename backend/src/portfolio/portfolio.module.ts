import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioPublicController } from './portfolio-public.controller';
import { PortfolioService } from './portfolio.service';

/** 포트폴리오 모듈 */
@Module({
  controllers: [PortfolioController, PortfolioPublicController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
