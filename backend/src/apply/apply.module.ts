import { Module } from '@nestjs/common';
import { ApplyController } from './apply.controller';
import { ApplyService } from './apply.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { NotificationModule } from '../notification/notification.module';

@Module({
  // §B-DM-9 — ApplyService가 NotificationService 주입받아 지원 접수 알림 트리거
  imports: [PrismaModule, PassportModule, NotificationModule],
  controllers: [ApplyController],
  providers: [ApplyService],
})
export class ApplyModule {}
