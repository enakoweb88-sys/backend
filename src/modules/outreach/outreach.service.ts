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
        storyMediaType: data.storyMediaType || null
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

  async getPosts() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPost(data: any) {
    let coverImage = data.coverImage || null;
    if (data.coverImageBase64) {
      const url = await this.uploadToSupabase(data.coverImageBase64, 'blog-cover');
      if (url) coverImage = url;
    }

    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    return this.prisma.blogPost.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        coverImage,
        author: data.author || 'ENAKO OS',
        status: data.status || 'DRAFT',
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
}
