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
    
    let leaveRequests;
    if (isManager) {
      leaveRequests = await this.prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' } });
    } else {
      leaveRequests = await this.prisma.leaveRequest.findMany({ 
        where: { employee: user.fullName },
        orderBy: { createdAt: 'desc' } 
      });
    }

    const onLeave = leaveRequests.filter(r => r.status === 'Approved').length;
    let employees = [];
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
    
    return this.prisma.leaveRequest.create({
      data: {
        employee: isCeo && dto.employee ? dto.employee : user.fullName,
        type: dto.type || 'Annual',
        duration: dto.duration || '1 day',
        status: isCeo ? 'Approved' : 'Pending'
      }
    });
  }
}
