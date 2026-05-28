import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [MulterModule.register({ dest: './uploads' })],
  controllers: [KycController],
  providers: [KycService],
})
export class KycModule {}
