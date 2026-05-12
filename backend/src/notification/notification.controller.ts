import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';

/**
 * §B-DM-9 알림 REST API.
 *
 * - GET    /api/notifications              본인 알림 목록 (최신 50개)
 * - GET    /api/notifications/unread-count badge용 안 읽음 수
 * - PATCH  /api/notifications/:id/read     단일 읽음 처리
 * - PATCH  /api/notifications/read-all     모두 읽음
 *
 * 실시간 도착은 별도 socket 이벤트 `notification:new` (NotificationGateway).
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.service.unreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.markRead(id, user.id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: { id: string }) {
    const result = await this.service.markAllRead(user.id);
    return { updated: result.count };
  }
}
