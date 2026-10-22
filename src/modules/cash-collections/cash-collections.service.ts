import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  ) { }

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
        id: dto.id || undefined,
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
    let clientEmail: string-undefined;
    try {
      if (dto.description && dto.description.startsWith('{')) {
        const parsed = JSON.parse(dto.description);
        clientEmail = parsed.clientEmail;
      }
    } catch (e) { }

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
    let existing = await this.prisma.cashCollection.findUnique({ where: { id } });
    if (!existing) {
      existing = await this.prisma.cashCollection.findFirst({
        where: {
          OR: [
            { id },
            { description: { contains: id } },
          ],
        },
      });
    }
    if (!existing) throw new NotFoundException(`Cash collection #${id} not found`);

    const updated = await this.prisma.cashCollection.update({
      where: { id: existing.id },
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
      let clientEmail: string-undefined;
      try {
        if (updated.description && updated.description.startsWith('{')) {
          const parsed = JSON.parse(updated.description);
          clientEmail = parsed.clientEmail;
        }
      } catch (e) { }

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

  async listCollectors() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          AND: [
            { email: { not: 'ceo@enako.com' } },
            { role: { name: { notIn: ['CEO', 'MANAGER'] } } },
            {
              OR: [
                { title: { contains: 'Collector', mode: 'insensitive' } },
                { responsibilities: { contains: 'terminalId', mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          title: true,
          address: true,
          responsibilities: true,
          createdAt: true,
          role: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return users.map((u) => {
        let meta: any = {};
        try {
          if (u.responsibilities && u.responsibilities.startsWith('{')) {
            meta = JSON.parse(u.responsibilities);
          }
        } catch { }

        const names = (u.fullName || '').trim().split(' ');
        const firstName = names[0] || 'Collector';
        const lastName = names.slice(1).join(' ') || '';

        return {
          id: u.id,
          firstName,
          lastName,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone || meta.phone || '',
          branch: u.address || meta.branch || 'Douala Main Hub',
          role: meta.role || u.title || 'Field Cash Collector',
          terminalId: meta.terminalId || `TRM-${u.id.slice(-4).toUpperCase()}`,
          password: meta.password || '123456',
          status: 'ACTIVE',
          createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
        };
      });
    } catch (err) {
      console.error('Error fetching collectors:', err);
      return [];
    }
  }

  async listClients() {
    const clients = await this.prisma.cashClient.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((client) => ({
      ...client,
      outstandingBalance: Number(client.outstandingBalance),
    }));
  }

  async createClient(data: {
    id: string;
    name: string;
    address: string;
    region?: string;
    phone?: string;
    email?: string;
    outstandingBalance?: number;
    lastVisit?: string;
  }) {
    const id = data.id?.trim();
    const name = data.name?.trim();
    const address = data.address?.trim();
    if (!id || !name || !address) {
      throw new BadRequestException('Client ID, name, and address are required');
    }

    const client = await this.prisma.cashClient.upsert({
      where: { id },
      create: {
        id,
        name,
        address,
        region: data.region?.trim() || 'Cameroon',
        phone: data.phone?.trim() || null,
        email: data.email?.trim().toLowerCase() || null,
        outstandingBalance: data.outstandingBalance || 0,
        lastVisit: data.lastVisit || 'Never',
      },
      update: {},
    });

    return {
      ...client,
      outstandingBalance: Number(client.outstandingBalance),
    };
  }

  async deleteCollector(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!user) {
        return { success: true, message: 'Collector not found or already deleted' };
      }
      if (user.role?.name === 'CEO' || user.email === 'ceo@enako.com') {
        throw new Error('Cannot delete administrative executive account');
      }

      await this.prisma.cashCollection.deleteMany({
        where: { collectorId: id },
      });

      await this.prisma.user.delete({
        where: { id },
      });

      return { success: true, message: 'Collector and their collection history deleted successfully' };
    } catch (err) {
      console.error('Error deleting collector:', err);
      throw err;
    }
  }

  async deleteAllCollectors() {
    try {
      const collectors = await this.prisma.user.findMany({
        where: {
          AND: [
            { email: { not: 'ceo@enako.com' } },
            { role: { name: { notIn: ['CEO', 'MANAGER'] } } },
            {
              OR: [
                { title: { contains: 'Collector', mode: 'insensitive' } },
                { responsibilities: { contains: 'terminalId', mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: { id: true },
      });

      const ids = collectors.map((c) => c.id);

      await this.prisma.cashCollection.deleteMany();

      if (ids.length > 0) {
        await this.prisma.user.deleteMany({
          where: { id: { in: ids } },
        });
      }

      return {
        success: true,
        count: ids.length,
        message: `Deleted ${ids.length} collectors and purged all collection history`,
      };
    } catch (err) {
      console.error('Error deleting all collectors:', err);
      throw err;
    }
  }

  async createCollector(data: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
    phone?: string;
    branch?: string;
    role?: string;
    terminalId?: string;
    password?: string;
  }) {
    try {
      const emailLower = data.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email: emailLower },
      });

      if (existing) {
        return existing;
      }

      let defaultRole = await this.prisma.role.findFirst({
        where: { name: 'EMPLOYEE' },
      });
      if (!defaultRole) {
        defaultRole = await this.prisma.role.findFirst();
      }
      if (!defaultRole) {
        defaultRole = await this.prisma.role.create({
          data: { name: 'EMPLOYEE', description: 'Field Cash Staff' },
        });
      }

      const fullName = (data.fullName || `${data.firstName || ''} ${data.lastName || ''}`).trim() || 'Field Collector';
      const terminalId = data.terminalId || `TRM-${Math.floor(1000 + Math.random() * 9000)}`;

      const metadata = JSON.stringify({
        terminalId,
        branch: data.branch || 'Douala Main Hub',
        role: data.role || 'Field Cash Collector',
        password: data.password || '123456',
        phone: data.phone || '',
      });

      const user = await this.prisma.user.create({
        data: {
          fullName,
          email: emailLower,
          phone: data.phone,
          title: data.role || 'Field Cash Collector',
          address: data.branch || 'Douala Main Hub',
          passwordHash: data.password ? `plain:${data.password}` : 'default-hash',
          responsibilities: metadata,
          roleId: defaultRole.id,
        },
      });

      const names = fullName.split(' ');
      return {
        id: user.id,
        firstName: names[0] || 'Collector',
        lastName: names.slice(1).join(' ') || '',
        fullName,
        email: user.email,
        phone: user.phone || '',
        branch: user.address || 'Douala Main Hub',
        role: data.role || 'Field Cash Collector',
        terminalId,
        password: data.password || '123456',
        status: 'ACTIVE',
        createdAt: user.createdAt.toISOString(),
      };
    } catch (err) {
      console.error('Error creating collector in DB:', err);
      throw err;
    }
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
