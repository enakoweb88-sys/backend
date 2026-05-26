import { Injectable } from '@nestjs/common';
import { ExpenseStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { MoneyDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto, user: JwtUser) {
    const where = user.role === RoleName.EMPLOYEE ? { submittedById: user.sub } : {};
    const items = await this.prisma.expense.findMany({
      where,
      include: { submittedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
    const totals = await this.prisma.expense.groupBy({
      by: ['status'],
      where,
      _sum: { amount: true },
      _count: true,
    });
    return { items, totals };
  }

  create(dto: MoneyDto, user: JwtUser) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'XAF',
        category: dto.category ?? 'Operations',
        submittedById: user.sub,
      },
    });
  }

  review(id: string, status: ExpenseStatus) {
    return this.prisma.expense.update({ where: { id }, data: { status } });
  }
}
