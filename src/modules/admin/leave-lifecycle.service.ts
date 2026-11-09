import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReportAlertsService } from '../reports/report-alerts.service';
import { leaveToday } from './leave-dates';

@Injectable()
export class LeaveLifecycleService {
  private running = false;
  private readonly logger = new Logger(LeaveLifecycleService.name);
  constructor(private readonly prisma: PrismaService, private readonly alerts: ReportAlertsService) {}

  @Interval(60_000)
  async finishDueLeaves() {
    if (this.running) return;
    this.running = true;
    try {
      const today = leaveToday();
      const due = await this.prisma.leaveRequest.findMany({ where: { status: 'Approved', endDate: { lt: today }, employeeId: { not: null }, completedAt: null }, take: 100, orderBy: { endDate: 'asc' } });
      for (const leave of due) {
        await this.prisma.$transaction(async tx => {
          const claimed = await tx.leaveRequest.updateMany({ where: { id: leave.id, status: 'Approved', completedAt: null, endDate: { lt: today } }, data: { status: 'Completed', completedAt: new Date() } });
          if (!claimed.count) return;
          const employee = await tx.user.findUnique({ where: { id: leave.employeeId! }, select: { id: true } });
          if (employee) await this.alerts.enqueue(tx, [{ userId: employee.id, title: 'Leave finished', body: `Your ${leave.type} leave from ${leave.startDate!.toISOString().slice(0, 10)} to ${leave.endDate!.toISOString().slice(0, 10)} has finished.`, link: '/app/leaves' }]);
        });
      }
    } catch { this.logger.error('Leave completion processing will retry'); }
    finally { this.running = false; }
  }
}
