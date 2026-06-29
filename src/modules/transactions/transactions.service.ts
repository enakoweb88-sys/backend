import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { CreateTransactionDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: any) {
    const where: any = {};
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { entity: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    
    if (query.status && query.status !== 'All Status') {
      if (query.status === 'Completed') where.status = 'SETTLED';
      else if (query.status === 'Pending') where.status = 'PENDING';
      else if (query.status === 'Failed') where.status = 'FAILED';
      else where.status = query.status.toUpperCase();
    }
    
    if (query.type && query.type !== 'All Types') {
      where.type = query.type;
    }

    if (query.dateRange && query.dateRange !== 'All Dates' && query.dateRange !== 'Custom Range...') {
      const now = new Date();
      if (query.dateRange === 'Today') {
        const start = new Date(now.setHours(0,0,0,0));
        where.createdAt = { gte: start };
      } else if (query.dateRange === 'This Week') {
        const start = new Date(now.setDate(now.getDate() - now.getDay()));
        start.setHours(0,0,0,0);
        where.createdAt = { gte: start };
      } else if (query.dateRange === 'This Month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: start };
      }
    }

    const [items, totalsRaw, allTransactions, failedTransactions, recentActivity] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(query.limit) || 50,
        skip: ((Number(query.page) || 1) - 1) * (Number(query.limit) || 50),
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.findMany({
        where,
        select: { createdAt: true, amount: true, status: true, type: true }
      }),
      this.prisma.transaction.findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),
      this.prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { fullName: true } } }
      })
    ]);

    const volumeData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
      const vol = allTransactions.filter(tx => {
         const d = new Date(tx.createdAt).getDay();
         const adj = d === 0 ? 6 : d - 1;
         return adj === idx;
      }).reduce((sum, tx) => sum + Number(tx.amount), 0);
      return { name: day, volume: vol };
    });

    const channelData = [
      { name: 'MTN MoMo', value: 55 }, { name: 'Orange Money', value: 35 }, { name: 'Bank Transfer', value: 10 }
    ];

    const revenueTypes = ['Operational', 'Income', 'Transfer', 'Expense'];
    const totalRev = allTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const topRevenueSources = revenueTypes.map(rt => {
      const amount = allTransactions.filter(tx => tx.type === rt).reduce((sum, tx) => sum + Number(tx.amount), 0);
      return {
        name: rt,
        amount,
        percent: totalRev > 0 ? Math.round((amount / totalRev) * 100) : 0
      };
    }).filter(s => s.amount > 0).sort((a,b) => b.amount - a.amount);

    const summary = {
      totalVolume: totalRev,
      totalRevenue: allTransactions.filter(tx => tx.type === 'Income').reduce((sum, tx) => sum + Number(tx.amount), 0),
      successRate: allTransactions.length > 0 ? Math.round((allTransactions.filter(tx => tx.status === 'SETTLED').length / allTransactions.length) * 1000) / 10 : 0,
      avgValue: allTransactions.length > 0 ? Math.round(totalRev / allTransactions.length) : 0
    };

    return { 
      items, 
      totals: totalsRaw, 
      volumeData, 
      channelData, 
      topRevenueSources, 
      failedTransactions, 
      recentActivity,
      summary,
      floatManagement: {
        mtn: { balance: 0, in: 0, out: 0 },
        orange: { balance: 0, in: 0, out: 0 }
      }
    };
  }

  async findOne(id: string) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  create(dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        reference: `ENK-${Date.now()}`,
        entity: dto.entity,
        type: dto.type ?? 'Operational',
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'XAF',
      },
    });
  }

  setStatus(id: string, status: TransactionStatus) {
    return this.prisma.transaction.update({
      where: { id },
      data: {
        status,
        settledAt: status === TransactionStatus.SETTLED ? new Date() : undefined,
      },
    });
  }
}
