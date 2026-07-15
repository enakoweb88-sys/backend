import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BdService {
  constructor(private prisma: PrismaService) {}

  async getPipeline() {
    const leads = await this.prisma.lead.findMany();
    const stages = [
      { name: 'Contacted', value: leads.filter(l => l.status === 'Contacted').length, color: '#f59e0b' },
      { name: 'Interested', value: leads.filter(l => l.status === 'Interested').length, color: '#3b82f6' },
      { name: 'KYC Sent', value: leads.filter(l => l.status === 'KYC Sent').length, color: '#8b5cf6' },
      { name: 'Active', value: leads.filter(l => l.status === 'Active Client').length, color: '#10b981' }
    ];
    return { stages, totalValue: 0 };
  }

  async getLeads() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getMeetings() {
    return this.prisma.meeting.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getPerformance() {
    const tx = await this.prisma.transaction.aggregate({
      where: { status: 'SETTLED' },
      _sum: { amount: true }
    });
    const achieved = Number(tx._sum.amount || 0);
    const target = 50000000;
    
    return {
      target,
      achieved,
      remaining: Math.max(0, target - achieved),
      daysLeft: 14,
      sources: [],
      topServices: []
    };
  }

  async getCommission(userId: string) {
    const comm = await this.prisma.commission.findFirst({ where: { userId } });
    if (!comm) return { total: 0, paid: 0, pending: 0 };
    return comm;
  }
}
