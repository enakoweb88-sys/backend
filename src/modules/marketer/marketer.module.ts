import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketerController } from './marketer.controller';
import { MarketerService } from './marketer.service';

@Module({
  imports: [PrismaModule],
  controllers: [MarketerController],
  providers: [MarketerService],
  exports: [MarketerService],
})
export class MarketerModule {}
