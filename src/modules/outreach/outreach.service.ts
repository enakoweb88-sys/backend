import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutreachService {
  constructor(private readonly prisma: PrismaService) {}

  async createDonation(data: any) {
    return this.prisma.donation.create({
      data,
    });
  }

  async getDonations() {
    return this.prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getOverviewStats() {
    const totalDonationsObj = await this.prisma.donation.aggregate({
      _sum: { amount: true },
    });
    const totalDonations = totalDonationsObj._sum.amount || 0;

    const donationCount = await this.prisma.donation.count();

    return {
      activeEvents: 3,
      pendingApplications: 12,
      totalDonations,
      donationCount,
    };
  }
}
