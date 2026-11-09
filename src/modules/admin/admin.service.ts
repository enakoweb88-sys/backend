import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';
import { STAFF_DIRECTORY_SELECT, StaffDirectoryResponseDto } from '../../common/staff-response.dto';

import { ReportAlertsService } from '../reports/report-alerts.service';
import { leaveDates, leaveToday } from './leave-dates';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private readonly alerts: ReportAlertsService) {}

  auditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }, take: 500,
      select: { id: true, action: true, entity: true, entityId: true, createdAt: true,
        actor: { select: { fullName: true, role: { select: { name: true } } } } },
    });
  }

  async getOverview(user: JwtUser) {
    if (!['CEO', 'MANAGER'].includes(user.role)) throw new ForbiddenException('HR administration permission required');
    const [totalStaff, activeStaff, leaveRequests, pendingKyc, recentStaff] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: STAFF_DIRECTORY_SELECT
      })
    ]);

    const today = leaveToday();
    const onLeave = await this.prisma.leaveRequest.count({ where: { status: 'Approved', startDate: { lte: today }, endDate: { gte: today } } });

    return {
      totalStaff: activeStaff || totalStaff,
      presentToday: null,
      onLeave,
      leaveRequests,
      onboardingCompletion: null,
      employeeRetention: null,
      performanceReviewCompletion: null,
      trainingCompletion: null,
      employeeSatisfaction: null,
      leaveUtilization: `${Math.round((onLeave / (activeStaff || 1)) * 100)}%`,
      recentStaff: recentStaff.map(staff => new StaffDirectoryResponseDto(staff)),
      pendingKyc
    };
  }

  async listLeaves(user: JwtUser) {
    return this.prisma.leaveRequest.findMany({ where: ['CEO', 'MANAGER'].includes(user.role) ? {} : { employeeId: user.sub }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async createLeave(dto: any, user: JwtUser) {
    const dates = leaveDates(dto.startDate, dto.endDate);
    const employeeId = user.role === 'CEO' ? dto.employeeId : user.sub;
    if (typeof employeeId !== 'string' || !employeeId) throw new BadRequestException('Select an employee');
    if (dto.employeeId && dto.employeeId !== user.sub && user.role !== 'CEO') throw new ForbiddenException('Only the CEO can assign staff leave');
    if (typeof dto.type !== 'string' || !['Annual', 'Sick', 'Maternity/Paternity', 'Compassionate', 'Unpaid'].includes(dto.type)) throw new BadRequestException('Invalid leave category');
    return this.prisma.$transaction(async tx => {
      const employee = await tx.user.findUnique({ where: { id: employeeId }, select: { id: true, fullName: true, status: true } });
      if (!employee || employee.status !== 'ACTIVE') throw new BadRequestException('Select an active employee');
      const leave = await tx.leaveRequest.create({ data: { employeeId: employee.id, employee: employee.fullName, type: dto.type, ...dates, status: user.role === 'CEO' ? 'Approved' : 'Pending' } });
      if (leave.status === 'Approved') await this.alerts.enqueue(tx, [{ userId: employee.id, title: 'Leave assigned', body: 'Your ' + leave.type + ' leave is approved from ' + dto.startDate + ' to ' + dto.endDate + ' (inclusive).', link: '/app/leaves' }]);
      await tx.auditLog.create({ data: { actorId: user.sub, action: 'LEAVE_CREATED', entity: 'leave', entityId: leave.id } });
      return leave;
    });
  }

  async reviewLeave(id: string, status: string, user: JwtUser) {
    if (user.role !== 'CEO') throw new ForbiddenException('Only the CEO can review leave');
    if (!['Approved', 'Rejected'].includes(status)) throw new BadRequestException('Invalid leave decision');
    return this.prisma.$transaction(async tx => {
      const leave = await tx.leaveRequest.findUnique({ where: { id } });
      if (!leave?.employeeId || !leave.startDate || !leave.endDate) throw new BadRequestException('This leave needs an employee and dates before review');
      const updated = await tx.leaveRequest.updateMany({ where: { id, status: 'Pending' }, data: { status } });
      if (updated.count !== 1) throw new BadRequestException('Leave has already been reviewed');
      await this.alerts.enqueue(tx, [{ userId: leave.employeeId, title: 'Leave ' + status.toLowerCase(), body: 'Your leave from ' + leave.startDate.toISOString().slice(0, 10) + ' to ' + leave.endDate.toISOString().slice(0, 10) + ' has been ' + status.toLowerCase() + '.', link: '/app/leaves' }]);
      await tx.auditLog.create({ data: { actorId: user.sub, action: 'LEAVE_' + status.toUpperCase(), entity: 'leave', entityId: id } });
      return { ...leave, status };
    });
  }
}
