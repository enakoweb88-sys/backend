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

  async globalSearch(query: string, user: JwtUser) {
    if (!query || query.trim() === '') return [];
    
    const searchStr = query.trim();
    const role = (user.role || '').toUpperCase();

    // Role-Based Access Control logic for the search feature
    const isManagement = ['CEO', 'MANAGER', 'ADMIN'].includes(role);
    const isFinance = isManagement || role === 'FINANCE';
    const isOutreach = isManagement || role === 'OUTREACH_MANAGER';
    const isSupport = isManagement || role === 'SUPPORT';

    const [
      users,
      transactions,
      expenses,
      announcements,
      tickets,
      projects,
      events,
      blogs,
      applications,
      stats
    ] = await Promise.all([
      // 1. Users (Basic employee info accessible to everyone)
      this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: searchStr, mode: 'insensitive' } },
            { email: { contains: searchStr, mode: 'insensitive' } },
            { title: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }),
      // 2. Transactions (Finance & Management)
      isFinance ? this.prisma.transaction.findMany({
        where: {
          OR: [
            { id: { contains: searchStr, mode: 'insensitive' } },
            { type: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
      // 3. Expenses (Finance & Management)
      isFinance ? this.prisma.expense.findMany({
        where: {
          OR: [
            { description: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
      // 4. Announcements (Accessible to all)
      this.prisma.announcement.findMany({
        where: {
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { content: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }),
      // 5. Support Tickets (Support & Management)
      isSupport ? this.prisma.supportTicket.findMany({
        where: {
          OR: [
            { subject: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
      // 6. Outreach Projects (Outreach & Management)
      isOutreach ? this.prisma.communityProject.findMany({
        where: {
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { communitySlug: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
      // 7. Outreach Events
      isOutreach ? this.prisma.outreachEvent.findMany({
        where: {
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { titleFr: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
      // 8. Outreach Blogs
      isOutreach ? this.prisma.blogPost.findMany({
        where: { OR: [{ title: { contains: searchStr, mode: 'insensitive' } }] },
        take: 3
      }) : Promise.resolve([]),
      // 9. Outreach Applications
      isOutreach ? this.prisma.outreachApplication.findMany({
        where: {
          OR: [
            { applicantName: { contains: searchStr, mode: 'insensitive' } },
            { email: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
      // 10. Outreach Stats
      isOutreach ? this.prisma.publicImpactStat.findMany({
        where: {
          OR: [
            { label: { contains: searchStr, mode: 'insensitive' } },
            { value: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 3
      }) : Promise.resolve([]),
    ]);

    return [
      ...users.map(u => ({ id: u.id, type: 'EMPLOYEE', title: u.fullName, subtitle: u.title || u.email, link: '/app/employees' })),
      ...transactions.map(t => ({ id: t.id, type: 'TRANSACTION', title: `Transaction: ${t.type}`, subtitle: `Status: ${t.status}`, link: '/app/transactions' })),
      ...expenses.map(e => ({ id: e.id, type: 'EXPENSE', title: e.description, subtitle: `Category: ${e.category}`, link: '/app/expenses' })),
      ...announcements.map(a => ({ id: a.id, type: 'ANNOUNCEMENT', title: a.title, subtitle: `By: ${a.authorId}`, link: '/app/announcements' })),
      ...tickets.map(t => ({ id: t.id, type: 'SUPPORT TICKET', title: t.subject, subtitle: `Status: ${t.status}`, link: '/app/tickets' })),
      ...projects.map(p => ({ id: p.id, type: 'COMMUNITY PROJECT', title: p.title, subtitle: `Community: ${p.communitySlug}`, link: '/app/outreach/projects' })),
      ...events.map(e => ({ id: e.id, type: e.type === 'SCHOLARSHIP' ? 'SCHOLARSHIP' : 'EVENT', title: e.title, subtitle: `Type: ${e.type}`, link: e.type === 'SCHOLARSHIP' ? '/app/outreach/scholarships' : '/app/outreach/events' })),
      ...blogs.map(b => ({ id: b.id, type: 'BLOG POST', title: b.title, subtitle: `Status: ${b.status}`, link: '/app/outreach/cms' })),
      ...applications.map(a => ({ id: a.id, type: 'APPLICATION', title: a.applicantName, subtitle: `Track: ${a.type}`, link: a.type === 'SCHOLARSHIP' ? '/app/outreach/scholarships' : '/app/outreach/applications' })),
      ...stats.map(s => ({ id: s.id, type: 'IMPACT STAT', title: s.label, subtitle: `Value: ${s.value}`, link: '/app/outreach/stats' }))
    ];
  }

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
