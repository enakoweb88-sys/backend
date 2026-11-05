import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DigitalService {
  constructor(private prisma: PrismaService, private readonly config: ConfigService) {}

  async assistant(prompt: string) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) throw new BadRequestException('Enter a prompt of up to 8000 characters');
    const key = this.config.get<string>('ENAKO_API_KEY'), model = this.config.get<string>('ENAKO_AI_MODEL');
    if (!key || !model || !/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw new ServiceUnavailableException('AI assistant is not configured');
    try {
      const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } }, { headers: { 'x-goog-api-key': key }, timeout: 25000, maxRedirects: 0, maxContentLength: 128000 });
      const text = response.data?.candidates?.[0]?.content?.parts?.filter((part: any) => typeof part.text === 'string').map((part: any) => part.text).join('');
      if (!text) throw Error(); return { text };
    } catch { throw new ServiceUnavailableException('AI assistant could not complete the request'); }
  }

  async getPosts() {
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
    return this.prisma.socialMetric.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async linkSocialAccount(dto: any) {
    return this.prisma.socialMetric.create({
      data: {
        platform: dto.platform,
        followers: dto.followers ?? 0,
        engagement: dto.engagement ?? '0%',
        impressions: dto.impressions ?? 0,
        growth: dto.growth ?? 0
      }
    });
  }

  async getCampaigns() {
    return this.prisma.adCampaign.findMany({
      orderBy: { date: 'desc' }
    });
  }

  async createCampaign(dto: any) {
    return this.prisma.adCampaign.create({
      data: {
        date: dto.date ? new Date(dto.date) : new Date(),
        spend: dto.spend ?? 0,
        conversions: dto.conversions ?? 0
      }
    });
  }

  async generateAiAsset(_dto: { prompt: string; topic: string; type: string }) {
    throw new ServiceUnavailableException('Image generation is not configured');
  }

  async getCalendar() {
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
      orderBy: { engagement: 'desc' },
      take: 5
    });
  }

  async getAds() {
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
    const posts = await this.prisma.contentPost.findMany();
    const images = posts.filter(p => p.type === 'Posts' || p.type === 'Post').length;
    const videos = posts.filter(p => p.type === 'Videos' || p.type === 'Reel' || p.type === 'Reels').length;
    const articles = posts.filter(p => p.type === 'Article' || p.type === 'Blog').length;

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
      sessions: null,
      users: null,
      pageViews: webEvents,
      leadsGenerated: newsletterCount,
      bounceRate: null,
      cpa: null,
      roi: null
    };
  }
}
