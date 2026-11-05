import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateExpenseDto, QueryDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto & { status?: string }, user: JwtUser) {
    const baseWhere: any = ['CEO', 'MANAGER'].includes(user.role) ? {} : { submittedById: user.sub };
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
        where: ['CEO', 'MANAGER'].includes(user.role) ? {} : { submittedById: user.sub },
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
        department: dto.department, expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : null, paymentMethod: dto.paymentMethod, receiptRef: dto.receiptRef, notes: dto.notes,
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
    if (expense.submittedById === reviewerId) throw new ForbiddenException('You cannot review your own expense');
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new ForbiddenException('Invalid review status');
    return this.prisma.$transaction(async tx => {
      const changed = await tx.expense.updateMany({ where: { id, status: ExpenseStatus.PENDING, submittedById: { not: reviewerId } }, data: { status, reviewedById: reviewerId, reviewedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('Expense has already been reviewed');
      await tx.auditLog.create({ data: { actorId: reviewerId, action: 'EXPENSE_REVIEWED', entity: 'expense', entityId: id, metadata: { status } } });
      return tx.expense.findUniqueOrThrow({ where: { id }, include: { submittedBy: { select: { fullName: true, email: true } } } });
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
