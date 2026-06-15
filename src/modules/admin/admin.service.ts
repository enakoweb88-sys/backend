import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const totalStaff = await this.prisma.user.count();
    const leaveRequests = await this.prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' } });
    const onLeave = leaveRequests.filter(r => r.status === 'Approved').length;
    
    return {
      totalStaff,
      presentToday: totalStaff - onLeave,
      onLeave,
      leaveRequests
    };
  }
}
