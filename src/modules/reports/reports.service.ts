import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { reportInboxAccess, submissionReviewerRoles, canReviewWorkReport } from './report-workflow';
import { ReportAlertsService } from './report-alerts.service';

const documentMetadata = {
  id: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private readonly alerts: ReportAlertsService,
  ) {}

  private dailyAccess(user: JwtUser) {
    return reportInboxAccess(user);
  }

  async findDaily(id: string, user: JwtUser) {
    const report = await this.prisma.dailyReport.findFirst({
      where: { AND: [{ id }, this.dailyAccess(user)] },
      include: {
        documents: { select: documentMetadata },
        user: { select: { id: true, fullName: true, email: true, role: true } },
        reviewer: {
          select: { id: true, fullName: true, email: true, role: { select: { name: true } } },
        },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async notifyReviewers(
    tx: Prisma.TransactionClient,
    report: { id: string; userId: string; type: string },
    authorRole = 'EMPLOYEE',
  ) {
    const roles = submissionReviewerRoles(authorRole);
    if (!roles.length) return;
    const reviewers = await tx.user.findMany({
      where: { role: { name: { in: roles } }, status: 'ACTIVE', id: { not: report.userId } },
      select: { id: true },
    });
    if (reviewers.length)
      await this.alerts.enqueue(
        tx,
        reviewers.map((reviewer) => ({
          userId: reviewer.id,
          title: 'Staff report submitted',
          body: `A ${report.type.toLowerCase()} work report is awaiting your review.`,
          type: 'INFO' as const,
          link: `/app/reports?reportId=${encodeURIComponent(report.id)}`,
        })),
      );
    await this.alerts.enqueue(tx, [
      {
        userId: report.userId,
        title: 'Report submission received',
        body: ['MANAGER', 'OUTREACH_MANAGER'].includes(authorRole)
          ? 'Your report was submitted to the CEO for review.'
          : 'Your report was submitted to management. You will be notified when it is accepted or returned.',
        link: `/app/reports?reportId=${encodeURIComponent(report.id)}`,
      },
    ]);
  }

  private validateSubmission(
    content: string | undefined,
    type: string | undefined,
    status: string | undefined,
  ) {
    if (content !== undefined && (typeof content !== 'string' || !content.trim()))
      throw new BadRequestException('Report content cannot be empty');
    if (type && !['DAILY', 'WEEKLY', 'MONTHLY', 'FIELD', 'GENERAL'].includes(type))
      throw new BadRequestException('Invalid report type');
    if (status && !['DRAFT', 'SUBMITTED'].includes(status))
      throw new BadRequestException('Reports can only be saved as drafts or submitted for review');
  }

  list() {
    return this.prisma.reportFile.findMany({
      orderBy: { createdAt: 'desc' },
      include: { generator: { select: { fullName: true } } },
    });
  }

  async generate(title: string, type: string, user: JwtUser) {
    let data = '';
    if (title.includes('Financial')) {
      const txs = await this.prisma.transaction.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      });
      data =
        'reference,amount,type,status,createdAt\n' +
        txs
          .map((t) => `${t.reference},${t.amount},${t.type},${t.status},${t.createdAt}`)
          .join('\n');
    } else if (title.includes('Operational')) {
      const users = await this.prisma.user.findMany({ include: { role: true } });
      data =
        'name,email,role,status\n' +
        users.map((u) => `${u.fullName},${u.email},${u.role?.name},${u.status}`).join('\n');
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
        generatedBy: user.sub,
      },
    });
  }

  listDaily(user: JwtUser, queryType?: string) {
    const includeUsers = {
      documents: { select: documentMetadata },
      user: { select: { id: true, fullName: true, email: true, role: true } },
      reviewer: { select: { id: true, fullName: true, email: true, role: true } },
    };

    return this.prisma.dailyReport.findMany({
      where: { AND: [this.dailyAccess(user), queryType ? { type: queryType } : {}] },
      orderBy: { date: 'desc' },
      include: includeUsers,
    });
  }

  async createDaily(
    body: {
      content: string;
      type?: string;
      loginTime?: string;
      logoutTime?: string;
      pdfUrl?: string;
      status?: string;
      attachments?: any;
    },
    user: JwtUser,
  ) {
    this.validateSubmission(body.content, body.type, body.status);
    if (!body.content || body.content.trim().length === 0) {
      throw new BadRequestException(
        'Report content cannot be empty. Please fill in all required fields.',
      );
    }
    const reportType = body.type || 'DAILY';
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const start = new Date(`${day}T00:00:00+01:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    const existing = await this.prisma.dailyReport.findFirst({
      where: { userId: user.sub, type: reportType, date: { gte: start, lte: end } },
    });
    if (existing)
      throw new BadRequestException(
        'You already submitted this report today. Use revise and resubmit instead.',
      );

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.create({
        data: {
          content: body.content,
          type: reportType,
          loginTime: body.loginTime ? new Date(body.loginTime) : null,
          logoutTime: body.logoutTime ? new Date(body.logoutTime) : null,
          pdfUrl: body.pdfUrl,
          status: body.status || 'SUBMITTED',
          attachments: body.attachments || null,
          userId: user.sub,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
          reviewer: { select: { id: true, fullName: true, email: true, role: true } },
        },
      });
      if (reportType === 'FIELD' && report.status !== 'DRAFT') {
        let metrics: any = {};
        try {
          metrics = JSON.parse(body.content);
        } catch {}
        const increments: Record<string, number> = {
          prospecting: Number(metrics.people || 0),
          'verified akawo account activations': Number(metrics.accounts || 0),
          'landbanking accounts with first payment': Number(metrics.transactions || 0),
          'customer follow-up within 48 hours': Number(metrics.followUps || 0),
        };
        const goals = await tx.goal.findMany({
          where: { ownerId: user.sub, scope: 'PERSONAL', status: 'ACTIVE' },
        });
        for (const goal of goals) {
          const amount = Number(
            metrics.kpiResults?.[goal.id] ?? increments[goal.title.trim().toLowerCase()] ?? 0,
          );
          if (amount > 0)
            await tx.goal.update({
              where: { id: goal.id },
              data: { currentValue: { increment: amount } },
            });
        }
      }
      if (report.status === 'SUBMITTED') await this.notifyReviewers(tx, report, user.role);
      return report;
    });
  }

  async updateDaily(
    id: string,
    body: { content?: string; type?: string; status?: string; attachments?: any },
    user: JwtUser,
  ) {
    const existing = await this.prisma.dailyReport.findFirst({ where: { id, userId: user.sub } });
    if (!existing) throw new NotFoundException('Daily report not found.');
    this.validateSubmission(body.content, body.type, body.status);
    if (existing.status === 'VERIFIED')
      throw new BadRequestException(
        'Verified reports cannot be changed. Ask your manager to return the report for correction.',
      );
    if (existing.status !== 'DRAFT' && body.status === 'DRAFT')
      throw new BadRequestException('Submitted reports cannot be made private again');
    if (body.type && body.type !== existing.type)
      throw new BadRequestException('A saved report cannot change its report type');
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
          ...(body.attachments && { attachments: body.attachments }),
        },
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true } },
          reviewer: { select: { id: true, fullName: true, email: true, role: true } },
        },
      });
      if (existing.type === 'FIELD' && body.content && report.status !== 'DRAFT') {
        let before: any = {};
        let after: any = {};
        if (existing.status !== 'DRAFT') {
          try {
            before = JSON.parse(existing.content);
          } catch {}
        }
        try {
          after = JSON.parse(body.content);
        } catch {}
        const keys: Record<string, string> = {
          prospecting: 'people',
          'verified akawo account activations': 'accounts',
          'landbanking accounts with first payment': 'transactions',
          'customer follow-up within 48 hours': 'followUps',
        };
        const goals = await tx.goal.findMany({
          where: { ownerId: user.sub, scope: 'PERSONAL', status: 'ACTIVE' },
        });
        for (const goal of goals) {
          const key = keys[goal.title.trim().toLowerCase()];
          const afterValue = after.kpiResults?.[goal.id] ?? (key ? after[key] : 0);
          const beforeValue = before.kpiResults?.[goal.id] ?? (key ? before[key] : 0);
          const delta = Number(afterValue || 0) - Number(beforeValue || 0);
          if (delta)
            await tx.goal.update({
              where: { id: goal.id },
              data: { currentValue: { increment: delta } },
            });
        }
      }
      if (report.status === 'SUBMITTED') await this.notifyReviewers(tx, report, user.role);
      return report;
    });
  }

  async reviewDaily(
    id: string,
    body: { status: string; reviewerComments?: string },
    user: JwtUser,
  ) {
    if (!['VERIFIED', 'RETURNED'].includes(body.status))
      throw new BadRequestException('Choose verify or return for correction');
    if (user.role !== 'MANAGER' && user.role !== 'OUTREACH_MANAGER' && user.role !== 'CEO') {
      throw new ForbiddenException(
        'Only managers and executives can review and verify field reports.',
      );
    }

    return this.prisma
      .$transaction(async (tx) => {
        const report = await tx.dailyReport.findFirst({
          where: { AND: [{ id }, this.dailyAccess(user)] },
          include: { user: { select: { role: { select: { name: true } } } } },
        });
        if (!report) throw new NotFoundException('Report not found');
        if (report.status === 'DRAFT')
          throw new ForbiddenException('A draft has not been submitted for review');
        if (report.userId === user.sub)
          throw new ForbiddenException('You cannot review your own report');
        if (!canReviewWorkReport(user, report))
          throw new ForbiddenException(
            'Employee reports must be accepted by a manager. The CEO receives accepted reports for viewing and download.',
          );
        if (body.status === 'VERIFIED' && report.status === 'VERIFIED') return report;
        const updated = await tx.dailyReport.update({
          where: { id, status: report.status, updatedAt: report.updatedAt },
          data: {
            status: body.status,
            reviewerComments:
              body.reviewerComments !== undefined ? body.reviewerComments : report.reviewerComments,
            reviewerId: user.sub,
            reviewedAt: new Date(),
          },
          include: {
            documents: { select: documentMetadata },
            user: { select: { id: true, fullName: true, email: true, role: true } },
            reviewer: { select: { id: true, fullName: true, email: true, role: true } },
          },
        });
        if (body.status === 'VERIFIED' && user.role !== 'CEO') {
          const executives = await tx.user.findMany({
            where: { role: { name: { in: ['CEO'] } }, status: 'ACTIVE' },
            select: { id: true },
          });
          if (executives.length)
            await this.alerts.enqueue(
              tx,
              executives.map((executive) => ({
                userId: executive.id,
                title: 'Manager-approved report forwarded',
                body: 'A staff report was accepted by management and is ready to view or download.',
                type: 'INFO' as const,
                link: '/app/reports?reportId=' + encodeURIComponent(id),
              })),
            );
        }
        await this.alerts.enqueue(tx, [
          {
            userId: report.userId,
            title:
              body.status === 'VERIFIED' ? 'Report accepted' : 'Report returned for correction',
            body:
              body.status === 'VERIFIED'
                ? user.role === 'CEO'
                  ? 'Your report has been accepted by the CEO.'
                  : 'Your report was accepted by your manager and forwarded to the CEO.'
                : body.reviewerComments ||
                  'Please revise your report and resubmit it to management.',
            type: 'INFO' as const,
            link: '/app/reports?reportId=' + encodeURIComponent(id),
          },
        ]);
        return updated;
      })
      .catch((error: unknown) => {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025')
          throw new BadRequestException('This report changed. Reload it before reviewing.');
        throw error;
      });
  }
}
