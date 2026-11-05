import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PostgresThrottlerStorage } from '../../common/postgres-throttler';

@Global()
@Module({
  providers: [PrismaService, PostgresThrottlerStorage],
  exports: [PrismaService, PostgresThrottlerStorage],
})
export class PrismaModule {}
