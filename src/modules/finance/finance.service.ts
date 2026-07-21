import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async getBanking() {
    return this.prisma.bankAccount.findMany();
  }

  async getBudget() {
    return this.prisma.budget.findMany();
  }

  async getCashPosition() {
    return {
      chartData: []
    };
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
    const bankAccounts = await this.prisma.bankAccount.findMany();
    const assets = bankAccounts.reduce((a, b) => a + Number(b.balance), 0);

    const expenses = await this.prisma.expense.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true }
    });
    const revenue = await this.prisma.transaction.aggregate({
      where: { status: 'SETTLED' },
      _sum: { amount: true }
    });

    const expensesYtd = Number(expenses._sum.amount || 0);
    const revenueYtd = Number(revenue._sum.amount || 0);
    const netProfit = revenueYtd - expensesYtd;

    return {
      assets,
      liabilities: 0,
      equity: assets,
      revenueYtd,
      expensesYtd,
      netProfit
    };
  }
}
