import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';

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

    return this.prisma.marketerTerritory.findMany({
      where: { marketerId: targetMarketerId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
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
    const [reports, goals] = await Promise.all([this.prisma.dailyReport.findMany({
      where: {
        userId: targetMarketerId,
        type: 'FIELD',
        date: { gte: monday, lte: sunday },
      },
    }), this.prisma.goal.findMany({ where: { ownerId: targetMarketerId, scope: 'PERSONAL', status: 'ACTIVE' } })]);

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
        { goal: 'prospecting', label: 'People approached', actual: peopleApproached },
        { goal: 'verified akawo account activations', label: 'Verified accounts', actual: verifiedAccounts },
        { goal: 'landbanking accounts with first payment', label: 'First transactions', actual: firstTransactions },
        { goal: 'customer follow-up within 48 hours', label: 'Follow-ups completed', actual: followUpsCompleted },
        { goal: 'daily field reports and office check-ins', label: 'Daily reports', actual: reports.length },
      ].map((measure) => {
        const assigned = goals.find((goal) => goal.title.trim().toLowerCase() === measure.goal);
        return { label: measure.label, actual: measure.actual, target: assigned ? Math.max(1, Math.ceil(Number(assigned.targetValue || 0) / 4)) : 0, configured: Boolean(assigned) };
      }).filter((measure) => measure.configured),
    };
  }

  async getDailyPlan(user: JwtUser, marketerId?: string) {
    const targetMarketerId = this.isManager(user.role) && marketerId ? marketerId : user.sub;
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [goals, dueLeads, report] = await Promise.all([
      this.prisma.goal.findMany({ where: { ownerId: targetMarketerId, scope: 'PERSONAL', status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
      this.prisma.marketerLead.findMany({
        where: { marketerId: targetMarketerId, followUpDate: { lte: end }, status: { notIn: ['VERIFIED', 'LOST'] } },
        orderBy: { followUpDate: 'asc' }, take: 5,
      }),
      this.prisma.dailyReport.findFirst({ where: { userId: targetMarketerId, type: 'FIELD', date: { gte: start, lte: end } } }),
    ]);

    const elapsedDays = Math.max(1, now.getDate());
    const totalDays = monthEnd.getDate();
    const actions: any[] = dueLeads.map((lead) => ({
      id: `lead-${lead.id}`, source: 'FOLLOW_UP', title: `Follow up with ${lead.prospectName}`,
      description: `${lead.product || 'Product'} · ${lead.zone || 'Unassigned zone'}`, href: '/app/marketer/leads',
    }));

    for (const goal of goals) {
      if (actions.length >= 4) break;
      const target = Number(goal.targetValue || 0);
      const current = Number(goal.currentValue || 0);
      const expected = target * (elapsedDays / totalDays);
      if (target > 0 && current < expected) {
        const dailyNeeded = Math.max(1, Math.ceil((target - current) / Math.max(1, totalDays - elapsedDays + 1)));
        actions.push({ id: `goal-${goal.id}`, source: 'KPI', title: goal.title,
          description: `Complete at least ${dailyNeeded} ${goal.unit || 'units'} today to stay on target.`, href: '/app/marketer/performance' });
      }
    }

    if (!report) actions.push({ id: 'daily-report', source: 'REPORT', title: 'Submit today\'s field report', description: 'Record verified activity and evidence before close of business.', href: '/app/marketer/daily-report' });
    return { date: start.toISOString(), generatedFrom: 'ASSIGNED_KPIS_AND_ACTIVITY', actions: actions.slice(0, 5) };
  }

  async getDailyLeaderboard(user: JwtUser) {
    if (!this.isManager(user.role)) throw new ForbiddenException('Only managers can view the team leaderboard');
    const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const reports = await this.prisma.dailyReport.findMany({
      where: { type: 'FIELD', date: { gte: start, lte: end } },
      include: { user: { select: { id: true, fullName: true, title: true } } },
    });
    return reports.map((report) => {
      let data: any = {}; try { data = JSON.parse(report.content); } catch {}
      const score = Number(data.people || 0) + Number(data.qualified || 0) * 2 + Number(data.followUps || 0) * 2 + Number(data.accounts || 0) * 5 + Number(data.transactions || 0) * 6;
      return { reportId: report.id, marketer: report.user, score, status: report.status, metrics: data };
    }).sort((a, b) => b.score - a.score).map((row, index) => ({ rank: index + 1, ...row }));
  }
}
