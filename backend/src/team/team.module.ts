import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { ProposalController } from './proposal.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, PassportModule, NotificationModule],
  controllers: [TeamController, ProposalController],
  providers: [TeamService],
})
export class TeamModule {}
