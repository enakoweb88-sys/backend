import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutreachEventStatus } from '@prisma/client';

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async getImpactData() {
    const stats = await this.prisma.publicImpactStat.findMany({ orderBy: { order: 'asc' } });
    const milestones = await this.prisma.publicMilestone.findMany({ orderBy: { order: 'asc' } });
    const charts = await this.prisma.publicImpactChart.findMany({ orderBy: { order: 'asc' } });
    
    // Internal exports have no publication flag and must never be treated as public reports.
    const reports: never[] = [];

    return {
      stats,
      milestones,
      charts,
      reports
    };
  }

  async getScholarships() {
    return this.prisma.outreachEvent.findMany({
      where: {
        type: 'SCHOLARSHIP',
        status: { in: [OutreachEventStatus.OPEN, OutreachEventStatus.SCHEDULED] }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getScholarshipById(id: string) {
    const scholarship = await this.prisma.outreachEvent.findUnique({
      where: { id }
    });
    
    if (!scholarship || scholarship.type !== 'SCHOLARSHIP' || !['OPEN', 'SCHEDULED'].includes(scholarship.status)) {
      return null;
    }
    
    return scholarship;
  }

  async getEvents(type?: string) {
    return this.prisma.outreachEvent.findMany({
      where: {
        status: 'OPEN',
        type: type ? type : undefined
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getEventById(id: string) {
    return this.prisma.outreachEvent.findFirst({
      where: { id, status: { in: ['OPEN', 'SCHEDULED'] } }
    });
  }
}

