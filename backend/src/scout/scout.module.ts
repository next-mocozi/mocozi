import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoutController } from './scout.controller';
import { ScoutService } from './scout.service';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [ScoutController],
  providers: [ScoutService],
})
export class ScoutModule {}
