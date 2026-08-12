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
    const leads = await this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    if (leads.length === 0) {
      // Seed initial lead if empty
      await this.prisma.lead.createMany({
        data: [
          { name: 'Jean-Paul Mbida', phone: '+237 677 12 34 56', source: 'Douala Wholesale Ltd', interest: 'Remittance & B2B', status: 'Contacted' },
          { name: 'Sarah Nkweti', phone: '+237 699 88 77 66', source: 'Yaounde Fashion Hub', interest: 'High-Yield Savings', status: 'Active Client' },
          { name: 'Emmanuel Talla', phone: '+237 655 44 33 22', source: 'Bafoussam Agro Exports', interest: 'Land Banking', status: 'KYC Sent' },
        ]
      });
      return this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    }
    return leads;
  }

  async createLead(dto: any) {
    return this.prisma.lead.create({
      data: {
        name: dto.name || 'New Client Lead',
        phone: dto.phone || dto.email || '+237 600 00 00 00',
        source: dto.company || dto.source || 'Marketing Campaign',
        interest: dto.interest || 'Remittance & MoMo',
        status: dto.status || 'Contacted'
      }
    });
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
      daysLeft: 0,
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
