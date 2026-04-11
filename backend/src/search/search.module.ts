import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/** 검색 모듈 */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
