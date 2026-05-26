import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { MoneyDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto) {
    const items = await this.prisma.transaction.findMany({
      where: query.search
        ? { OR: [{ reference: { contains: query.search, mode: 'insensitive' } }, { entity: { contains: query.search, mode: 'insensitive' } }] }
        : {},
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
    const totals = await this.prisma.transaction.groupBy({ by: ['status'], _sum: { amount: true }, _count: true });
    return { items, totals };
  }

  create(dto: MoneyDto & { entity?: string; type?: string }) {
    return this.prisma.transaction.create({
      data: {
        reference: `ENK-${Date.now()}`,
        entity: dto.entity ?? dto.description,
        type: dto.type ?? dto.category ?? 'Operational',
        amount: dto.amount,
        currency: dto.currency ?? 'XAF',
      },
    });
  }

  setStatus(id: string, status: TransactionStatus) {
    return this.prisma.transaction.update({
      where: { id },
      data: { status, settledAt: status === TransactionStatus.SETTLED ? new Date() : undefined },
    });
  }
}
