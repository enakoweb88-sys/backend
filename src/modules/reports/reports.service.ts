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

  createDaily(body: { content: string; type?: string; loginTime?: string; logoutTime?: string; pdfUrl?: string; status?: string; attachments?: any }, user: JwtUser) {
    if (!body.content || body.content.trim().length === 0) {
      throw new BadRequestException('Report content cannot be empty. Please fill in all required fields.');
    }
    return this.prisma.dailyReport.create({
      data: {
        content: body.content,
        type: body.type || 'DAILY',
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
      }
    });
  }

  updateDaily(id: string, body: { content?: string; type?: string; status?: string; attachments?: any }, user: JwtUser) {
    return this.prisma.dailyReport.update({
      where: { id, userId: user.sub },
      data: {
        ...(body.content && { content: body.content }),
        ...(body.type && { type: body.type }),
        ...(body.status && { status: body.status }),
        ...(body.attachments && { attachments: body.attachments })
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: true } },
        reviewer: { select: { id: true, fullName: true, email: true, role: true } }
      }
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
