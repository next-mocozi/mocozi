import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MessageContext } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertTemplateDto } from './dto/upsert-template.dto';
import { TemplateService } from './template.service';

/**
 * 채팅 첫 메시지 양식 — 사용자별·컨텍스트별 단일 양식 관리.
 *
 * - GET /api/templates?context=X — 본인 양식 (없으면 default 합성)
 * - PUT /api/templates — upsert (body에 context + content)
 * - DELETE /api/templates/:context — 삭제 (다음 GET 시 default 합성으로 fallback)
 */
@Controller('api/templates')
@UseGuards(JwtAuthGuard)
export class TemplateController {
  constructor(private templateService: TemplateService) {}

  @Get()
  async getOne(
    @CurrentUser() user: { id: string },
    @Query('context') context: MessageContext,
  ) {
    return this.templateService.getOrBuildDefault(user.id, context);
  }

  @Put()
  async upsert(
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertTemplateDto,
  ) {
    return this.templateService.upsert(user.id, dto.context, dto.content);
  }

  @Delete(':context')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: { id: string },
    @Param('context') context: MessageContext,
  ) {
    await this.templateService.remove(user.id, context);
  }
}
