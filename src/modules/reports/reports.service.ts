import { Injectable } from '@nestjs/common';
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
  listDaily(user: JwtUser) {
    if (user.role === 'CEO') {
      return this.prisma.dailyReport.findMany({
        where: { type: 'GENERAL' },
        orderBy: { date: 'desc' },
        include: { user: { select: { fullName: true, email: true, role: true } } }
      });
    }

    if (user.role === 'MANAGER' || user.role === 'OUTREACH_MANAGER') {
      return this.prisma.dailyReport.findMany({
        where: {
          OR: [
            { type: 'DAILY' },
            { userId: user.sub }
          ]
        },
        orderBy: { date: 'desc' },
        include: { user: { select: { fullName: true, email: true, role: true } } }
      });
    }

    // Default to employee
    return this.prisma.dailyReport.findMany({
      where: { userId: user.sub },
      orderBy: { date: 'desc' },
      include: { user: { select: { fullName: true, email: true, role: true } } }
    });
  }

  createDaily(body: { content: string; type?: string; loginTime?: string; logoutTime?: string; pdfUrl?: string }, user: JwtUser) {
    return this.prisma.dailyReport.create({
      data: {
        content: body.content,
        type: body.type || 'DAILY',
        loginTime: body.loginTime ? new Date(body.loginTime) : null,
        logoutTime: body.logoutTime ? new Date(body.logoutTime) : null,
        pdfUrl: body.pdfUrl,
        userId: user.sub
      }
    });
  }
}
