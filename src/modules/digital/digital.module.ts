import { Module } from '@nestjs/common';
import { DigitalController } from './digital.controller';
import { DigitalService } from './digital.service';

@Module({
  controllers: [DigitalController],
  providers: [DigitalService]
})
export class DigitalModule {}
