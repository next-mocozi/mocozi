import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

/** 검색 컨트롤러 - 통합 검색 API */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** GET /search/recruits - 구인 게시글 검색 */
  @Get('recruits')
  searchRecruits(
    @Query('keyword') keyword?: string,
    @Query('skill') skill?: string,
    @Query('role') role?: string,
    @Query('university') university?: string,
  ) {
    return this.searchService.searchRecruits({ keyword, skill, role, university });
  }

  /** GET /search/users - 사용자 검색 */
  @Get('users')
  searchUsers(
    @Query('skill') skill?: string,
    @Query('university') university?: string,
  ) {
    return this.searchService.searchUsers({ skill, university });
  }
}
