import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

/**
 * §B-DM-9 알림 모듈 — controller(REST) + service(CRUD) + gateway(socket emit).
 *
 * Service는 다른 모듈(chat, apply 등)이 의존해서 알림을 생성. exports로 노출.
 */
@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
