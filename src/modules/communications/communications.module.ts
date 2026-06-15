import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommunicationsController } from './communications.controller';
import { CommunicationsGateway } from './communications.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsGateway],
  exports: [CommunicationsGateway],
})
export class CommunicationsModule {}
