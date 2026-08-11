import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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
    const notif = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type ?? NotificationType.INFO,
        link: data.link,
      },
    });

    // Send email alert to employee's linked account email
    const recipient = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true },
    });

    if (recipient?.email) {
      this.mailService.sendNotificationAlert(recipient.email, data.title, data.body, data.link).catch(() => {});
    }

    return notif;
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
      select: { id: true, email: true },
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

    // Dispatch email alert to all active employees at their linked account emails
    for (const u of users) {
      if (u.email) {
        this.mailService.sendNotificationAlert(u.email, data.title, data.body, data.link).catch(() => {});
      }
    }
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
