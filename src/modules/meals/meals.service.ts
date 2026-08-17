import { ConflictException, Injectable } from '@nestjs/common';
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

  async record(dto: MealDto) {
    const totalAmount = 1000; // Fixed daily delivery price (1,000 FCFA)
    const companyAmount = 500; // 50% paid by company
    const employeeAmount = 500; // 50% paid by employee

    const targetDate = new Date(dto.date);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existing = await this.prisma.mealRecord.findFirst({
      where: {
        employeeId: dto.employeeId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: { employee: { select: { fullName: true } } },
    });

    if (existing) {
      const empName = existing.employee?.fullName || 'this employee';
      const formattedDate = targetDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      throw new ConflictException(
        `Food entry for ${empName} has already been recorded for ${formattedDate}.`
      );
    }

    return this.prisma.mealRecord.create({
      data: {
        employeeId: dto.employeeId,
        date: targetDate,
        status: dto.status as MealStatus,
        mealName: dto.mealName,
        mealTime: dto.mealTime,
        totalAmount,
        companyAmount,
        employeeAmount,
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
