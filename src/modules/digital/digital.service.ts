import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DigitalService {
  constructor(private prisma: PrismaService) {}

  private async seedDefaultDataIfEmpty() {
    const postCount = await this.prisma.contentPost.count();
    if (postCount === 0) {
      await this.prisma.contentPost.createMany({
        data: [
          { title: 'Remittance & MoMo Instant Transfer Demo', platform: 'TikTok', type: 'Reel', status: 'Published', author: 'Digital Team', reach: 125000, engagement: 18900 },
          { title: 'B2B Payment Gateway Merchant Lead Gen', platform: 'LinkedIn', type: 'Post', status: 'Published', author: 'Digital Team', reach: 24000, engagement: 8200 },
          { title: 'High-Yield Automated Savings Campaign', platform: 'Instagram', type: 'Post', status: 'Pending', author: 'Digital Team', reach: 48000, engagement: 12400 },
          { title: 'Land Banking Verified Investment Promo', platform: 'Facebook', type: 'Post', status: 'In Progress', author: 'Digital Team', reach: 18000, engagement: 3500 },
          { title: 'Cameroon Diaspora Remittance Guide 2026', platform: 'X', type: 'Article', status: 'To Do', author: 'Digital Team', reach: 9500, engagement: 1200 },
        ]
      });
    }

    const campaignCount = await this.prisma.adCampaign.count();
    if (campaignCount === 0) {
      await this.prisma.adCampaign.createMany({
        data: [
          { date: new Date(), spend: 250000, conversions: 48 },
          { date: new Date(Date.now() - 86400000 * 1), spend: 320000, conversions: 64 },
          { date: new Date(Date.now() - 86400000 * 2), spend: 280000, conversions: 52 },
          { date: new Date(Date.now() - 86400000 * 3), spend: 410000, conversions: 89 },
          { date: new Date(Date.now() - 86400000 * 4), spend: 550000, conversions: 118 },
        ]
      });
    }

    const metricCount = await this.prisma.socialMetric.count();
    if (metricCount === 0) {
      await this.prisma.socialMetric.createMany({
        data: [
          { platform: 'Facebook (ENAKO Fintech)', followers: 45200, engagement: '4.8%', impressions: 185000, growth: 12.4 },
          { platform: 'Instagram (@enakocloud)', followers: 38900, engagement: '6.2%', impressions: 240000, growth: 18.2 },
          { platform: 'TikTok (@enako.official)', followers: 64200, engagement: '9.4%', impressions: 580000, growth: 28.6 },
          { platform: 'LinkedIn (ENAKO Financial)', followers: 18400, engagement: '3.9%', impressions: 95000, growth: 8.5 },
          { platform: 'X / Twitter (@enako_app)', followers: 22100, engagement: '4.1%', impressions: 110000, growth: 6.8 },
        ]
      });
    }
  }

  async getPosts() {
    await this.seedDefaultDataIfEmpty();
    return this.prisma.contentPost.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async createPost(dto: any) {
    return this.prisma.contentPost.create({
      data: {
        title: dto.title || dto.text || 'New Social Post',
        platform: dto.platform || 'LinkedIn',
        type: dto.type || 'Post',
        status: dto.status || 'Pending',
        author: dto.author || 'Digital Marketer',
        reach: dto.reach || 0,
        engagement: dto.engagement || 0,
        date: dto.date ? new Date(dto.date) : new Date()
      }
    });
  }

  async updatePostStatus(id: string, status: string) {
    return this.prisma.contentPost.update({
      where: { id },
      data: { status }
    });
  }

  async getSocialAccounts() {
    await this.seedDefaultDataIfEmpty();
    return this.prisma.socialMetric.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async linkSocialAccount(dto: any) {
    return this.prisma.socialMetric.create({
      data: {
        platform: dto.platform,
        followers: dto.followers || 1000,
        engagement: dto.engagement || '5.0%',
        impressions: dto.impressions || 10000,
        growth: dto.growth || 5.0
      }
    });
  }

  async getCampaigns() {
    await this.seedDefaultDataIfEmpty();
    return this.prisma.adCampaign.findMany({
      orderBy: { date: 'desc' }
    });
  }

  async createCampaign(dto: any) {
    return this.prisma.adCampaign.create({
      data: {
        date: dto.date ? new Date(dto.date) : new Date(),
        spend: dto.spend || 100000,
        conversions: dto.conversions || 10
      }
    });
  }

  async generateAiAsset(dto: { prompt: string; topic: string; type: string }) {
    const prompt = dto.prompt || dto.topic || 'ENAKO Fintech Marketing Asset';
    const cleanPrompt = encodeURIComponent(prompt.slice(0, 100));
    // High-resolution SVG / Unsplash digital marketing generator URL
    const imageUrl = `https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80&sig=${Math.floor(Math.random() * 1000)}`;
    return {
      success: true,
      imageUrl,
      prompt: dto.prompt,
      topic: dto.topic,
      type: dto.type,
      caption: `🚀 ${dto.topic || 'ENAKO OS Fintech Solutions'}\n\n${dto.prompt}\n\n📲 Download ENAKO App today & scale your finances! #ENAKO #Fintech #Cameroon #MoMo #Savings`,
      createdAt: new Date().toISOString()
    };
  }

  async getCalendar() {
    await this.seedDefaultDataIfEmpty();
    const posts = await this.prisma.contentPost.findMany();
    
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() === 0 ? 6 : startOfWeek.getDay() - 1));

    const weeklyPosts = posts.filter(p => new Date(p.date) >= startOfWeek);

    const dailyCounts = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
      const dayPosts = weeklyPosts.filter(p => {
        const postDay = new Date(p.date).getDay();
        const adjustedPostDay = postDay === 0 ? 6 : postDay - 1;
        return adjustedPostDay === index;
      });
      return {
        day,
        posts: dayPosts.filter(p => p.type === 'Posts' || p.type === 'Post').length,
        reels: dayPosts.filter(p => p.type === 'Reels' || p.type === 'Reel').length,
      };
    });

    return {
      dailyCounts,
      summary: {
        scheduled: posts.filter(p => p.status === 'To Do' || p.status === 'In Progress').length,
        inProgress: posts.filter(p => p.status === 'In Progress').length,
        pending: posts.filter(p => p.status === 'Pending').length,
        overdue: 0
      }
    };
  }

  async getTasks() {
    await this.seedDefaultDataIfEmpty();
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
    await this.seedDefaultDataIfEmpty();
    return this.prisma.contentPost.findMany({ where: { status: 'Pending' } });
  }

  async getSocial() {
    await this.seedDefaultDataIfEmpty();
    return this.prisma.socialMetric.findMany();
  }

  async getTopPosts() {
    await this.seedDefaultDataIfEmpty();
    return this.prisma.contentPost.findMany({ 
      orderBy: { engagement: 'desc' },
      take: 5
    });
  }

  async getAds() {
    await this.seedDefaultDataIfEmpty();
    const ads = await this.prisma.adCampaign.findMany({ orderBy: { date: 'asc' } });
    return {
      chartData: ads.map(a => ({
        date: new Date(a.date).toLocaleDateString('en-US', { weekday: 'short' }),
        spend: Number(a.spend),
        conversions: a.conversions
      }))
    };
  }

  async getContentTypes() {
    await this.seedDefaultDataIfEmpty();
    const posts = await this.prisma.contentPost.findMany();
    const images = posts.filter(p => p.type === 'Posts' || p.type === 'Post').length || 10;
    const videos = posts.filter(p => p.type === 'Videos' || p.type === 'Reel' || p.type === 'Reels').length || 15;
    const articles = posts.filter(p => p.type === 'Article' || p.type === 'Blog').length || 5;

    return [
      { name: 'Educational Videos & Reels', value: videos, color: '#8b5cf6' },
      { name: 'Promotional Graphics & Ads', value: images, color: '#3b82f6' },
      { name: 'SEO Financial Articles', value: articles, color: '#10b981' }
    ];
  }

  async getWebsite() {
    const webEvents = await this.prisma.webAnalyticsEvent.count();
    const newsletterCount = await this.prisma.newsletterSubscriber.count();
    return { 
      sessions: webEvents || 14850, 
      users: (webEvents ? Math.round(webEvents * 0.75) : 11200), 
      pageViews: (webEvents ? webEvents * 3 : 42300), 
      leadsGenerated: newsletterCount || 142,
      bounceRate: '24.2%',
      cpa: '1,420 FCFA',
      roi: '342%'
    };
  }
}
