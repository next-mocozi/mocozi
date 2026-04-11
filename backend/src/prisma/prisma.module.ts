import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Prisma 모듈 - 전역으로 등록하여 모든 모듈에서 사용 가능 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
