import { Injectable } from '@nestjs/common';
import {
  ExpenseStatus,
  GoalStatus,
  KycStatus,
  MealStatus,
  RoleName,
  TaskStatus,
  TransactionStatus,
  UserStatus,
} from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** CEO / Manager dashboard: aggregated company-wide stats */
  async getOverview() {
    const [
      activeEmployees,
      suspendedEmployees,
      revenue,
      pendingTransactions,
      flaggedTransactions,
      approvedExpenses,
      pendingExpenses,
      pendingKyc,
      approvedKyc,
      mealTotals,
      openTasks,
      doneTasks,
      activeGoals,
      completedGoals,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.SETTLED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { status: TransactionStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.count({ where: { status: TransactionStatus.FLAGGED } }),
      this.prisma.expense.aggregate({
        where: { status: ExpenseStatus.APPROVED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { status: ExpenseStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.kycSubmission.count({
        where: { status: { in: [KycStatus.PENDING, KycStatus.UNDER_REVIEW] } },
      }),
      this.prisma.kycSubmission.count({ where: { status: KycStatus.APPROVED } }),
      this.prisma.mealRecord.aggregate({
        where: { status: MealStatus.ATE },
        _sum: { totalAmount: true, companyAmount: true, employeeAmount: true },
        _count: true,
      }),
      this.prisma.task.count({ where: { status: { not: TaskStatus.DONE } } }),
      this.prisma.task.count({ where: { status: TaskStatus.DONE } }),
      this.prisma.goal.count({ where: { status: GoalStatus.ACTIVE } }),
      this.prisma.goal.count({ where: { status: GoalStatus.COMPLETED } }),
    ]);

    return {
      employees: { active: activeEmployees, suspended: suspendedEmployees },
      revenue,
      transactions: { pending: pendingTransactions, flagged: flaggedTransactions },
      expenses: { approved: approvedExpenses, pending: pendingExpenses },
      kyc: { pending: pendingKyc, approved: approvedKyc },
      meals: mealTotals,
      tasks: { open: openTasks, done: doneTasks },
      goals: { active: activeGoals, completed: completedGoals },
    };
  }

  /** Employee-specific dashboard stats */
  async getEmployeeStats(user: JwtUser) {
    const [myTasks, myExpenses, myMeals, recentAnnouncements] = await Promise.all([
      this.prisma.task.findMany({
        where: { assigneeId: user.sub },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take: 5,
      }),
      this.prisma.expense.aggregate({
        where: { submittedById: user.sub },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.mealRecord.aggregate({
        where: { employeeId: user.sub, status: MealStatus.ATE },
        _sum: { employeeAmount: true, companyAmount: true },
        _count: true,
      }),
      this.prisma.announcement.findMany({
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        take: 3,
        include: { author: { select: { fullName: true } } },
      }),
    ]);

    return {
      tasks: myTasks,
      expenses: myExpenses,
      meals: myMeals,
      announcements: recentAnnouncements,
    };
  }

  /** Monthly transaction chart data (last 6 months) */
  async getTransactionChart() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const transactions = await this.prisma.transaction.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, amount: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by month
    const grouped: Record<string, { total: number; count: number }> = {};
    for (const tx of transactions) {
      const key = tx.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += Number(tx.amount);
      grouped[key].count += 1;
    }

    return Object.entries(grouped).map(([month, data]) => ({
      month,
      total: data.total,
      count: data.count,
    }));
  }

  /** Role-based stats by employee */
  async getEmployeeBreakdown() {
    return this.prisma.user.groupBy({
      by: ['roleId'],
      where: { status: UserStatus.ACTIVE },
      _count: true,
    });
  }
}
