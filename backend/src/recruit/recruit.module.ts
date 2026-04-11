import { Module } from '@nestjs/common';
import { RecruitController } from './recruit.controller';
import { RecruitService } from './recruit.service';

/** 구인 모듈 */
@Module({
  controllers: [RecruitController],
  providers: [RecruitService],
})
export class RecruitModule {}
