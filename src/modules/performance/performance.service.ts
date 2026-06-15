import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreatePerformanceMetricDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId?: string, period?: string) {
    return this.prisma.performanceMetric.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(period ? { period } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findForUser(targetUserId: string) {
    const metrics = await this.prisma.performanceMetric.findMany({
      where: { userId: targetUserId },
      orderBy: [{ period: 'desc' }, { metric: 'asc' }],
    });
    return metrics;
  }

  create(dto: CreatePerformanceMetricDto, actor: JwtUser) {
    if (actor.role === RoleName.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot log performance metrics');
    }
    return this.prisma.performanceMetric.create({
      data: {
        userId: dto.userId,
        metric: dto.metric,
        value: dto.value,
        period: dto.period,
        notes: dto.notes,
      },
      include: {
        user: { select: { id: true, fullName: true, role: { select: { name: true } } } },
      },
    });
  }

  async delete(id: string, actor: JwtUser) {
    if (actor.role !== RoleName.CEO) {
      throw new ForbiddenException('Only the CEO can delete performance metrics');
    }
    const metric = await this.prisma.performanceMetric.findUnique({ where: { id } });
    if (!metric) throw new NotFoundException('Metric not found');
    return this.prisma.performanceMetric.delete({ where: { id } });
  }
}
