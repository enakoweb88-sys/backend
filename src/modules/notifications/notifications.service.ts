import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async create(data: {
    userId: string;
    title: string;
    body: string;
    type?: NotificationType;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type ?? NotificationType.INFO,
        link: data.link,
      },
    });
  }

  async createForAll(data: {
    title: string;
    body: string;
    type?: NotificationType;
    link?: string;
    excludeUserId?: string;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(data.excludeUserId ? { id: { not: data.excludeUserId } } : {}),
      },
      select: { id: true },
    });

    if (!users.length) return;

    await this.prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        title: data.title,
        body: data.body,
        type: data.type ?? NotificationType.INFO,
        link: data.link,
      })),
    });
  }

  async deleteRead(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { userId, readAt: { not: null } },
    });
  }

  getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}
