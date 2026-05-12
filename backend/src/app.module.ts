import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TeamModule } from './team/team.module';
import { ApplyModule } from './apply/apply.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { SearchModule } from './search/search.module';
import { TemplateModule } from './template/template.module';

// ScoutModule은 Phase B-DM-8에서 폐기 (B-DM-1 통합 후 dead code). §19 폐기 결정 참고.

/** 루트 앱 모듈 - 모든 기능 모듈 통합 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    PortfolioModule,
    TeamModule,
    ApplyModule,
    ChatModule,
    NotificationModule,
    SearchModule,
    TemplateModule,
  ],
})
export class AppModule {}
