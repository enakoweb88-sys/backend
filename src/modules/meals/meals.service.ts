import { Injectable } from '@nestjs/common';
import { MealStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { MealDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser) {
    const where = user.role === RoleName.EMPLOYEE ? { employeeId: user.sub } : {};
    const items = await this.prisma.mealRecord.findMany({
      where,
      include: { employee: { select: { fullName: true, email: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    });
    const totals = await this.prisma.mealRecord.aggregate({
      where: { ...where, status: MealStatus.ATE },
      _sum: { totalAmount: true, companyAmount: true, employeeAmount: true },
      _count: true,
    });
    return { items, totals };
  }

  record(dto: MealDto) {
    return this.prisma.mealRecord.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date: new Date(dto.date) } },
      update: { status: dto.status as MealStatus },
      create: {
        employeeId: dto.employeeId,
        date: new Date(dto.date),
        status: dto.status as MealStatus,
        totalAmount: 1000,
        companyAmount: 500,
        employeeAmount: 500,
      },
    });
  }

  dispute(id: string, reason: string) {
    return this.prisma.mealRecord.update({
      where: { id },
      data: { status: MealStatus.DISPUTED, disputeReason: reason },
    });
  }
}
