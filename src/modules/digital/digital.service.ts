import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DigitalService {
  constructor(private prisma: PrismaService) {}

  async getCalendar() {
    const posts = await this.prisma.contentPost.findMany();
    const dailyCounts = [
      { day: 'Mon', posts: 2, reels: 1 },
      { day: 'Tue', posts: 1, reels: 2 },
      { day: 'Wed', posts: 3, reels: 0 },
      { day: 'Thu', posts: 0, reels: 3 },
      { day: 'Fri', posts: 2, reels: 2 },
      { day: 'Sat', posts: 1, reels: 1 },
      { day: 'Sun', posts: 0, reels: 0 }
    ];
    return {
      dailyCounts,
      summary: {
        scheduled: posts.length,
        inProgress: posts.filter(p => p.status === 'In Progress').length,
        pending: posts.filter(p => p.status === 'Pending').length,
        overdue: 0
      }
    };
  }

  async getTasks() {
    const posts = await this.prisma.contentPost.findMany();
    return {
      todo: posts.filter(p => p.status === 'To Do').length,
      inProgress: posts.filter(p => p.status === 'In Progress').length,
      forReview: posts.filter(p => p.status === 'Pending').length,
      approved: posts.filter(p => p.status === 'Approved').length,
      published: posts.filter(p => p.status === 'Published').length,
      rejected: 0
    };
  }

  async getApprovals() {
    return this.prisma.contentPost.findMany({ where: { status: 'Pending' } });
  }

  async getSocial() {
    return this.prisma.socialMetric.findMany();
  }

  async getTopPosts() {
    return this.prisma.contentPost.findMany({ 
      where: { status: 'Published' },
      orderBy: { engagement: 'desc' },
      take: 5
    });
  }

  async getAds() {
    const ads = await this.prisma.adCampaign.findMany({ orderBy: { date: 'asc' } });
    return {
      chartData: ads.map(a => ({
        name: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
        spend: Number(a.spend),
        conversions: a.conversions
      }))
    };
  }

  async getContentTypes() {
    return [
      { name: 'Images', value: 45, color: '#3b82f6' },
      { name: 'Videos', value: 35, color: '#8b5cf6' },
      { name: 'Articles', value: 20, color: '#10b981' }
    ];
  }

  async getWebsite() {
    return { sessions: 45200, users: 32100, pageViews: 125000, bounceRate: 42.5 };
  }
}
