import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private prisma: PrismaService) {}

  async getImpactData() {
    const stats = await this.prisma.publicImpactStat.findMany({ orderBy: { order: 'asc' } });
    const milestones = await this.prisma.publicMilestone.findMany({ orderBy: { order: 'asc' } });
    const charts = await this.prisma.publicImpactChart.findMany({ orderBy: { order: 'asc' } });
    
    // Also fetch public reports
    const reports = await this.prisma.reportFile.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, type: true, data: true }
    });

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
        status: 'OPEN'
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
    
    if (!scholarship || scholarship.type !== 'SCHOLARSHIP') {
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
    return this.prisma.outreachEvent.findUnique({
      where: { id }
    });
  }
}

