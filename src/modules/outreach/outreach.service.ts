import { SecureFilesService } from '../files/secure-files.service';
import { ServiceUnavailableException } from '@nestjs/common';
import { DonationPaymentsService } from './donation-payments.service';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';
import { OutreachApplicationType, ApplicationStatus, OutreachEventStatus } from '@prisma/client';
import { MtnService } from './mtn.service';
import { PixiPayService } from './pixipay.service';

@Injectable()
export class OutreachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mtnService: MtnService,
    private readonly pixiPayService: PixiPayService,
    private readonly files: SecureFilesService,
    private readonly payments: DonationPaymentsService
  ) {}

  private async uploadToSupabase(base64Data: string, prefix: string): Promise<string | null> {
    if (!base64Data || !base64Data.startsWith('data:')) return null;
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.storage.createBucket('outreach', { public: true }).catch(() => {});
        
        // Extract content type and base64 string
        const match = base64Data.match(/^data:([a-zA-Z0-9-+\/]+);base64,(.+)$/);
        if (match && match.length === 3) {
          const contentType = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const ext = contentType.split('/')[1] || 'pdf';
          const fileName = `${prefix}-${Date.now()}.${ext}`;
          
          const { error } = await supabase.storage.from('outreach').upload(fileName, buffer, {
            contentType,
            upsert: true
          });
          
          if (!error) {
            const { data } = supabase.storage.from('outreach').getPublicUrl(fileName);
            return data.publicUrl;
          } else {
            console.error('Supabase upload error:', error);
          }
        }
      }
    } catch (e) {
      console.error('Failed to upload file to supabase', e);
    }
    return null;
  }

  createDonation(data: any, key?: string) { return this.payments.create(data, key); }
  getDonationStatus(uuid: string, token: string | undefined, id: string) { return this.payments.status(uuid, token, id); }

  async globalSearch(query: string, internal = false) {
    if (!query || query.trim() === '') {
      return [];
    }
    
    const searchStr = query.trim();
    
    const [projects, events, blogs, applications, stats] = await Promise.all([
      this.prisma.communityProject.findMany({
        where: {
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
            { communitySlug: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 5
      }),
      this.prisma.outreachEvent.findMany({
        where: {
          ...(internal ? {} : { status: { in: [OutreachEventStatus.OPEN, OutreachEventStatus.SCHEDULED] } }),
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
            { titleFr: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 5
      }),
      this.prisma.blogPost.findMany({
        where: {
          ...(internal ? {} : { status: 'PUBLISHED' }),
          OR: [
            { title: { contains: searchStr, mode: 'insensitive' } },
            { content: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 5
      }),
      internal ? this.prisma.outreachApplication.findMany({
        where: {
          OR: [
            { applicantName: { contains: searchStr, mode: 'insensitive' } },
            { email: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 5
      }) : Promise.resolve([]),
      this.prisma.publicImpactStat.findMany({
        where: {
          OR: [
            { label: { contains: searchStr, mode: 'insensitive' } },
            { value: { contains: searchStr, mode: 'insensitive' } }
          ]
        },
        take: 5
      })
    ]);

    const results = [
      ...projects.map(p => ({
        id: p.id,
        type: 'COMMUNITY PROJECT',
        title: p.title,
        subtitle: `Community: ${p.communitySlug}`,
        link: '/app/outreach/projects'
      })),
      ...events.map(e => ({
        id: e.id,
        type: e.type === 'SCHOLARSHIP' ? 'SCHOLARSHIP' : 'EVENT',
        title: e.title,
        subtitle: `Type: ${e.type}`,
        link: e.type === 'SCHOLARSHIP' ? '/app/outreach/scholarships' : '/app/outreach/events'
      })),
      ...blogs.map(b => ({
        id: b.id,
        type: 'BLOG POST',
        title: b.title,
        subtitle: `Status: ${b.status}`,
        link: '/app/outreach/cms'
      })),
      ...applications.map(a => ({
        id: a.id,
        type: 'APPLICATION',
        title: a.applicantName,
        subtitle: `Track: ${a.type}`,
        link: a.type === 'SCHOLARSHIP' ? '/app/outreach/scholarships' : '/app/outreach/applications'
      })),
      ...stats.map(s => ({
        id: s.id,
        type: 'IMPACT STAT',
        title: s.label,
        subtitle: `Value: ${s.value}`,
        link: '/app/outreach/stats'
      }))
    ];

    return results;
  }

  async handleOrangeWebhook(_payload: unknown) { throw new ServiceUnavailableException('Orange callback contract is not verified; no payment state changed'); }
  handleMtnWebhook(payload: unknown) { return this.payments.callback(payload); }

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

    const activeEvents = await this.prisma.outreachEvent.count({
      where: { status: 'OPEN' }
    });

    const pendingApplications = await this.prisma.outreachApplication.count({
      where: { status: 'PENDING' }
    });

    return {
      activeEvents,
      pendingApplications,
      totalDonations,
      donationCount,
    };
  }

  async createApplication(data: any) {
    if (!['VOLUNTEER', 'SCHOLARSHIP', 'FAMILY_IN_NEED'].includes(data.type) || typeof data.applicantName !== 'string' || !data.applicantName.trim() || data.applicantName.length > 200 || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || (data.documents && (!Array.isArray(data.documents) || data.documents.length > 5))) throw new BadRequestException('Invalid application details');
    const prepared: Array<Awaited<ReturnType<SecureFilesService['prepareBase64']>>> = [];
    for (const value of data.documents || []) prepared.push(await this.files.prepareBase64(value, 'donation'));
    const application = await this.prisma.$transaction(async tx => {
      const created = await tx.outreachApplication.create({ data: { type: data.type, applicantName: data.applicantName.trim(), email: data.email.trim().toLowerCase(), phone: typeof data.phone === 'string' ? data.phone.slice(0, 40) : null, eventId: typeof data.eventId === 'string' ? data.eventId : null, details: data.details && typeof data.details === 'object' && !Array.isArray(data.details) ? data.details : {}, status: 'PENDING', documents: prepared.map(file => '/api/v1/files/private/' + file.id) } });
      for (const file of prepared) await tx.secureFile.create({ data: { ...file, parentId: created.id, expiresAt: null } });
      return created;
    });
    return { id: application.id, status: application.status };
  }

  async getApplications() {
    return this.prisma.outreachApplication.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async sendNewsletter(_data: { subject: string; body: string; audience: string }) {
    throw new ServiceUnavailableException('Newsletter delivery is not configured. No messages have been sent.');
  }

  // --- Outreach Events (Scholarships, etc) ---
  
  async getEvents(internal = false) {
    return this.prisma.outreachEvent.findMany({
      where: internal ? {} : { status: { in: ['OPEN', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });
  }

  private mapEventStatus(rawStatus?: string): OutreachEventStatus {
    if (!rawStatus) return OutreachEventStatus.OPEN;
    const s = String(rawStatus).toUpperCase();
    if (s === 'DRAFT') return OutreachEventStatus.DRAFT;
    if (s === 'SCHEDULED') return OutreachEventStatus.SCHEDULED;
    if (s === 'CLOSED' || s === 'COMPLETED') return OutreachEventStatus.CLOSED;
    return OutreachEventStatus.OPEN;
  }

  async createEvent(data: any) {
    let storyMediaUrl = data.storyMediaUrl || null;
    if (data.storyMediaBase64) {
      const url = await this.uploadToSupabase(data.storyMediaBase64, 'outreach-story');
      if (url) storyMediaUrl = url;
    }

    const processedGallery: any[] = [];
    if (data.gallery && Array.isArray(data.gallery)) {
      for (const item of data.gallery) {
        let itemUrl = item.url || null;
        if (item.fileBase64) {
          const url = await this.uploadToSupabase(item.fileBase64, 'outreach-gallery');
          if (url) itemUrl = url;
        }
        if (itemUrl) {
          processedGallery.push({
            url: itemUrl,
            caption: item.caption || '',
            captionFr: item.captionFr || ''
          });
        }
      }
    }

    const status = this.mapEventStatus(data.status);

    return this.prisma.outreachEvent.create({
      data: {
        title: data.title,
        titleFr: data.titleFr,
        description: data.description,
        descriptionFr: data.descriptionFr,
        type: data.type || 'SCHOLARSHIP',
        status,
        openDate: data.openDate ? new Date(data.openDate) : null,
        closeDate: data.closeDate ? new Date(data.closeDate) : null,
        targetSchools: data.targetSchools || [],
        videoUrl: data.videoUrl || null,
        gallery: processedGallery.length > 0 ? processedGallery : undefined,
        storyTitle: data.storyTitle || null,
        storyTitleFr: data.storyTitleFr || null,
        storyDescription: data.storyDescription || null,
        storyDescriptionFr: data.storyDescriptionFr || null,
        storyMediaUrl,
        storyMediaType: data.storyMediaType || null,
        customFields: data.customFields || null
      }
    });
  }

  async updateEventStatus(id: string, status: any, openDate?: string) {
    if (!['OPEN', 'DRAFT', 'SCHEDULED', 'CLOSED', 'COMPLETED'].includes(status) || (openDate && !Number.isFinite(Date.parse(openDate)))) throw new BadRequestException('Invalid event status or publication date');
    const validStatus = this.mapEventStatus(status);
    return this.prisma.outreachEvent.update({
      where: { id },
      data: { status: validStatus, ...(openDate ? { openDate: new Date(openDate) } : {}) }
    });
  }

  // --- Blog Posts ---

  async getPosts(status?: string, internal = false) {
    return this.prisma.blogPost.findMany({
      where: internal ? (status ? { status } : {}) : { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPost(data: any) {
    // Priority: direct URL from frontend upload > base64 fallback
    let coverImage = data.coverImage || null;
    if (!coverImage && data.coverImageBase64) {
      const url = await this.uploadToSupabase(data.coverImageBase64, 'blog-cover');
      if (url) coverImage = url;
    }

    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    return this.prisma.blogPost.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        category: data.category || 'Blog',
        coverImage,
        images: data.images || [],
        video: data.video || null,
        author: data.author || 'ENAKO Outreach Team',
        status: data.status || 'DRAFT',
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      }
    });
  }

  async updatePost(id: string, data: any) {
    // Priority: direct URL from frontend upload > base64 fallback
    let coverImage = data.coverImage || null;
    if (!coverImage && data.coverImageBase64) {
      const url = await this.uploadToSupabase(data.coverImageBase64, 'blog-cover');
      if (url) coverImage = url;
    }

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        ...(coverImage && { coverImage }),
        author: data.author || undefined,
        images: data.images,
        video: data.video,
        status: data.status,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
      }
    });
  }

  async updatePostStatus(id: string, status: string) {
    return this.prisma.blogPost.update({
      where: { id },
      data: { 
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      }
    });
  }

  // --- Analytics & Cookie Intelligence ---
  async recordCookieConsent(data: { consent: string; userAgent?: string; deviceType?: string; country?: string }) {
    return this.prisma.cookieConsentRecord.create({
      data: {
        consent: data.consent,
        userAgent: data.userAgent || null,
        deviceType: data.deviceType || 'desktop',
        country: data.country || 'Cameroon',
      }
    });
  }

  async recordAnalyticsEvent(data: any) {
    return this.prisma.webAnalyticsEvent.create({
      data: {
        eventType: data.eventType || 'pageview',
        path: data.path || '/',
        referrer: data.referrer || null,
        utmSource: data.utmSource || null,
        utmMedium: data.utmMedium || null,
        utmCampaign: data.utmCampaign || null,
        clickX: data.clickX ? parseFloat(data.clickX) : null,
        clickY: data.clickY ? parseFloat(data.clickY) : null,
        scrollDepth: data.scrollDepth ? parseInt(data.scrollDepth, 10) : null,
        duration: data.duration ? parseInt(data.duration, 10) : null,
        deviceType: data.deviceType || 'desktop',
        country: data.country || 'Cameroon',
      }
    });
  }

  async getWebInsights(site: string = 'outreach') {
    if (site === 'main') {
      return {
        consent: { total: 0, accepted: 0, declined: 0, rate: 0 },
        traffic: { totalEvents: 0, pageviews: 0, avgDurationSeconds: 0, bounceRatePercent: 0 },
        heatmaps: [],
        campaigns: [],
        topPages: [],
        recentEvents: []
      };
    }

    const [
      totalConsent,
      acceptedConsent,
      declinedConsent,
      totalEvents,
      pageviews,
      clicks,
      topPagesGrouped,
      campaignsGrouped,
      conversionsGrouped,
      recentEvents,
      avgDurationAggr,
    ] = await Promise.all([
      this.prisma.cookieConsentRecord.count(),
      this.prisma.cookieConsentRecord.count({ where: { consent: 'accepted' } }),
      this.prisma.cookieConsentRecord.count({ where: { consent: 'essential_only' } }),
      this.prisma.webAnalyticsEvent.count(),
      this.prisma.webAnalyticsEvent.count({ where: { eventType: 'pageview' } }),
      this.prisma.webAnalyticsEvent.findMany({
        where: { eventType: 'click', clickX: { not: null }, clickY: { not: null } },
        take: 200,
        select: { path: true, clickX: true, clickY: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.webAnalyticsEvent.groupBy({
        by: ['path'],
        where: { eventType: 'pageview' },
        _count: { path: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10
      }),
      this.prisma.webAnalyticsEvent.groupBy({
        by: ['utmSource', 'utmCampaign'],
        where: { utmSource: { not: null } },
        _count: { _all: true, utmSource: true },
        orderBy: { _count: { utmSource: 'desc' } },
        take: 10
      }),
      this.prisma.webAnalyticsEvent.groupBy({
        by: ['utmSource', 'utmCampaign'],
        where: { utmSource: { not: null }, eventType: 'conversion' },
        _count: { _all: true },
      }),
      this.prisma.webAnalyticsEvent.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.webAnalyticsEvent.aggregate({
        where: { duration: { not: null } },
        _avg: { duration: true }
      })
    ]);

    let consentRate = totalConsent > 0 ? Math.round((acceptedConsent / totalConsent) * 100) : 0;
    let avgDurationSeconds = Math.round(avgDurationAggr._avg?.duration || 0);

    const pathTitleMap: Record<string, string> = {
      '/': 'Home Page',
      '/about': 'About Us',
      '/programs': 'Outreach Programs',
      '/impact': 'Impact & Projects',
      '/stories': 'Impact Stories',
      '/volunteer': 'Volunteer & Get Involved',
      '/donate': 'Donate Now',
      '/school-registration': 'School Partnership Registration',
      '/roadmap': 'Project Roadmap',
      '/partnership': 'Partnership Page',
      '/contact': 'Contact Us',
      '/focus-communities': 'Focus Communities',
      '/apply/scholarship': 'Scholarship Application',
      '/blog': 'Blog & Articles',
      '/privacy-policy': 'Privacy Policy',
      '/terms-of-service': 'Terms of Service',
      '/search': 'Search Page'
    };

    const topPages = topPagesGrouped.map((item) => ({
      path: item.path,
      title: pathTitleMap[item.path] || item.path,
      views: item._count.path,
      avgTime: avgDurationSeconds > 0 ? `${Math.floor(avgDurationSeconds / 60)}m ${avgDurationSeconds % 60}s` : '0m 45s'
    }));

    const campaigns = (campaignsGrouped as any[]).map((c: any) => {
      const conv = (conversionsGrouped as any[]).find(
        (cg) => cg.utmSource === c.utmSource && cg.utmCampaign === c.utmCampaign
      );
      const conversionCount = conv ? conv._count._all : 0;
      
      let roi = 'Organic';
      if (c.utmSource && c._count._all > 0) {
        const rate = ((conversionCount / c._count._all) * 100).toFixed(1);
        roi = `${rate}% Rate`;
      }
      
      return {
        name: c.utmCampaign || c.utmSource || 'Direct Organic Search',
        channel: c.utmSource || 'Organic Search',
        clicks: c._count._all,
        conversions: conversionCount,
        roi
      };
    });

    return {
      consent: {
        total: totalConsent,
        accepted: acceptedConsent,
        declined: declinedConsent,
        rate: consentRate,
      },
      traffic: {
        totalEvents: totalEvents,
        pageviews: pageviews,
        avgDurationSeconds: avgDurationSeconds,
        bounceRatePercent: totalEvents > 0 ? Math.round(((totalEvents - pageviews) / Math.max(1, totalEvents)) * 100) : 0,
      },
      heatmaps: clicks,
      campaigns,
      topPages,
      recentEvents
    };
  }

  // --- Community Projects CRUD ---
  async getCommunityProjects(communitySlug?: string) {
    return this.prisma.communityProject.findMany({
      where: communitySlug ? { communitySlug } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCommunityProject(data: any) {
    // Upload cover image if it's base64
    let coverImageUrl: string | null = null;
    if (data.coverImage && data.coverImage.startsWith('data:')) {
      coverImageUrl = await this.uploadToSupabase(data.coverImage, 'project-cover');
    } else if (data.coverImage) {
      coverImageUrl = data.coverImage; // Already a URL
    }

    // Upload extra images if they are base64
    const imageUrls: string[] = [];
    if (Array.isArray(data.images)) {
      for (const img of data.images) {
        if (img && img.startsWith('data:')) {
          const url = await this.uploadToSupabase(img, 'project-photo');
          if (url) imageUrls.push(url);
        } else if (img) {
          imageUrls.push(img); // Already a URL
        }
      }
    }

    return this.prisma.communityProject.create({
      data: {
        title: data.title,
        description: data.description,
        communitySlug: data.communitySlug || 'kumba',
        targetAmount: data.targetAmount ? parseFloat(data.targetAmount) : 500000,
        currentAmount: data.currentAmount ? parseFloat(data.currentAmount) : 0,
        status: data.status || 'In Progress',
        coverImage: coverImageUrl,
        videoUrl: data.videoUrl || null,
        images: imageUrls,
      },
    });
  }

  async updateCommunityProject(id: string, data: any) {
    // Upload cover image if base64
    let coverImage = data.coverImage;
    if (coverImage && coverImage.startsWith('data:')) {
      const url = await this.uploadToSupabase(coverImage, 'project-cover');
      if (url) coverImage = url;
    }

    // Upload extra images if base64
    let images = data.images;
    if (Array.isArray(images)) {
      const uploadedImages: string[] = [];
      for (const img of images) {
        if (img && img.startsWith('data:')) {
          const url = await this.uploadToSupabase(img, 'project-photo');
          if (url) uploadedImages.push(url);
        } else if (img) {
          uploadedImages.push(img);
        }
      }
      images = uploadedImages;
    }

    return this.prisma.communityProject.update({
      where: { id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.communitySlug ? { communitySlug: data.communitySlug } : {}),
        ...(data.targetAmount !== undefined ? { targetAmount: parseFloat(data.targetAmount) } : {}),
        ...(data.currentAmount !== undefined ? { currentAmount: parseFloat(data.currentAmount) } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(coverImage !== undefined ? { coverImage } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(images ? { images } : {}),
      },
    });
  }

  async deleteCommunityProject(id: string) {
    return this.prisma.communityProject.delete({
      where: { id },
    });
  }

  // --- Public Impact Stats CRUD ---
  async getPublicImpactStats() {
    return this.prisma.publicImpactStat.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async createPublicImpactStat(data: any) {
    return this.prisma.publicImpactStat.create({
      data: {
        key: data.key,
        value: data.value,
        label: data.label,
        section: data.section,
        order: parseInt(data.order) || 0,
      }
    });
  }

  async updatePublicImpactStat(id: string, data: any) {
    return this.prisma.publicImpactStat.update({
      where: { id },
      data: {
        ...(data.key && { key: data.key }),
        ...(data.value && { value: data.value }),
        ...(data.label && { label: data.label }),
        ...(data.section && { section: data.section }),
        ...(data.order !== undefined && { order: parseInt(data.order) || 0 }),
      }
    });
  }

  async deletePublicImpactStat(id: string) {
    return this.prisma.publicImpactStat.delete({
      where: { id },
    });
  }
}
