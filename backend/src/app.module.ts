import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TeamModule } from './team/team.module';
import { ApplyModule } from './apply/apply.module';
import { ScoutModule } from './scout/scout.module';
import { ChatModule } from './chat/chat.module';
import { SearchModule } from './search/search.module';
import { TemplateModule } from './template/template.module';

/** 루트 앱 모듈 - 모든 기능 모듈 통합 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UserModule,
    PortfolioModule,
    TeamModule,
    ApplyModule,
    ScoutModule,
    ChatModule,
    SearchModule,
    TemplateModule,
  ],
})
export class AppModule {}
