import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsGateway } from './communications.gateway';

@Module({ controllers: [CommunicationsController], providers: [CommunicationsGateway] })
export class CommunicationsModule {}
