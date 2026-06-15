import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateExpenseDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto & { status?: string }, user: JwtUser) {
    const baseWhere: any = user.role === RoleName.EMPLOYEE ? { submittedById: user.sub } : {};
    if (query.status) baseWhere.status = query.status;
    if (query.search) {
      baseWhere.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, totals] = await Promise.all([
      this.prisma.expense.findMany({
        where: baseWhere,
        include: {
          submittedBy: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 50,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 50),
      }),
      this.prisma.expense.groupBy({
        by: ['status'],
        where: user.role === RoleName.EMPLOYEE ? { submittedById: user.sub } : {},
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return { items, totals };
  }

  create(dto: CreateExpenseDto, user: JwtUser, receiptUrl?: string) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'XAF',
        category: dto.category ?? 'Operations',
        receiptUrl: receiptUrl ?? null,
        submittedById: user.sub,
      },
      include: {
        submittedBy: { select: { fullName: true, email: true } },
      },
    });
  }

  async review(id: string, status: ExpenseStatus, reviewerId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    return this.prisma.expense.update({
      where: { id },
      data: {
        status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        submittedBy: { select: { fullName: true, email: true } },
      },
    });
  }

  async delete(id: string, user: JwtUser) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (
      expense.submittedById !== user.sub &&
      user.role !== RoleName.CEO
    ) {
      throw new ForbiddenException('You cannot delete this expense');
    }

    if (expense.status !== 'PENDING' && user.role !== RoleName.CEO) {
      throw new ForbiddenException('Cannot delete a reviewed expense');
    }

    return this.prisma.expense.delete({ where: { id } });
  }
}
