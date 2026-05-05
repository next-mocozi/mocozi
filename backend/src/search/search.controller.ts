import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

/** 검색 컨트롤러 - 통합 검색 API */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** GET /search/teams - 팀 검색 */
  @Get('teams')
  searchTeams(
    @Query('keyword') keyword?: string,
    @Query('skill') skill?: string,
    @Query('role') role?: string,
    @Query('university') university?: string,
  ) {
    return this.searchService.searchTeams({ keyword, skill, role, university });
  }

  /** GET /search/users - 사용자 검색 */
  @Get('users')
  searchUsers(
    @Query('keyword') keyword?: string,
    @Query('skill') skill?: string | string[],
    @Query('role') role?: string,
    @Query('university') university?: string,
  ) {
    const skills = skill ? (Array.isArray(skill) ? skill : [skill]) : undefined;
    return this.searchService.searchUsers({ keyword, skills, role, university });
  }
}
