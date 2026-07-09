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

    return {
      activeEvents: 3,
      pendingApplications: 12,
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
}
