import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitKpiScoreDto, UpdateEmployeeKpiScoreDto } from '../../common/dtos';

@Injectable()
export class KpisService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string, period?: string) {
    const selectedPeriod = this.validatePeriod(period ?? this.currentPeriod());
    const [score, employee] = await Promise.all([
      this.prisma.employeeKpiScore.findUnique({
        where: { userId_period: { userId, period: selectedPeriod } },
        include: { reviewedBy: { select: { id: true, fullName: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { kpiTarget: true } }),
    ]);
    return { period: selectedPeriod, target: employee?.kpiTarget ? Number(employee.kpiTarget) : null, score: this.toScore(score) };
  }

  async submitMine(userId: string, dto: SubmitKpiScoreDto) {
    const period = this.currentPeriod();
    const score = await this.prisma.employeeKpiScore.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, score: dto.score, notes: dto.notes, submittedAt: new Date() },
      update: { score: dto.score, notes: dto.notes, submittedAt: new Date() },
      include: { reviewedBy: { select: { id: true, fullName: true } } },
    });
    return { period, score: this.toScore(score) };
  }

  async getEmployeeScores(userId: string, period?: string) {
    const employee = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, kpiTarget: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const where: any = { userId };
    if (period) where.period = this.validatePeriod(period);
    const scores = await this.prisma.employeeKpiScore.findMany({
      where,
      include: { reviewedBy: { select: { id: true, fullName: true } } },
      orderBy: { period: 'desc' },
      take: period ? 1 : 12,
    });
    return {
      employee: { ...employee, kpiTarget: employee.kpiTarget ? Number(employee.kpiTarget) : null },
      scores: scores.map((score) => this.toScore(score)),
    };
  }

  async updateEmployeeScore(userId: string, reviewerId: string, dto: UpdateEmployeeKpiScoreDto) {
    const employee = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    const period = this.validatePeriod(dto.period ?? this.currentPeriod());
    const score = await this.prisma.employeeKpiScore.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, score: dto.score, notes: dto.notes, reviewedAt: new Date(), reviewedById: reviewerId },
      update: { score: dto.score, notes: dto.notes, reviewedAt: new Date(), reviewedById: reviewerId },
      include: { reviewedBy: { select: { id: true, fullName: true } } },
    });
    return { period, score: this.toScore(score) };
  }

  private toScore(score: any) {
    if (!score) return null;
    return { ...score, score: Number(score.score) };
  }

  private currentPeriod() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return `${year}-${month}`;
  }

  private validatePeriod(period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('KPI period must use YYYY-MM format.');
    }
    return period;
  }
}
