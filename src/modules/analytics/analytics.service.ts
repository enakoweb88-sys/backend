import { Injectable } from '@nestjs/common';
import { ExpenseStatus, KycStatus, MealStatus, TransactionStatus, UserStatus } from '@prisma/client';
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
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.transaction.aggregate({ where: { status: TransactionStatus.SETTLED }, _sum: { amount: true }, _count: true }),
      this.prisma.transaction.aggregate({ where: { status: TransactionStatus.PENDING }, _sum: { amount: true }, _count: true }),
      this.prisma.expense.aggregate({ where: { status: ExpenseStatus.APPROVED }, _sum: { amount: true }, _count: true }),
      this.prisma.kycSubmission.count({ where: { status: { in: [KycStatus.PENDING, KycStatus.UNDER_REVIEW] } } }),
      this.prisma.kycSubmission.count({ where: { status: KycStatus.APPROVED } }),
      this.prisma.mealRecord.aggregate({ where: { status: MealStatus.ATE }, _sum: { totalAmount: true, companyAmount: true, employeeAmount: true }, _count: true }),
      this.prisma.task.count({ where: { status: { not: 'DONE' } } }),
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
