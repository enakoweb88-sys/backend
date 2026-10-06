import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateCashCollectionDto, QueryDto, UpdateCashCollectionStatusDto } from '../../common/dtos';
import { JwtUser } from '../../common/current-user.decorator';
import { CashCollectionStatus, Prisma } from '@prisma/client';

@Injectable()
export class CashCollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async list(query: QueryDto & { status?: string; collectorId?: string }, user?: JwtUser) {
    try {
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 25);
      const skip = (page - 1) * limit;

      const where: Prisma.CashCollectionWhereInput = {};

      if (query.search) {
        where.OR = [
          { clientName: { contains: query.search, mode: 'insensitive' } },
          { location: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { collector: { fullName: { contains: query.search, mode: 'insensitive' } } },
        ];
      }

      if (query.status && ['COMPLETE', 'PENDING', 'CANCELLED'].includes(query.status.toUpperCase())) {
        where.status = query.status.toUpperCase() as CashCollectionStatus;
      }

      if (query.collectorId) {
        where.collectorId = query.collectorId;
      }

      const [items, total] = await Promise.all([
        this.prisma.cashCollection.findMany({
          where,
          skip,
          take: limit,
          orderBy: { collectionTime: 'desc' },
          include: {
            collector: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        }),
        this.prisma.cashCollection.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (err) {
      console.error('Error fetching cash collections:', err);
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      };
    }
  }

  async findOne(id: string) {
    const item = await this.prisma.cashCollection.findUnique({
      where: { id },
      include: {
        collector: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: { select: { name: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Cash collection record not found');
    return item;
  }

  async create(dto: CreateCashCollectionDto, user?: JwtUser, receiptUrl?: string) {
    const collectionTime = dto.collectionTime ? new Date(dto.collectionTime) : new Date();
    const status = (dto.status?.toUpperCase() as CashCollectionStatus) || CashCollectionStatus.PENDING;

    let collectorId = user?.sub;
    if (!collectorId) {
      const defaultUser = await this.prisma.user.findFirst({
        where: { email: { contains: 'collector', mode: 'insensitive' } }
      }) || await this.prisma.user.findFirst();

      if (defaultUser) {
        collectorId = defaultUser.id;
      } else {
        const defaultRole = await this.prisma.role.findFirst();
        let roleId = defaultRole?.id;
        if (!roleId) {
          const newRole = await this.prisma.role.create({ data: { name: 'EMPLOYEE' } });
          roleId = newRole.id;
        }

        const createdUser = await this.prisma.user.create({
          data: {
            fullName: 'Field Cash Collector',
            email: 'collector@enako.cm',
            passwordHash: 'default-field-collector-hash',
            roleId,
          }
        });
        collectorId = createdUser.id;
      }
    }

    const created = await this.prisma.cashCollection.create({
      data: {
        collectorId,
        clientName: dto.clientName,
        location: dto.location,
        amountCollected: dto.amountCollected,
        outstandingBalance: dto.outstandingBalance ?? 0,
        currency: dto.currency || 'XAF',
        collectionTime,
        status,
        description: dto.description,
        receiptUrl: receiptUrl || dto.receiptUrl,
      },
      include: {
        collector: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Send collection receipt email if client email is provided or discovered
    let clientEmail: string | undefined;
    try {
      if (dto.description && dto.description.startsWith('{')) {
        const parsed = JSON.parse(dto.description);
        clientEmail = parsed.clientEmail;
      }
    } catch (e) {}

    if (!clientEmail) {
      const clientUser = await this.prisma.user.findFirst({
        where: { fullName: { contains: dto.clientName, mode: 'insensitive' } }
      });
      if (clientUser && clientUser.email) clientEmail = clientUser.email;
    }

    if (clientEmail && clientEmail.includes('@')) {
      this.mail.sendCollectionReceiptAlert({
        toEmail: clientEmail,
        clientName: dto.clientName,
        collectionId: created.id,
        amount: Number(dto.amountCollected),
        currency: dto.currency || 'FCFA',
        collectorName: created.collector?.fullName || 'Field Cash Collector',
        location: dto.location,
        status: created.status,
      }).catch(err => console.warn('Outbound receipt email notice:', err?.message || err));
    }

    return created;
  }

  async updateStatus(id: string, dto: UpdateCashCollectionStatusDto) {
    await this.findOne(id);
    const updated = await this.prisma.cashCollection.update({
      where: { id },
      data: {
        status: dto.status.toUpperCase() as CashCollectionStatus,
      },
      include: {
        collector: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (updated.status === 'COMPLETE') {
      let clientEmail: string | undefined;
      try {
        if (updated.description && updated.description.startsWith('{')) {
          const parsed = JSON.parse(updated.description);
          clientEmail = parsed.clientEmail;
        }
      } catch (e) {}

      if (!clientEmail) {
        const clientUser = await this.prisma.user.findFirst({
          where: { fullName: { contains: updated.clientName, mode: 'insensitive' } }
        });
        if (clientUser && clientUser.email) clientEmail = clientUser.email;
      }

      if (clientEmail && clientEmail.includes('@')) {
        this.mail.sendCollectionSettledAlert({
          toEmail: clientEmail,
          clientName: updated.clientName,
          collectionId: updated.id,
          amount: Number(updated.amountCollected),
          currency: updated.currency || 'FCFA',
          collectorName: updated.collector?.fullName,
          location: updated.location,
        }).catch(err => console.warn('Outbound settlement email notice:', err?.message || err));
      }
    }

    return updated;
  }

  async sendReceiptEmail(body: {
    toEmail: string;
    clientName: string;
    collectionId: string;
    amount: number;
    currency?: string;
    collectorName?: string;
    location?: string;
    status?: string;
    time?: string;
    depositDestination?: string;
    pdfBase64?: string;
  }) {
    return this.mail.sendCollectionReceiptAlert(body);
  }

  async getStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayAgg, pendingAgg, totalAgg, recentCount] = await Promise.all([
        this.prisma.cashCollection.aggregate({
          _sum: { amountCollected: true },
          _count: true,
          where: {
            collectionTime: { gte: today },
            status: CashCollectionStatus.COMPLETE,
          },
        }),
        this.prisma.cashCollection.aggregate({
          _sum: { amountCollected: true },
          _count: true,
          where: {
            status: CashCollectionStatus.PENDING,
          },
        }),
        this.prisma.cashCollection.aggregate({
          _sum: { amountCollected: true, outstandingBalance: true },
          _count: true,
        }),
        this.prisma.cashCollection.count({
          where: { collectionTime: { gte: today } },
        }),
      ]);

      return {
        todayCollected: todayAgg._sum.amountCollected || 0,
        todayCount: todayAgg._count || 0,
        pendingAmount: pendingAgg._sum.amountCollected || 0,
        pendingCount: pendingAgg._count || 0,
        totalCollected: totalAgg._sum.amountCollected || 0,
        totalOutstanding: totalAgg._sum.outstandingBalance || 0,
        totalRecords: totalAgg._count || 0,
      };
    } catch (err) {
      console.error('Error getting cash collection stats:', err);
      return {
        todayCollected: 0,
        todayCount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        totalRecords: 0,
      };
    }
  }
}
