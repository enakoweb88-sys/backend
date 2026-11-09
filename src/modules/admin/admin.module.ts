import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ReportsModule } from '../reports/reports.module';
import { LeaveLifecycleService } from './leave-lifecycle.service';

@Module({
  imports: [ReportsModule],
  controllers: [AdminController],
  providers: [AdminService, LeaveLifecycleService]
})
export class AdminModule {}
