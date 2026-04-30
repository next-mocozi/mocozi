import { Module } from '@nestjs/common';
import { ApplyController } from './apply.controller';
import { ApplyService } from './apply.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [ApplyController],
  providers: [ApplyService],
})
export class ApplyModule {}
