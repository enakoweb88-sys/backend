import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportDocumentsService } from './report-documents.service';
import { ReportAlertsService } from './report-alerts.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportDocumentsService, ReportAlertsService],
  exports: [ReportAlertsService],
})
export class ReportsModule {}
