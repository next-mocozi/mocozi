import { Module } from '@nestjs/common';
import { TeamController } from './team.controller';
import { ProposalController } from './proposal.controller';
import { TeamService } from './team.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [TeamController, ProposalController],
  providers: [TeamService],
})
export class TeamModule {}
