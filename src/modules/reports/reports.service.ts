import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.reportFile.findMany({
      orderBy: { createdAt: 'desc' },
      include: { generator: { select: { fullName: true } } }
    });
  }

  async generate(title: string, type: string, user: JwtUser) {
    let data = '';
    if (title.includes('Financial')) {
      const txs = await this.prisma.transaction.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
      data = 'reference,amount,type,status,createdAt\n' + txs.map(t => `${t.reference},${t.amount},${t.type},${t.status},${t.createdAt}`).join('\n');
    } else if (title.includes('Operational')) {
      const users = await this.prisma.user.findMany({ include: { role: true } });
      data = 'name,email,role,status\n' + users.map(u => `${u.fullName},${u.email},${u.role?.name},${u.status}`).join('\n');
    } else {
      data = 'Data Export\nNo specific raw data mapped for this category.';
    }

    const size = Buffer.byteLength(data, 'utf8');
    const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`;
    let outType = 'PDF';
    if (type.includes('CSV')) outType = 'CSV';
    if (type.includes('XLSX')) outType = 'XLSX';

    return this.prisma.reportFile.create({
      data: {
        title,
        type: outType,
        size: sizeStr,
        data,
        generatedBy: user.sub
      }
    });
  }

  listDaily(user: JwtUser, queryType?: string) {
    const includeUsers = {
      user: { select: { id: true, fullName: true, email: true, role: true } },
      reviewer: { select: { id: true, fullName: true, email: true, role: true } }
    };

    if (user.role === 'CEO') {
      return this.prisma.dailyReport.findMany({
        where: queryType ? { type: queryType } : undefined,
        orderBy: { date: 'desc' },
        include: includeUsers
      });
    }

    if (user.role === 'MANAGER' || user.role === 'OUTREACH_MANAGER') {
      return this.prisma.dailyReport.findMany({
        where: queryType
          ? { type: queryType }
          : {
              OR: [
                { type: { in: ['DAILY', 'WEEKLY', 'FIELD'] } },
                { userId: user.sub }
              ]
            },
        orderBy: { date: 'desc' },
        include: includeUsers
      });
    }

    // Default to employee
    return this.prisma.dailyReport.findMany({
      where: {
        userId: user.sub,
        ...(queryType ? { type: queryType } : {})
      },
      orderBy: { date: 'desc' },
      include: includeUsers
    });
  }

  async createDaily(body: { content: string; type?: string; loginTime?: string; logoutTime?: string; pdfUrl?: string; status?: string; attachments?: any }, user: JwtUser) {
    if (!body.content || body.content.trim().length === 0) {
      throw new BadRequestException('Report content cannot be empty. Please fill in all required fields.');
    }
    const reportType = body.type || 'DAILY';
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const existing = await this.prisma.dailyReport.findFirst({ where: { userId: user.sub, type: reportType, date: { gte: start, lte: end } } });
    if (existing) throw new BadRequestException('You already submitted this report today. Use revise and resubmit instead.');

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.create({ data: {
        content: body.content,
        type: reportType,
        loginTime: body.loginTime ? new Date(body.loginTime) : null,
        logoutTime: body.logoutTime ? new Date(body.logoutTime) : null,
        pdfUrl: body.pdfUrl,
        status: body.status || 'SUBMITTED',
        attachments: body.attachments || null,
        userId: user.sub
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        reviewer: { select: { id: true, fullName: true, email: true, role: true } }
      }});
      if (reportType === 'FIELD') {
        let metrics: any = {}; try { metrics = JSON.parse(body.content); } catch {}
        const increments: Record<string, number> = {
          'prospecting': Number(metrics.people || 0),
          'verified akawo account activations': Number(metrics.accounts || 0),
          'landbanking accounts with first payment': Number(metrics.transactions || 0),
          'customer follow-up within 48 hours': Number(metrics.followUps || 0),
        };
        const goals = await tx.goal.findMany({ where: { ownerId: user.sub, scope: 'PERSONAL', status: 'ACTIVE' } });
        for (const goal of goals) {
          const amount = Number(metrics.kpiResults?.[goal.id] ?? increments[goal.title.trim().toLowerCase()] ?? 0);
          if (amount > 0) await tx.goal.update({ where: { id: goal.id }, data: { currentValue: { increment: amount } } });
        }
      }
      return report;
    });
  }

  async updateDaily(id: string, body: { content?: string; type?: string; status?: string; attachments?: any }, user: JwtUser) {
    const existing = await this.prisma.dailyReport.findFirst({ where: { id, userId: user.sub } });
    if (!existing) throw new NotFoundException('Daily report not found.');
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.update({
      where: { id },
      data: {
        ...(body.content && { content: body.content }),
        ...(body.type && { type: body.type }),
        status: body.status || 'SUBMITTED',
        reviewerComments: null,
        reviewerId: null,
        reviewedAt: null,
        ...(body.attachments && { attachments: body.attachments })
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        reviewer: { select: { id: true, fullName: true, email: true, role: true } }
      }});
      if (existing.type === 'FIELD' && body.content) {
        let before: any = {}; let after: any = {};
        try { before = JSON.parse(existing.content); } catch {}
        try { after = JSON.parse(body.content); } catch {}
        const keys: Record<string, string> = { prospecting: 'people', 'verified akawo account activations': 'accounts', 'landbanking accounts with first payment': 'transactions', 'customer follow-up within 48 hours': 'followUps' };
        const goals = await tx.goal.findMany({ where: { ownerId: user.sub, scope: 'PERSONAL', status: 'ACTIVE' } });
        for (const goal of goals) {
          const key = keys[goal.title.trim().toLowerCase()];
          const afterValue = after.kpiResults?.[goal.id] ?? (key ? after[key] : 0);
          const beforeValue = before.kpiResults?.[goal.id] ?? (key ? before[key] : 0);
          const delta = Number(afterValue || 0) - Number(beforeValue || 0);
          if (delta) await tx.goal.update({ where: { id: goal.id }, data: { currentValue: { increment: delta } } });
        }
      }
      return report;
    });
  }

  async reviewDaily(id: string, body: { status: string; reviewerComments?: string }, user: JwtUser) {
    if (user.role !== 'MANAGER' && user.role !== 'OUTREACH_MANAGER' && user.role !== 'CEO') {
      throw new ForbiddenException('Only managers and executives can review and verify field reports.');
    }

    const report = await this.prisma.dailyReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException('Daily report not found.');
    }

    return this.prisma.dailyReport.update({
      where: { id },
      data: {
        status: body.status,
        reviewerComments: body.reviewerComments !== undefined ? body.reviewerComments : report.reviewerComments,
        reviewerId: user.sub,
        reviewedAt: new Date()
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        reviewer: { select: { id: true, fullName: true, email: true, role: true } }
      }
    });
  }
}
