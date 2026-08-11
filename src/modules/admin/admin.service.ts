import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getOverview(user: JwtUser) {
    const isCeo = user.role === 'CEO';
    const isManager = isCeo || user.role === 'MANAGER' || user.role === 'OUTREACH_MANAGER';
    const [totalStaff, activeStaff, leaveRequests, pendingKyc, recentStaff] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { role: true, department: true }
      })
    ]);

    const onLeave = leaveRequests.filter(r => r.status === 'Approved').length;

    return {
      totalStaff: activeStaff || totalStaff,
      presentToday: activeStaff - onLeave,
      onLeave,
      leaveRequests,
      onboardingCompletion: '94.2%',
      employeeRetention: '96.8%',
      performanceReviewCompletion: '92.0%',
      trainingCompletion: '88.5%',
      employeeSatisfaction: '4.8 / 5.0',
      leaveUtilization: `${Math.round((onLeave / (activeStaff || 1)) * 100)}%`,
      recentStaff,
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
