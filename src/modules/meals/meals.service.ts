import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MealStatus, Prisma, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { MealDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MealsService {
  constructor(private readonly prisma: PrismaService) {}

  async providers() {
    const rows = await this.prisma.mealRecord.findMany({ where: { vendor: { not: null } }, select: { vendor: true }, distinct: ['vendor'], orderBy: { vendor: 'asc' } });
    const names = new Map<string, string>();
    for (const row of rows) {
      const name = row.vendor?.normalize('NFC').trim().replace(/\s+/g, ' ');
      if (name && name.toLowerCase() !== 'other') names.set(name.toLowerCase(), names.get(name.toLowerCase()) || name);
    }
    if (!names.size) names.set('mami chop', 'mami chop');
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }

  async list(user: JwtUser) {
    const where = ['CEO', 'MANAGER'].includes(user.role) ? {} : { employeeId: user.sub };
    const items = await this.prisma.mealRecord.findMany({
      where,
      include: { employee: { select: { fullName: true, email: true } } },
      orderBy: { date: 'desc' },
    });
    const totals = await this.prisma.mealRecord.aggregate({
      where: { ...where, status: MealStatus.ATE },
      _sum: { totalAmount: true, companyAmount: true, employeeAmount: true },
      _count: true,
    });
    return { items, totals };
  }

  async record(dto: MealDto, user: JwtUser) {
    const vendor = (dto.vendor ?? 'mami chop').normalize('NFC').trim().replace(/\s+/g, ' ');
    const mealName = dto.mealName?.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (dto.status === MealStatus.ATE && (!vendor || vendor.length > 100 || vendor.toLowerCase() === 'other')) throw new BadRequestException('Enter a catering provider name (up to 100 characters)');
    if (mealName !== undefined && (!mealName || mealName.length > 150 || mealName.toLowerCase() === 'other')) throw new BadRequestException('Enter a food name (up to 150 characters)');
    const totalAmount = 1000; // Fixed daily delivery price (1,000 FCFA)
    const companyAmount = 500; // 50% paid by company
    const employeeAmount = 500; // 50% paid by employee

    const targetDate = new Date(dto.date);
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Serializable transactions stop simultaneous employee submissions from both passing
    // the daily check. Managers and the CEO may intentionally add another entry.
    const canRepeat = ['CEO', 'MANAGER'].includes(user.role);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(async tx => {
          const existing = canRepeat ? null : await tx.mealRecord.findFirst({
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

          return tx.mealRecord.create({
            data: {
              employeeId: dto.employeeId,
              date: targetDate,
              status: dto.status as MealStatus,
              mealName,
              mealTime: dto.mealTime,
              vendor: dto.status === MealStatus.ATE ? vendor : null,
              notes: dto.notes,
              totalAmount: dto.status === MealStatus.ATE ? totalAmount : 0,
              companyAmount: dto.status === MealStatus.ATE ? companyAmount : 0,
              employeeAmount: dto.status === MealStatus.ATE ? employeeAmount : 0,
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2034' || attempt >= 2) throw error;
      }
    }
  }

  remove(id: string) {
    return this.prisma.mealRecord.delete({ where: { id } });
  }

  async dispute(id: string, reason: string, user: JwtUser) {
    if (!reason?.trim() || reason.length > 2000) throw new BadRequestException('A dispute reason of at most 2000 characters is required');
    const where = { id, ...(['CEO', 'MANAGER'].includes(user.role) ? {} : { employeeId: user.sub }) };
    const result = await this.prisma.mealRecord.updateMany({ where, data: { status: MealStatus.DISPUTED, disputeReason: reason.trim() } });
    if (result.count !== 1) throw new NotFoundException('Meal record not found');
    return this.prisma.mealRecord.findFirst({ where });
  }
}
