import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async getBanking() {
    const bankAccounts = await this.prisma.bankAccount.findMany();
    return bankAccounts;
  }

  async getBudget() {
    const budgets = await this.prisma.budget.findMany();
    return budgets;
  }

  async getCashPosition() {
    const transactions = await this.prisma.transaction.findMany({ where: { status: 'SETTLED', createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { createdAt: true, type: true, amountInXaf: true, amount: true } });
    const chartData = Array.from({ length: 7 }, (_, i) => { const date = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10); const records = transactions.filter(tx => tx.createdAt.toISOString().startsWith(date)); return { name: date, Inflow: records.filter(tx => ['Receive', 'Income', 'CREDIT'].includes(tx.type)).reduce((sum, tx) => sum + Number(tx.amountInXaf ?? tx.amount), 0), Outflow: records.filter(tx => ['Send', 'Expense', 'DEBIT'].includes(tx.type)).reduce((sum, tx) => sum + Number(tx.amountInXaf ?? tx.amount), 0) }; });
    return { chartData };
  }

  async getInvoices() {
    const recent = await this.prisma.invoice.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
    const all = await this.prisma.invoice.findMany();
    
    return {
      summary: {
        total: all.reduce((a, b) => a + Number(b.amount), 0),
        paid: all.filter(i => i.status === 'Paid').reduce((a, b) => a + Number(b.amount), 0),
        pending: all.filter(i => i.status === 'Pending').reduce((a, b) => a + Number(b.amount), 0),
        overdue: all.filter(i => i.status === 'Overdue').reduce((a, b) => a + Number(b.amount), 0),
      },
      recent
    };
  }

  async getAccountsSummary() {
    const bankAccounts = await this.getBanking();
    const assets = bankAccounts.reduce((a, b) => a + Number(b.balance), 0);

    const [expenses, revenue, meals] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { status: 'SETTLED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.mealRecord.aggregate({
        where: { status: 'ATE' },
        _sum: { companyAmount: true, employeeAmount: true, totalAmount: true },
        _count: true,
      }),
    ]);

    const expensesYtd = Number(expenses._sum.amount || 0);
    const revenueYtd = Number(revenue._sum.amount || 0);
    const netProfit = revenueYtd - expensesYtd;

    return {
      assets,
      liabilities: null,
      equity: null,
      revenueYtd,
      expensesYtd,
      netProfit,
      settlementAccuracy: null,
      reconciliationRate: null,
      cashPositionXaf: assets,
      mealsTotalCost: Number(meals._sum.totalAmount || 0),
      mealsCompanyPays: Number(meals._sum.companyAmount || 0),
    };
  }
}
