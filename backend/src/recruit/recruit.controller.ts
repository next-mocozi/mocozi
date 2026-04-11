import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecruitService } from './recruit.service';
import { CreateRecruitDto } from './dto/create-recruit.dto';
import { ApplyRecruitDto } from './dto/apply-recruit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** 구인 컨트롤러 - 구인 게시글 CRUD + 지원 API */
@Controller('recruits')
export class RecruitController {
  constructor(private readonly recruitService: RecruitService) {}

  /** POST /recruits - 구인 게시글 생성 */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateRecruitDto) {
    return this.recruitService.create(dto);
  }

  /** GET /recruits - 구인 게시글 목록 (필터 지원) */
  @Get()
  findAll(
    @Query('skill') skill?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.recruitService.findAll({ skill, role, status });
  }

  /** GET /recruits/:id - 구인 게시글 상세 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recruitService.findOne(id);
  }

  /** POST /recruits/:id/apply - 지원하기 */
  @UseGuards(JwtAuthGuard)
  @Post(':id/apply')
  apply(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApplyRecruitDto,
  ) {
    return this.recruitService.apply(id, user.id, dto);
  }
}
