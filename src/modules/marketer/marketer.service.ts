import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';

const FIELD_MARKETER_TEMPLATE = [
  { title: 'Prospecting', description: 'Contact 200 new prospects monthly (about 10 daily). Count only verified app downloads and prospects.', targetValue: 200, unit: 'verified prospects' },
  { title: 'Verified Akawo account activations', description: 'Achieve 40 verified Akawo accounts created in the month.', targetValue: 40, unit: 'verified accounts' },
  { title: 'Landbanking accounts with first payment', description: 'Achieve 20 Landbanking accounts funded with a first payment.', targetValue: 20, unit: 'funded accounts' },
  { title: 'Customer follow-up within 48 hours', description: 'Follow up with 20 interested prospects within 48 hours.', targetValue: 20, unit: 'follow-ups' },
  { title: 'Customer retention: second payment within 30 days', description: 'At least 60% of newly activated customers make a confirmed second payment within 30 days.', targetValue: 60, unit: '%' },
  { title: 'Daily field reports and office check-ins', description: 'Submit daily field reports and attend the required twice-weekly office check-ins.', targetValue: 100, unit: '%' },
  { title: 'Conduct and attendance', description: 'Maintain punctuality, accurate customer information, and compliance with company procedures.', targetValue: 100, unit: '%' },
];

const DEFAULT_TERRITORY = [
  { zoneName: 'Bonassama', region: 'Bonaberi', targetAudience: 'Retail shops and services', schedule: 'Morning | Prospecting' },
  { zoneName: 'Mambanda', region: 'Bonaberi', targetAudience: 'Traders and communities', schedule: 'Midday | Demonstrations' },
  { zoneName: 'Ndobo', region: 'Bonaberi', targetAudience: 'Scheduled prospect follow-ups', schedule: 'Afternoon | Activation support' },
];

@Injectable()
export class MarketerService {
  constructor(private readonly prisma: PrismaService) {}

  private isManager(role: string): boolean {
    return role === 'CEO' || role === 'MANAGER' || role === 'OUTREACH_MANAGER';
  }

  // ──────────────────────────── LEADS ────────────────────────────

  async listLeads(user: JwtUser, query?: { status?: string; zone?: string; marketerId?: string }) {
    const isMgr = this.isManager(user.role);
    const targetMarketerId = isMgr && query?.marketerId ? query.marketerId : isMgr ? undefined : user.sub;

    const where: any = {};
    if (targetMarketerId) where.marketerId = targetMarketerId;
    if (query?.status) where.status = query.status;
    if (query?.zone) where.zone = { contains: query.zone, mode: 'insensitive' };

    const leads = await this.prisma.marketerLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        marketer: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    // If marketer has 0 leads yet, seed starter sample leads so the register is immediately functional
    if (leads.length === 0 && !isMgr) {
      await this.prisma.marketerLead.createMany({
        data: [
          {
            marketerId: user.sub,
            prospectName: 'Bonaberi Central Market Vendors',
            phone: '+237 670 11 22 33',
            zone: 'Bonassama',
            product: 'Akawo / Savings',
            status: 'FOLLOW_UP_DUE',
            nextAction: 'Explain account setup and daily savings',
            notes: 'Interested in daily Akawo collection for market traders.',
            contactPermission: true,
            followUpDate: new Date(Date.now() + 86400000 * 2),
            evidenceRef: null,
          },
          {
            marketerId: user.sub,
            prospectName: 'Mambanda Youth Cooperative',
            phone: '+237 691 44 55 66',
            zone: 'Mambanda',
            product: 'Njangi',
            status: 'NEW_LEAD',
            nextAction: 'Arrange group product demonstration',
            notes: 'Group of 15 members looking for automated digital Njangi.',
            contactPermission: true,
            followUpDate: new Date(Date.now() + 86400000 * 4),
            evidenceRef: null,
          },
          {
            marketerId: user.sub,
            prospectName: 'Ndobo Commercial Center',
            phone: '+237 655 77 88 99',
            zone: 'Ndobo',
            product: 'Land Banking',
            status: 'ACCOUNT_OPENED',
            nextAction: 'Verify account reference and initial deposit',
            notes: 'Opened land banking plan; awaiting payment confirmation.',
            contactPermission: true,
            followUpDate: new Date(),
            outcome: 'Account opened successfully',
            evidenceRef: 'ACC-LB-2026-081',
          },
        ],
      });

      return this.prisma.marketerLead.findMany({
        where: { marketerId: user.sub },
        orderBy: { createdAt: 'desc' },
        include: {
          marketer: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      });
    }

    return leads;
  }

  async createLead(
    dto: {
      prospectName: string;
      phone?: string;
      zone?: string;
      product?: string;
      status?: string;
      notes?: string;
      nextAction?: string;
      contactPermission?: boolean;
      followUpDate?: string;
      outcome?: string;
      evidenceRef?: string;
      marketerId?: string;
    },
    user: JwtUser,
  ) {
    if (!dto.prospectName || !dto.prospectName.trim()) {
      throw new BadRequestException('Prospect name is required');
    }

    const assignedMarketerId = this.isManager(user.role) && dto.marketerId ? dto.marketerId : user.sub;

    return this.prisma.marketerLead.create({
      data: {
        marketerId: assignedMarketerId,
        prospectName: dto.prospectName.trim(),
        phone: dto.phone?.trim() || null,
        zone: dto.zone?.trim() || 'Bonaberi',
        product: dto.product?.trim() || 'Akawo / Savings',
        status: dto.status || 'NEW_LEAD',
        notes: dto.notes?.trim() || null,
        nextAction: dto.nextAction?.trim() || null,
        contactPermission: dto.contactPermission !== undefined ? Boolean(dto.contactPermission) : true,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        outcome: dto.outcome?.trim() || null,
        evidenceRef: dto.evidenceRef?.trim() || null,
      },
      include: {
        marketer: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async updateLead(id: string, dto: any, user: JwtUser) {
    const existing = await this.prisma.marketerLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead not found');

    if (!this.isManager(user.role) && existing.marketerId !== user.sub) {
      throw new ForbiddenException('You can only update your own leads');
    }

    return this.prisma.marketerLead.update({
      where: { id },
      data: {
        ...(dto.prospectName && { prospectName: dto.prospectName.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone?.trim() || null }),
        ...(dto.zone !== undefined && { zone: dto.zone?.trim() || null }),
        ...(dto.product !== undefined && { product: dto.product?.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
        ...(dto.nextAction !== undefined && { nextAction: dto.nextAction?.trim() || null }),
        ...(dto.contactPermission !== undefined && { contactPermission: Boolean(dto.contactPermission) }),
        ...(dto.followUpDate !== undefined && { followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome?.trim() || null }),
        ...(dto.evidenceRef !== undefined && { evidenceRef: dto.evidenceRef?.trim() || null }),
      },
      include: {
        marketer: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async deleteLead(id: string, user: JwtUser) {
    const existing = await this.prisma.marketerLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lead not found');

    if (!this.isManager(user.role) && existing.marketerId !== user.sub) {
      throw new ForbiddenException('You can only delete your own leads');
    }

    return this.prisma.marketerLead.delete({ where: { id } });
  }

  // ──────────────────────────── TERRITORY ────────────────────────────

  async getTerritory(user: JwtUser, marketerId?: string) {
    const isMgr = this.isManager(user.role);
    const targetMarketerId = isMgr && marketerId ? marketerId : user.sub;

    let territories = await this.prisma.marketerTerritory.findMany({
      where: { marketerId: targetMarketerId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (territories.length === 0) {
      // Auto-assign default Bonaberi territory layout for this marketer
      await this.prisma.marketerTerritory.createMany({
        data: DEFAULT_TERRITORY.map((item) => ({
          ...item,
          marketerId: targetMarketerId,
        })),
      });

      territories = await this.prisma.marketerTerritory.findMany({
        where: { marketerId: targetMarketerId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    return territories;
  }

  async assignTerritory(
    dto: {
      marketerId: string;
      zones: { zoneName: string; region?: string; targetAudience?: string; schedule?: string }[];
    },
    user: JwtUser,
  ) {
    if (!this.isManager(user.role)) {
      throw new ForbiddenException('Only managers can reassign marketer territories');
    }

    if (!dto.marketerId || !Array.isArray(dto.zones) || dto.zones.length === 0) {
      throw new BadRequestException('A valid marketerId and list of zones are required');
    }

    // Set existing territories for this marketer to inactive
    await this.prisma.marketerTerritory.updateMany({
      where: { marketerId: dto.marketerId },
      data: { isActive: false },
    });

    // Create new zones
    await this.prisma.marketerTerritory.createMany({
      data: dto.zones.map((z) => ({
        marketerId: dto.marketerId,
        zoneName: z.zoneName,
        region: z.region || 'Bonaberi',
        targetAudience: z.targetAudience || null,
        schedule: z.schedule || null,
        isActive: true,
      })),
    });

    return this.prisma.marketerTerritory.findMany({
      where: { marketerId: dto.marketerId, isActive: true },
    });
  }

  // ──────────────────────────── WEEKLY SCORECARD ────────────────────────────

  async getScorecard(user: JwtUser, marketerId?: string) {
    const isMgr = this.isManager(user.role);
    const targetMarketerId = isMgr && marketerId ? marketerId : user.sub;

    // Calculate current Monday 00:00:00 to Sunday 23:59:59
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Fetch FIELD reports submitted by marketer this week
    const reports = await this.prisma.dailyReport.findMany({
      where: {
        userId: targetMarketerId,
        type: 'FIELD',
        date: { gte: monday, lte: sunday },
      },
    });

    let peopleApproached = 0;
    let qualifiedProspects = 0;
    let verifiedAccounts = 0;
    let firstTransactions = 0;
    let followUpsCompleted = 0;

    for (const report of reports) {
      try {
        const parsed = JSON.parse(report.content);
        if (parsed) {
          peopleApproached += Number(parsed.people || 0) || 0;
          qualifiedProspects += Number(parsed.qualified || 0) || 0;
          verifiedAccounts += Number(parsed.accounts || 0) || 0;
          firstTransactions += Number(parsed.transactions || 0) || 0;
          followUpsCompleted += Number(parsed.followUps || 0) || 0;
        }
      } catch {
        // Fallback if content was not JSON
      }
    }

    // Also check verified accounts or leads created this week in marketer_leads
    const leadsThisWeek = await this.prisma.marketerLead.findMany({
      where: {
        marketerId: targetMarketerId,
        createdAt: { gte: monday, lte: sunday },
      },
    });

    // If report numbers are 0 yet (e.g. at beginning of week), also incorporate lead table activity
    if (peopleApproached === 0 && leadsThisWeek.length > 0) {
      peopleApproached = leadsThisWeek.length;
      qualifiedProspects = leadsThisWeek.filter((l) => l.status !== 'LOST').length;
      verifiedAccounts = leadsThisWeek.filter((l) => l.status === 'ACCOUNT_OPENED' || l.status === 'VERIFIED').length;
      firstTransactions = leadsThisWeek.filter((l) => Boolean(l.evidenceRef)).length;
      followUpsCompleted = leadsThisWeek.filter((l) => Boolean(l.outcome)).length;
    }

    return {
      weekRange: {
        start: monday.toISOString(),
        end: sunday.toISOString(),
      },
      reportsSubmitted: reports.length,
      measures: [
        { label: 'People approached', actual: peopleApproached, target: 100 },
        { label: 'Qualified prospects', actual: qualifiedProspects, target: 40 },
        { label: 'Verified accounts', actual: verifiedAccounts, target: 15 },
        { label: 'First transactions', actual: firstTransactions, target: 8 },
        { label: 'Follow-ups completed', actual: followUpsCompleted, target: 25 },
        { label: 'Daily reports', actual: reports.length, target: 5 },
      ],
    };
  }

  // ──────────────────────────── KPI GOALS AUTO-PROVISION ────────────────────────────

  async ensureMarketerKpis(user: JwtUser) {
    const existing = await this.prisma.goal.findMany({
      where: { ownerId: user.sub, scope: 'PERSONAL' },
      select: { title: true },
    });

    const existingTitles = new Set(existing.map((g) => g.title.trim().toLowerCase()));
    const missing = FIELD_MARKETER_TEMPLATE.filter((g) => !existingTitles.has(g.title.toLowerCase()));

    if (missing.length > 0) {
      await this.prisma.goal.createMany({
        data: missing.map((goal) => ({
          ...goal,
          currentValue: 0,
          scope: 'PERSONAL',
          ownerId: user.sub,
        })),
      });
    }

    return this.prisma.goal.findMany({
      where: { ownerId: user.sub, scope: 'PERSONAL' },
      orderBy: { createdAt: 'asc' },
    });
  }
}
