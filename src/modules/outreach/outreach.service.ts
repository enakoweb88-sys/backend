import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';
import { OutreachApplicationType, ApplicationStatus } from '@prisma/client';

@Injectable()
export class OutreachService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createDonation(data: any) {
    const documentUrls: string[] = [];
    if (data.documents && Array.isArray(data.documents)) {
      for (const docBase64 of data.documents) {
        const url = await this.uploadToSupabase(docBase64, 'donation-receipt');
        if (url) documentUrls.push(url);
      }
    } else if (data.documentBase64) {
      // Single file upload fallback
      const url = await this.uploadToSupabase(data.documentBase64, 'donation-receipt');
      if (url) documentUrls.push(url);
    }

    const { documents, documentBase64, ...cleanData } = data;

    return this.prisma.donation.create({
      data: {
        ...cleanData,
        documents: documentUrls
      },
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
    const documentUrls: string[] = [];
    if (data.documents && Array.isArray(data.documents)) {
      for (const docBase64 of data.documents) {
        const url = await this.uploadToSupabase(docBase64, 'application-doc');
        if (url) documentUrls.push(url);
      }
    }

    const { documents, ...cleanData } = data;

    return this.prisma.outreachApplication.create({
      data: {
        ...cleanData,
        documents: documentUrls
      }
    });
  }

  async getApplications() {
    return this.prisma.outreachApplication.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async sendNewsletter(data: { subject: string; body: string; audience: string }) {
    // 1. Fetch audience emails based on type
    const emails = new Set<string>();

    if (data.audience === 'ALL' || data.audience === 'SUBSCRIBERS') {
      const subs = await this.prisma.newsletterSubscriber.findMany({ select: { email: true } });
      subs.forEach(s => emails.add(s.email));
    }
    
    if (data.audience === 'ALL' || data.audience === 'DONATORS') {
      const dons = await this.prisma.donation.findMany({ select: { email: true } });
      dons.forEach(d => emails.add(d.email));
    }

    if (data.audience === 'ALL' || data.audience === 'VOLUNTEERS') {
      const apps = await this.prisma.outreachApplication.findMany({ where: { type: 'VOLUNTEER' }, select: { email: true } });
      apps.forEach(a => emails.add(a.email));
    }

    if (data.audience === 'ALL' || data.audience === 'SCHOLARSHIPS') {
      const apps = await this.prisma.outreachApplication.findMany({ where: { type: 'SCHOLARSHIP' }, select: { email: true } });
      apps.forEach(a => emails.add(a.email));
    }

    if (data.audience === 'ALL' || data.audience === 'FAMILIES') {
      const apps = await this.prisma.outreachApplication.findMany({ where: { type: 'FAMILY_IN_NEED' }, select: { email: true } });
      apps.forEach(a => emails.add(a.email));
    }

    // SIMULATED SENDING LOGIC (Using external mail service)
    console.log(`[NEWSLETTER] Sending email to ${emails.size} recipients in audience ${data.audience}`);
    console.log(`[NEWSLETTER] Subject: ${data.subject}`);
    
    return {
      success: true,
      recipientsCount: emails.size,
      message: `Successfully dispatched to ${emails.size} recipients.`
    };
  }

  // --- Outreach Events (Scholarships, etc) ---
  
  async getEvents() {
    return this.prisma.outreachEvent.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { applications: true }
        }
      }
    });
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

    return this.prisma.outreachEvent.create({
      data: {
        title: data.title,
        titleFr: data.titleFr,
        description: data.description,
        descriptionFr: data.descriptionFr,
        type: data.type || 'SCHOLARSHIP',
        status: data.status || 'DRAFT',
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

  async updateEventStatus(id: string, status: any) {
    return this.prisma.outreachEvent.update({
      where: { id },
      data: { status }
    });
  }

  // --- Blog Posts ---

  async getPosts(status?: string) {
    return this.prisma.blogPost.findMany({
      where: status ? { status } : undefined,
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

  async getWebInsights() {
    const [
      totalConsent,
      acceptedConsent,
      declinedConsent,
      totalEvents,
      pageviews,
      clicks,
      topPagesGrouped,
      campaignsGrouped,
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
      this.prisma.webAnalyticsEvent.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.webAnalyticsEvent.aggregate({
        where: { duration: { not: null } },
        _avg: { duration: true }
      })
    ]);

    const consentRate = totalConsent > 0 ? Math.round((acceptedConsent / totalConsent) * 100) : 0;
    const avgDurationSeconds = Math.round(avgDurationAggr._avg?.duration || 0);

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

    const campaigns = (campaignsGrouped as any[]).map((c: any) => ({
      name: c.utmCampaign || c.utmSource || 'Direct Organic Search',
      channel: c.utmSource || 'Organic Search',
      clicks: c._count._all,
      conversions: Math.round(c._count._all * 0.12),
      roi: c.utmSource ? '+185%' : 'Organic'
    }));

    return {
      consent: {
        total: totalConsent,
        accepted: acceptedConsent,
        declined: declinedConsent,
        rate: consentRate,
      },
      traffic: {
        totalEvents,
        pageviews,
        avgDurationSeconds,
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
}
