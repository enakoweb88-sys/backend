import { Module } from '@nestjs/common';
import { BdController } from './bd.controller';
import { BdService } from './bd.service';

@Module({
  controllers: [BdController],
  providers: [BdService]
})
export class BdModule {}
