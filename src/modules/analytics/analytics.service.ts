import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      employeeCount,
      suspendedCount,
      revenue,
      pendingTransactions,
      expenses,
      pendingKyc,
      approvedKyc,
      mealTotals,
      openTasks,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' as any } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' as any } }),
      this.prisma.transaction.aggregate({ where: { status: 'SETTLED' as any }, _sum: { amount: true }, _count: true }),
      this.prisma.transaction.aggregate({ where: { status: 'PENDING' as any }, _sum: { amount: true }, _count: true }),
      this.prisma.expense.aggregate({ where: { status: 'APPROVED' as any }, _sum: { amount: true }, _count: true }),
      this.prisma.kycSubmission.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] as any[] } } }),
      this.prisma.kycSubmission.count({ where: { status: 'APPROVED' as any } }),
      this.prisma.mealRecord.aggregate({
        where: { status: 'ATE' as any },
        _sum: { totalAmount: true, companyAmount: true, employeeAmount: true },
        _count: true,
      }),
      this.prisma.task.count({ where: { status: { not: 'DONE' as any } } }),
    ]);

    return {
      employees: { active: employeeCount, suspended: suspendedCount },
      revenue,
      transactions: { pending: pendingTransactions },
      expenses,
      kyc: { pending: pendingKyc, approved: approvedKyc },
      meals: mealTotals,
      tasks: { open: openTasks },
    };
  }
}
