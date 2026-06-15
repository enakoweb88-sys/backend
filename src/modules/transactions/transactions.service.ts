import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { CreateTransactionDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto & { status?: string }) {
    const where: any = {};
    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { entity: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, totals] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 50),
      }),
      this.prisma.transaction.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return { items, totals };
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
