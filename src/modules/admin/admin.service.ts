import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';
import { STAFF_DIRECTORY_SELECT, StaffDirectoryResponseDto } from '../../common/staff-response.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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

    const onLeave = leaveRequests.filter(r => r.status === 'Approved').length;

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

  async createLeave(dto: any, user: JwtUser) {
    const isCeo = user.role === 'CEO';
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    const fullName = dbUser?.fullName || user.email;
    
    return this.prisma.leaveRequest.create({
      data: {
        employee: isCeo && dto.employee ? dto.employee : fullName,
        type: dto.type || 'Annual',
        duration: dto.duration || '1 day',
        status: isCeo ? 'Approved' : 'Pending'
      }
    });
  }
}
