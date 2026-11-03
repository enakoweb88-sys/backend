import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsGateway } from './communications.gateway';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [PrismaModule, ReportsModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsGateway, CommunicationsService],
  exports: [CommunicationsGateway, CommunicationsService],
})
export class CommunicationsModule {}
