import { Module } from '@nestjs/common';
import { CashCollectionsController } from './cash-collections.controller';
import { CashCollectionsService } from './cash-collections.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CashCollectionsController],
  providers: [CashCollectionsService],
  exports: [CashCollectionsService],
})
export class CashCollectionsModule {}
