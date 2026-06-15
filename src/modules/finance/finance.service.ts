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
      chartData: [
        { day: 'Mon', in: 4000000, out: 2400000 },
        { day: 'Tue', in: 3000000, out: 1398000 },
        { day: 'Wed', in: 2000000, out: 9800000 },
        { day: 'Thu', in: 2780000, out: 3908000 },
        { day: 'Fri', in: 1890000, out: 4800000 },
        { day: 'Sat', in: 2390000, out: 3800000 },
        { day: 'Sun', in: 3490000, out: 4300000 }
      ]
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
    return {
      assets,
      liabilities: 45000000,
      equity: assets - 45000000,
      revenueYtd: 85000000,
      expensesYtd: 42000000,
      netProfit: 43000000
    };
  }
}
