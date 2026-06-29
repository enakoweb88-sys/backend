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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [recentUsers, oldUsers, recentRevenueAggr, oldRevenueAggr, pendingTickets, resolvedTickets] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      this.prisma.transaction.aggregate({ where: { status: 'SETTLED', createdAt: { gte: thirtyDaysAgo } }, _sum: { amount: true } }),
      this.prisma.transaction.aggregate({ where: { status: 'SETTLED', createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }, _sum: { amount: true } }),
      this.prisma.supportTicket.count({ where: { status: { not: 'Resolved' } } }),
      this.prisma.supportTicket.count({ where: { status: 'Resolved' } })
    ]);

    const usersGrowth = oldUsers > 0 ? Math.round(((recentUsers - oldUsers) / oldUsers) * 100) : (recentUsers > 0 ? 100 : 0);
    
    const recentRev = Number(recentRevenueAggr._sum?.amount ?? 0);
    const oldRev = Number(oldRevenueAggr._sum?.amount ?? 0);
    const revenueGrowth = oldRev > 0 ? Math.round(((recentRev - oldRev) / oldRev) * 100) : (recentRev > 0 ? 100 : 0);

    const totalTickets = pendingTickets + resolvedTickets;
    const satisfaction = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;

    let score = 80;
    if (usersGrowth > 0) score += 5;
    if (revenueGrowth > 0) score += 5;
    if (satisfaction >= 90) score += 10;
    if (pendingTickets > 5) score -= 5;
    
    score = Math.min(100, Math.max(0, score));

    return {
      usersGrowth,
      revenueGrowth,
      uptime: 100,
      satisfaction,
      score
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
