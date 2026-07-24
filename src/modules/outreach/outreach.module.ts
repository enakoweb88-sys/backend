import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';
import { MtnService } from './mtn.service';

@Module({
  imports: [PrismaModule],
  controllers: [OutreachController],
  providers: [OutreachService, MtnService],
  exports: [OutreachService, MtnService],
})
export class OutreachModule {}
