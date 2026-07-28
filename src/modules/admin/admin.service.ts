import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getOverview(user: JwtUser) {
    const isCeo = user.role === 'CEO';
    const isManager = isCeo || user.role === 'MANAGER' || user.role === 'OUTREACH_MANAGER';
    const totalStaff = await this.prisma.user.count();
    
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    const fullName = dbUser?.fullName || user.email;

    let leaveRequests;
    if (isManager) {
      leaveRequests = await this.prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' } });
    } else {
      leaveRequests = await this.prisma.leaveRequest.findMany({ 
        where: { employee: fullName },
        orderBy: { createdAt: 'desc' } 
      });
    }

    const onLeave = leaveRequests.filter(r => r.status === 'Approved').length;
    let employees: Array<{ id: string; fullName: string | null; email: string }> = [];
    if (isCeo) {
      employees = await this.prisma.user.findMany({ 
        select: { id: true, fullName: true, email: true }, 
        where: { status: 'ACTIVE' } 
      });
    }
    
    return {
      totalStaff,
      presentToday: totalStaff - onLeave,
      onLeave,
      leaveRequests,
      employees
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
