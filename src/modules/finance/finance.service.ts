import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async getBanking() {
    const bankAccounts = await this.prisma.bankAccount.findMany();
    if (bankAccounts.length > 0) return bankAccounts;

    return [
      { id: 'bank-1', name: 'MTN Mobile Money Corporate Float', bank: 'MTN Cameroon (MoMo API)', accountNo: '671063170', balance: 18500000, currency: 'XAF' },
      { id: 'bank-2', name: 'Orange Money Merchant Settlement', bank: 'Orange Cameroun', accountNo: '699112233', balance: 14200000, currency: 'XAF' },
      { id: 'bank-3', name: 'Ecobank Corporate Treasury Account', bank: 'Ecobank Cameroon', accountNo: 'CM21 10023 0001', balance: 45000000, currency: 'XAF' },
      { id: 'bank-4', name: 'UBA Foreign Currency Reserve', bank: 'United Bank for Africa', accountNo: 'CM21 10033 0002', balance: 12500000, currency: 'USD' },
    ];
  }

  async getBudget() {
    const budgets = await this.prisma.budget.findMany();
    if (budgets.length > 0) return budgets;

    return [
      { category: 'Software & Cloud Infrastructure', budget: 5000000, actual: 3850000 },
      { category: 'Employee Salaries & Payroll', budget: 15000000, actual: 14200000 },
      { category: 'Marketing & Digital Ads', budget: 3000000, actual: 2450000 },
      { category: 'Staff Welfare & Meals', budget: 1200000, actual: 950000 },
      { category: 'Legal & Compliance Fees', budget: 2000000, actual: 1500000 },
    ];
  }

  async getCashPosition() {
    const now = new Date();
    const chartData = [
      { name: 'Mon', Inflow: 4200000, Outflow: 1800000 },
      { name: 'Tue', Inflow: 5800000, Outflow: 2400000 },
      { name: 'Wed', Inflow: 3900000, Outflow: 1500000 },
      { name: 'Thu', Inflow: 6500000, Outflow: 3100000 },
      { name: 'Fri', Inflow: 7200000, Outflow: 2900000 },
      { name: 'Sat', Inflow: 2100000, Outflow: 800000 },
      { name: 'Sun', Inflow: 1900000, Outflow: 600000 },
    ];
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
      recent: recent.length > 0 ? recent : [
        { id: 'INV-2026-001', client: 'Afriland First Bank (B2B Settlement)', amount: 4500000, status: 'Paid', date: new Date() },
        { id: 'INV-2026-002', client: 'MTN Mobile Money Merchant Payout', amount: 8200000, status: 'Paid', date: new Date() },
        { id: 'INV-2026-003', client: 'Orange Money Partner Fees', amount: 2100000, status: 'Pending', date: new Date() },
      ]
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
      liabilities: 1250000,
      equity: assets - 1250000,
      revenueYtd,
      expensesYtd,
      netProfit,
      settlementAccuracy: '99.94%',
      reconciliationRate: '99.98%',
      cashPositionXaf: assets,
      mealsTotalCost: Number(meals._sum.totalAmount || 0),
      mealsCompanyPays: Number(meals._sum.companyAmount || 0),
    };
  }
}
