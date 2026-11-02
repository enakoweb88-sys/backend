import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, Prisma } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateGoalDto, GoalQueryDto, GoalReportQueryDto, UpdateGoalDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import { objectivePeriod } from './objective-period';

const relations = {
  department: { select: { id: true, name: true } },
  owner: { select: { id: true, fullName: true, title: true, department: true, role: { select: { name: true } } } },
} as const;

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  private canAssign(user: JwtUser) {
    return ['CEO', 'MANAGER'].includes(user.role);
  }

  private async visibleTo(user: JwtUser): Promise<Prisma.GoalWhereInput> {
    if (this.canAssign(user)) return {};
    // Existing access tokens contain no department ID. Use the current HR record.
    const employee = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { departmentId: true } });
    const departmentId = employee?.departmentId;
    return { OR: [
      { scope: 'PERSONAL', ownerId: user.sub },
      ...(departmentId ? [{ scope: 'DEPARTMENT' as const, departmentId }] : []),
    ] };
  }

  private assertCanTrack(goal: { scope: string; ownerId: string | null }, user: JwtUser) {
    if (!this.canAssign(user) && (goal.scope !== 'PERSONAL' || goal.ownerId !== user.sub)) {
      throw new ForbiddenException('You can only change progress on your own personal objectives');
    }
  }

  async list(query: GoalQueryDto, user: JwtUser) {
    // Keep search OR conditions separate from the access OR conditions.
    return this.prisma.goal.findMany({
      where: { AND: [
        await this.visibleTo(user),
        query.scope ? { scope: query.scope } : {},
        query.status ? { status: query.status as GoalStatus } : {},
        query.search ? { OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ] } : {},
      ] },
      include: relations,
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit ?? 50, 1000),
      skip: ((query.page ?? 1) - 1) * Math.min(query.limit ?? 50, 1000),
    });
  }

  async findOne(id: string, user: JwtUser) {
    const goal = await this.prisma.goal.findFirst({ where: { AND: [{ id }, await this.visibleTo(user)] }, include: relations });
    if (!goal) throw new NotFoundException('Objective not found');
    return goal;
  }

  async create(dto: CreateGoalDto, user: JwtUser) {
    const canAssign = this.canAssign(user);
    if (!canAssign && ((dto.scope && dto.scope !== 'PERSONAL') || (dto.ownerId && dto.ownerId !== user.sub) || dto.isKpi)) {
      throw new ForbiddenException('You can only create personal objectives for yourself');
    }
    const scope = canAssign ? dto.scope ?? 'PERSONAL' : 'PERSONAL';
    const ownerId = scope === 'PERSONAL' ? dto.ownerId || user.sub : null;
    if (scope === 'DEPARTMENT' && !dto.departmentId) throw new BadRequestException('Select a department');
    const cadence = dto.cadence ?? 'DAILY';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const period = objectivePeriod(cadence, (dto.periodStart || today).slice(0, 10));
    return this.prisma.goal.create({
      data: {
        title: dto.title, description: dto.description,
        targetValue: dto.targetValue ?? 100, targetLabel: dto.targetLabel,
        currentValue: 0, unit: dto.unit ?? '%', scope,
        departmentId: scope === 'DEPARTMENT' ? dto.departmentId : null,
        ownerId, cadence, periodStart: period.start, dueDate: period.dueDate,
        isKpi: canAssign ? dto.isKpi ?? false : false,
        kpiWeight: canAssign ? dto.kpiWeight : undefined,
      }, include: relations,
    });
  }

  async update(id: string, dto: UpdateGoalDto, user: JwtUser) {
    if (!this.canAssign(user)) throw new ForbiddenException('Only managers and the CEO can edit assigned objective details');
    const goal = await this.findOne(id, user);
    const period = dto.cadence || dto.periodStart
      ? objectivePeriod(dto.cadence || goal.cadence || 'DAILY', (dto.periodStart || goal.periodStart?.toISOString() || new Date().toISOString()).slice(0, 10))
      : null;
    const targetValue = dto.targetValue ?? goal.targetValue;
    const currentValue = dto.currentValue ?? goal.currentValue;
    const status = (dto.status as GoalStatus | undefined) ?? (
      (dto.currentValue !== undefined || dto.targetValue !== undefined) && targetValue && Number(currentValue) >= Number(targetValue)
        ? GoalStatus.COMPLETED : goal.status
    );
    return this.prisma.goal.update({
      where: { id }, data: {
        title: dto.title, description: dto.description, targetValue: dto.targetValue,
        targetLabel: dto.targetLabel, currentValue: dto.currentValue, unit: dto.unit,
        ...(period ? { cadence: dto.cadence || goal.cadence || 'DAILY', periodStart: period.start, dueDate: period.dueDate }
          : dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        status,
        completedAt: status === GoalStatus.COMPLETED ? goal.completedAt || new Date() : null,
        isKpi: dto.isKpi, kpiWeight: dto.kpiWeight,
      }, include: relations,
    });
  }

  async delete(id: string, user: JwtUser) {
    if (user.role !== 'CEO') throw new ForbiddenException('Only the CEO can delete goals');
    await this.findOne(id, user);
    return this.prisma.goal.delete({ where: { id } });
  }

  async complete(id: string, user: JwtUser) {
    const goal = await this.findOne(id, user);
    this.assertCanTrack(goal, user);
    return this.prisma.goal.update({ where: { id }, data: {
      status: GoalStatus.COMPLETED, currentValue: goal.targetValue ?? goal.currentValue,
      completedAt: goal.completedAt || new Date(),
    }, include: relations });
  }

  async updateProgress(id: string, currentValue: number, user: JwtUser) {
    if (!Number.isFinite(currentValue) || currentValue < 0) throw new BadRequestException('Progress must be a non-negative number');
    const goal = await this.findOne(id, user);
    this.assertCanTrack(goal, user);
    const completed = Number(goal.targetValue) > 0 && currentValue >= Number(goal.targetValue);
    return this.prisma.goal.update({ where: { id }, data: {
      currentValue, status: completed ? GoalStatus.COMPLETED : GoalStatus.ACTIVE,
      completedAt: completed ? goal.completedAt || new Date() : null,
    }, include: relations });
  }

  async report(query: GoalReportQueryDto, user: JwtUser) {
    if (!this.canAssign(user) && query.ownerId && query.ownerId !== user.sub) {
      throw new ForbiddenException('You can only export your own objectives');
    }
    const period = objectivePeriod(query.period, query.date.slice(0, 10));
    const range = { gte: period.reportStart, lt: period.reportEnd };
    const items = await this.prisma.goal.findMany({
      where: { AND: [
        { status: GoalStatus.COMPLETED },
        this.canAssign(user) ? query.ownerId ? { ownerId: query.ownerId } : {} : { scope: 'PERSONAL', ownerId: user.sub },
        // Legacy records did not store completedAt. Identify the estimate explicitly.
        { OR: [{ completedAt: range }, { completedAt: null, updatedAt: range }] },
      ] }, include: relations, orderBy: [{ completedAt: 'asc' }, { updatedAt: 'asc' }],
    });
    return { start: period.start.toISOString().slice(0, 10), end: period.dueDate.toISOString().slice(0, 10), items };
  }
}
