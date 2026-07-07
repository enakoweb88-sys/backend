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

    const floatAccounts = await this.prisma.floatAccount.findMany();

    const floatData = { mtn: { balance: 0, in: 0, out: 0 }, orange: { balance: 0, in: 0, out: 0 }, bank: { balance: 0, in: 0, out: 0 }, cash: { balance: 0, in: 0, out: 0 } };
    floatAccounts.forEach(f => {
      const ch = f.channel.toLowerCase();
      if (floatData[ch as keyof typeof floatData]) {
        floatData[ch as keyof typeof floatData] = { balance: Number(f.balance), in: Number(f.totalIn), out: Number(f.totalOut) };
      }
    });

    const channelData = Object.entries(
      allTransactions.reduce((acc, tx) => {
        if (tx.channel) {
          acc[tx.channel] = (acc[tx.channel] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    const revenueTypes = ['Operational', 'Income', 'Transfer', 'Expense', 'Receive', 'Send'];
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
      totalRevenue: allTransactions.filter(tx => tx.type === 'Income' || tx.type === 'Receive').reduce((sum, tx) => sum + Number(tx.amount), 0),
      successRate: allTransactions.length > 0 ? Math.round((allTransactions.filter(tx => tx.status === 'SETTLED').length / allTransactions.length) * 1000) / 10 : 0,
      avgValue: allTransactions.length > 0 ? Math.round(totalRev / allTransactions.length) : 0
    };

    return { 
      items, 
      totals: totalsRaw, 
      volumeData, 
      channelData: channelData.length > 0 ? channelData : [{ name: 'None', value: 1 }], 
      topRevenueSources, 
      failedTransactions, 
      recentActivity,
      summary,
      floatManagement: floatData
    };
  }

  async findOne(id: string) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  async create(dto: CreateTransactionDto) {
    const isReceiveFloat = dto.type === 'Receive' && dto.channel;
    const tx = await this.prisma.transaction.create({
      data: {
        reference: `ENK-${Date.now()}`,
        entity: dto.entity,
        type: dto.type ?? 'Operational',
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'XAF',
        channel: dto.channel,
        charges: dto.charges ?? 0,
        status: isReceiveFloat ? TransactionStatus.SETTLED : TransactionStatus.PENDING,
        settledAt: isReceiveFloat ? new Date() : null,
      },
    });

    if (isReceiveFloat) {
      await this.updateFloat(dto.channel!, Number(dto.amount), 0, 'in');
    }

    return tx;
  }

  async setStatus(id: string, status: TransactionStatus, charges: number = 0) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new Error('Transaction not found');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status,
        charges: charges > 0 ? charges : tx.charges,
        settledAt: status === TransactionStatus.SETTLED ? new Date() : undefined,
      },
    });

    if (status === TransactionStatus.SETTLED && tx.type === 'Send' && tx.channel) {
      await this.updateFloat(tx.channel, Number(tx.amount), charges, 'out');
    }

    return updated;
  }

  async updateFloat(channel: string, amount: number, charges: number, direction: 'in' | 'out') {
    const float = await this.prisma.floatAccount.upsert({
      where: { channel },
      create: { channel, balance: 0, totalIn: 0, totalOut: 0 },
      update: {}
    });

    if (direction === 'in') {
      await this.prisma.floatAccount.update({
        where: { id: float.id },
        data: {
          balance: { increment: amount },
          totalIn: { increment: amount }
        }
      });
    } else {
      await this.prisma.floatAccount.update({
        where: { id: float.id },
        data: {
          balance: { decrement: amount + charges },
          totalOut: { increment: amount + charges }
        }
      });
    }
  }

  async setFloatBalance(channel: string, balance: number) {
    return this.prisma.floatAccount.upsert({
      where: { channel },
      create: { channel, balance, totalIn: 0, totalOut: 0 },
      update: { balance }
    });
  }
}
