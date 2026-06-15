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
    return { stages, totalValue: leads.length * 150000 };
  }

  async getLeads() {
    return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getMeetings() {
    return this.prisma.meeting.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getPerformance() {
    return {
      target: 50000000,
      achieved: 32500000,
      remaining: 17500000,
      daysLeft: 14,
      sources: [
        { name: 'Facebook Ads', value: 45 },
        { name: 'Referral', value: 30 },
        { name: 'Walk-in', value: 15 },
        { name: 'Direct Sales', value: 10 }
      ],
      topServices: [
        { name: 'API Integrations', value: 12000000 },
        { name: 'Payment Gateways', value: 8500000 },
        { name: 'Njangi Management', value: 12000000 }
      ]
    };
  }

  async getCommission(userId: string) {
    const comm = await this.prisma.commission.findFirst({ where: { userId } });
    if (!comm) return { total: 0, paid: 0, pending: 0 };
    return comm;
  }
}
