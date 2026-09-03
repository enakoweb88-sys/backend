import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashCollectionDto, QueryDto, UpdateCashCollectionStatusDto } from '../../common/dtos';
import { JwtUser } from '../../common/current-user.decorator';
import { CashCollectionStatus, Prisma } from '@prisma/client';

@Injectable()
export class CashCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto & { status?: string; collectorId?: string }, user: JwtUser) {
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

    return this.prisma.cashCollection.create({
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
  }

  async updateStatus(id: string, dto: UpdateCashCollectionStatusDto) {
    await this.findOne(id);
    return this.prisma.cashCollection.update({
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
  }

  async getStats() {
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
  }
}
