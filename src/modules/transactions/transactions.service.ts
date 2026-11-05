import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { serializable } from '../../common/serializable';
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
      if (query.type === 'Income') {
        where.type = { in: ['Receive', 'CREDIT'] };
      } else if (query.type === 'Expense') {
        where.type = 'Send';
      } else {
        where.type = query.type;
      }
    }

    if (query.channel && query.channel !== 'All Channels') {
      let mappedChannel = query.channel;
      if (mappedChannel === 'MTN MoMo') mappedChannel = 'MTN';
      else if (mappedChannel === 'Orange Money') mappedChannel = 'Orange';
      where.channel = mappedChannel;
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

    if (query.specificDate) {
      const dateStr = query.specificDate;
      const start = new Date(`${dateStr}T00:00:00.000Z`);
      const end = new Date(`${dateStr}T23:59:59.999Z`);
      where.createdAt = {
        gte: start,
        lte: end
      };
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
        select: { createdAt: true, amount: true, amountInXaf: true, status: true, type: true, channel: true }
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
      }).reduce((sum, tx: any) => sum + Number(tx.amountInXaf ?? tx.amount), 0);
      return { name: day, volume: vol };
    });

    const floatAccounts = await this.prisma.floatAccount.findMany();

    const floatData = { mtn: { balance: 0, in: 0, out: 0 }, orange: { balance: 0, in: 0, out: 0 }, bank: { balance: 0, in: 0, out: 0 }, cash: { balance: 0, in: 0, out: 0 } };
    floatAccounts.forEach((f: any) => {
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
    const totalRev = allTransactions.reduce((sum, tx: any) => sum + Number(tx.amountInXaf ?? tx.amount), 0);
    const topRevenueSources = revenueTypes.map(rt => {
      const amount = allTransactions.filter(tx => tx.type === rt).reduce((sum, tx: any) => sum + Number(tx.amountInXaf ?? tx.amount), 0);
      return {
        name: rt,
        amount,
        percent: totalRev > 0 ? Math.round((amount / totalRev) * 100) : 0
      };
    }).filter(s => s.amount > 0).sort((a,b) => b.amount - a.amount);

    const summary = {
      totalVolume: totalRev,
      totalRevenue: allTransactions.filter(tx => tx.type === 'Income' || tx.type === 'Receive').reduce((sum, tx: any) => sum + Number(tx.amountInXaf ?? tx.amount), 0),
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

  private amount(value: unknown, allowZero = false) {
    let number: Prisma.Decimal;
    try { number = new Prisma.Decimal(String(value)); } catch { throw new BadRequestException('Invalid monetary amount'); }
    if (!number.isFinite() || (allowZero ? number.lt(0) : number.lte(0)) || number.decimalPlaces() > 2 || number.gt('999999999999.99')) throw new BadRequestException('Invalid monetary amount');
    return number;
  }

  async create(dto: CreateTransactionDto, actor: JwtUser, key: string) {
    if (!actor?.sub) throw new ForbiddenException('Authenticated actor required');
    if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw new BadRequestException('A stable Idempotency-Key of 16?128 characters is required');
    const amount = this.amount(dto.amount), amountInXaf = this.amount(dto.amountInXaf ?? dto.amount), charges = this.amount(dto.charges ?? 0, true);
    const currency = (dto.currency || 'XAF').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('ISO currency required');
    const type = dto.type || 'Operational';
    if (!['Operational', 'Receive', 'Send', 'Income', 'Expense', 'Transfer', 'CREDIT', 'DEBIT'].includes(type)) throw new BadRequestException('Unsupported transaction type');
    const payload = { entity: dto.entity, amount: amount.toFixed(2), amountInXaf: amountInXaf.toFixed(2), currency, exchangeRate: dto.exchangeRate ?? null, type, channel: dto.channel || null, charges: charges.toFixed(2), description: dto.description || null };
    const requestHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const idempotencyKey = createHash('sha256').update('transaction|' + actor.sub + '|' + key).digest('hex');
    return serializable(this.prisma, async tx => {
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey } });
      if (existing) { if (existing.requestHash !== requestHash) throw new ConflictException('Idempotency key was used for a different request'); return existing; }
      const settled = type === 'Receive' && !!dto.channel;
      const created = await tx.transaction.create({ data: { entity: dto.entity, description: dto.description, channel: dto.channel, exchangeRate: dto.exchangeRate, amount, amountInXaf, charges, currency, type, idempotencyKey, requestHash, reference: 'ENK-' + randomUUID(), status: settled ? TransactionStatus.SETTLED : TransactionStatus.PENDING, settledAt: settled ? new Date() : null, ledgerAppliedAt: settled ? new Date() : null } });
      if (settled) await this.applyFloat(tx, dto.channel!, amountInXaf, new Prisma.Decimal(0), 'in');
      await tx.auditLog.create({ data: { actorId: actor.sub, action: 'FINANCIAL_TRANSACTION_CREATED', entity: 'transaction', entityId: created.id, metadata: { status: created.status } } });
      return created;
    });
  }

  async setStatus(id: string, status: TransactionStatus, charges = 0, actor?: JwtUser) {
    if (!actor?.sub) throw new ForbiddenException('Authenticated actor required');
    if (![TransactionStatus.SETTLED, TransactionStatus.FAILED, TransactionStatus.FLAGGED].includes(status as any)) throw new BadRequestException('Invalid transaction transition');
    const requestedCharges = this.amount(charges, true);
    return serializable(this.prisma, async tx => {
      const current = await tx.transaction.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Transaction not found');
      if (current.status === status) return current; // Idempotent replay: no second balance/audit effect.
      if (!['PENDING', 'FLAGGED'].includes(current.status) || (current.status === 'FLAGGED' && status === 'FLAGGED')) throw new ConflictException('Final transaction cannot be reopened');
      const fee = requestedCharges.gt(0) ? requestedCharges : new Prisma.Decimal(current.charges || 0);
      const changed = await tx.transaction.updateMany({ where: { id, status: current.status, ledgerAppliedAt: null }, data: { status, charges: fee, ...(status === 'SETTLED' ? { settledAt: new Date(), ledgerAppliedAt: new Date() } : {}) } });
      if (changed.count !== 1) throw new ConflictException('Transaction changed concurrently or its ledger effect already exists');
      if (status === 'SETTLED' && current.channel) {
        const value = this.amount(current.amountInXaf ?? current.amount);
        if (current.type === 'Send') await this.applyFloat(tx, current.channel, value, fee, 'out');
        else if (current.type === 'Receive') await this.applyFloat(tx, current.channel, value, new Prisma.Decimal(0), 'in');
      }
      await tx.auditLog.create({ data: { actorId: actor.sub, action: 'FINANCIAL_STATUS_CHANGED', entity: 'transaction', entityId: id, metadata: { from: current.status, to: status } } });
      return tx.transaction.findUniqueOrThrow({ where: { id } });
    });
  }

  private async applyFloat(tx: Prisma.TransactionClient, channel: string, amount: Prisma.Decimal, charges: Prisma.Decimal, direction: 'in' | 'out') {
    if (!channel?.trim() || channel.length > 100) throw new BadRequestException('Valid channel required');
    const account = await tx.floatAccount.upsert({ where: { channel }, create: { channel, balance: 0, totalIn: 0, totalOut: 0 }, update: {} });
    if (direction === 'in') return tx.floatAccount.update({ where: { id: account.id }, data: { balance: { increment: amount }, totalIn: { increment: amount } } });
    const debit = amount.plus(charges);
    const changed = await tx.floatAccount.updateMany({ where: { id: account.id, balance: { gte: debit } }, data: { balance: { decrement: debit }, totalOut: { increment: debit } } });
    if (changed.count !== 1) throw new ConflictException('Insufficient float balance');
  }

  async setFloatBalance(channel: string, balance: number, actor?: JwtUser) {
    if (actor?.role !== 'CEO') throw new ForbiddenException('Only the CEO may initialize an opening float');
    const amount = this.amount(balance, true);
    return serializable(this.prisma, async tx => {
      const existing = await tx.floatAccount.findUnique({ where: { channel } });
      if (existing) { if (existing.balance.equals(amount)) return existing; throw new ConflictException('Existing float must be changed through audited ledger transactions'); }
      const account = await tx.floatAccount.create({ data: { channel, balance: amount, totalIn: amount, totalOut: 0 } });
      await tx.auditLog.create({ data: { actorId: actor.sub, action: 'FLOAT_OPENED', entity: 'float', entityId: account.id } });
      return account;
    });
  }

  async getExchangeRates() {
    try {
      return await this.prisma.exchangeRate.findMany({
        orderBy: { code: 'asc' },
      });
    } catch (e) {
      console.error('Error fetching exchange rates from database:', e);
      return [];
    }
  }

  async saveExchangeRates(dto: { rates: Array<{ code: string; name: string; flag?: string; buyingRate?: string; sellingRate?: string; change24h?: number }> }) {
    const list = dto.rates || [];
    const results = [];
    for (const r of list) {
      const saved = await this.prisma.exchangeRate.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          name: r.name || r.code,
          flag: r.flag || '',
          buyingRate: r.buyingRate || '',
          sellingRate: r.sellingRate || '',
          change24h: r.change24h ?? 0,
        },
        update: {
          buyingRate: r.buyingRate !== undefined ? r.buyingRate : undefined,
          sellingRate: r.sellingRate !== undefined ? r.sellingRate : undefined,
          change24h: r.change24h !== undefined ? r.change24h : undefined,
          flag: r.flag || undefined,
          name: r.name || undefined,
        },
      });
      results.push(saved);
    }
    return results;
  }
}
