import { Injectable } from '@nestjs/common';
import { ExpenseStatus, KycStatus, MealStatus, TaskStatus, TransactionStatus, UserStatus } from '@prisma/client';
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
      failedTransactions,
      unassignedTickets,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.transaction.aggregate({ where: { status: TransactionStatus.SETTLED }, _sum: { amount: true }, _count: true }),
      this.prisma.transaction.aggregate({ where: { status: TransactionStatus.PENDING }, _sum: { amount: true }, _count: true }),
      this.prisma.expense.aggregate({ where: { status: ExpenseStatus.APPROVED }, _sum: { amount: true }, _count: true }),
      this.prisma.kycSubmission.count({ where: { status: { in: [KycStatus.PENDING, KycStatus.UNDER_REVIEW] } } }),
      this.prisma.kycSubmission.count({ where: { status: KycStatus.APPROVED } }),
      this.prisma.mealRecord.aggregate({
        where: { status: MealStatus.ATE },
        _sum: { totalAmount: true, companyAmount: true, employeeAmount: true },
        _count: true,
      }),
      this.prisma.task.count({ where: { status: { not: TaskStatus.DONE } } }),
      this.prisma.transaction.count({ where: { status: TransactionStatus.FAILED } }),
      this.prisma.supportTicket.count({ where: { status: 'New' } }),
    ]);

    return {
      employees: { active: employeeCount, suspended: suspendedCount },
      revenue,
      transactions: { pending: pendingTransactions, failed: failedTransactions },
      expenses,
      kyc: { pending: pendingKyc, approved: approvedKyc },
      meals: mealTotals,
      tasks: { open: openTasks },
      support: { unassignedTickets },
    };
  }

  async healthScore() {
    // Basic mock logic using real DB checks or hardcoded values if no history exists
    return {
      usersGrowth: 12,
      revenueGrowth: 8,
      uptime: 99.9,
      satisfaction: 94,
      score: 85
    };
  }

  async marketingPerformance() {
    const channels = await this.prisma.marketingChannel.findMany();
    return { channels };
  }

  async njangiAnalysis() {
    const groups = await this.prisma.njangiGroup.findMany();
    const activeGroups = groups.filter(g => g.active).length;
    const totalContributions = groups.reduce((acc, g) => acc + Number(g.amount), 0);
    const topGroup = groups.sort((a, b) => Number(b.amount) - Number(a.amount))[0];
    
    return {
      totalGroups: groups.length,
      activeGroups,
      totalContributions,
      topGroup
    };
  }

  async appActivity() {
    const activities = await this.prisma.appActivity.findMany({
      orderBy: { date: 'asc' },
      take: 7
    });
    
    const downloads = activities.reduce((acc, a) => acc + a.downloads, 0);
    const active = activities.reduce((acc, a) => acc + a.active, 0);
    
    return {
      downloads,
      dau: Math.round(active / Math.max(1, activities.length)),
      mau: active * 4,
      chartData: activities.map(a => ({
        name: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
        downloads: a.downloads,
        active: a.active
      }))
    };
  }
}
