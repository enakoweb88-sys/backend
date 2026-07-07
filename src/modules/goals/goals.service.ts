import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateGoalDto, QueryDto, UpdateGoalDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: QueryDto & { scope?: string; status?: string }, user: JwtUser) {
    let accessFilter = {};
    if (user.role === RoleName.EMPLOYEE) {
      accessFilter = {
        OR: [
          { scope: 'COMPANY' },
          { scope: 'DEPARTMENT', departmentId: user.departmentId || 'no-dept' },
          { scope: 'PERSONAL', ownerId: user.sub },
        ]
      };
    }

    return this.prisma.goal.findMany({
      where: {
        ...accessFilter,
        ...(query.scope ? { scope: query.scope as any } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async findOne(id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, role: { select: { name: true } } } },
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async create(dto: CreateGoalDto, user: JwtUser) {
    if (user.role === RoleName.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot create goals');
    }
    return this.prisma.goal.create({
      data: {
        title: dto.title,
        description: dto.description,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue ?? 0,
        unit: dto.unit,
        scope: dto.scope ?? 'COMPANY' as any,
        departmentId: dto.departmentId,
        ownerId: dto.ownerId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateGoalDto, user: JwtUser) {
    if (user.role === RoleName.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update goals');
    }
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Goal not found');

    return this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.targetValue !== undefined ? { targetValue: dto.targetValue } : {}),
        ...(dto.currentValue !== undefined ? { currentValue: dto.currentValue } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true } },
      },
    });
  }

  async delete(id: string, user: JwtUser) {
    if (user.role !== RoleName.CEO) {
      throw new ForbiddenException('Only the CEO can delete goals');
    }
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Goal not found');
    return this.prisma.goal.delete({ where: { id } });
  }

  async complete(id: string, user: JwtUser) {
    if (user.role === RoleName.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot complete goals');
    }
    return this.prisma.goal.update({
      where: { id },
      data: { status: GoalStatus.COMPLETED },
    });
  }

  async updateProgress(id: string, currentValue: number, user: JwtUser) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Goal not found');

    const updated = await this.prisma.goal.update({
      where: { id },
      data: {
        currentValue,
        ...(goal.targetValue && Number(currentValue) >= Number(goal.targetValue)
          ? { status: GoalStatus.COMPLETED }
          : {}),
      },
    });
    return updated;
  }
}
