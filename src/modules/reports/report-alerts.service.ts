import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { notificationAddress } from '../mail/notification-email';

type ReportAlert = { userId: string; title: string; body: string; type?: 'INFO'; link: string };

@Injectable()
export class ReportAlertsService {
  private readonly logger = new Logger(ReportAlertsService.name);
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}



  // Called inside the report's transaction: either the report, inbox alert and
  // email job all commit, or none of them do. No email is sent before commit.
  async enqueue(tx: Prisma.TransactionClient, alerts: ReportAlert[]) {
    if (!alerts.length) return;
    const records = alerts.map((alert) => ({
      ...alert,
      id: randomUUID(),
      type: alert.type || ('INFO' as const),
    }));
    await tx.notification.createMany({ data: records });
    await tx.notificationEmailDelivery.createMany({
      data: records.map((record) => ({ notificationId: record.id })),
    });
  }

  @Interval(10_000)
  async dispatchPending() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const ready = {
        OR: [
          { status: 'PENDING', nextAttemptAt: { lte: now } },
          { status: 'SENDING', leaseUntil: { lte: now } },
        ],
      };
      const candidates = await this.prisma.notificationEmailDelivery.findMany({
        where: ready,
        select: { id: true },
        orderBy: { nextAttemptAt: 'asc' },
        take: 10,
      });
      for (const candidate of candidates) {
        const leaseToken = randomUUID();
        // A conditional claim makes multiple PM2/server instances safe. Network
        // delivery happens outside a database transaction and row lock.
        const claim = await this.prisma.notificationEmailDelivery.updateMany({
          where: { id: candidate.id, ...ready },
          data: {
            status: 'SENDING',
            attempts: { increment: 1 },
            leaseToken,
            leaseUntil: new Date(Date.now() + 10 * 60_000),
          },
        });
        if (claim.count !== 1) continue;
        const job = await this.prisma.notificationEmailDelivery.findUnique({
          where: { id: candidate.id },
          include: {
            notification: {
              include: { user: { select: { email: true, personalEmail: true, status: true } } },
            },
          },
        });
        if (!job) continue;
        const claimed = { id: job.id, status: 'SENDING', leaseToken };
        if (job.notification.user.status !== 'ACTIVE') {
          await this.prisma.notificationEmailDelivery.updateMany({
            where: claimed,
            data: {
              status: 'SKIPPED',
              lastError: 'Recipient account is inactive',
              leaseUntil: null,
              leaseToken: null,
            },
          });
          continue;
        }
        const recipient = notificationAddress(job.notification.user);
        try {
          const delivered = await this.mail.sendNotificationAlert(
            recipient,
            job.notification.title,
            job.notification.body,
            job.notification.link || undefined,
            { plainText: true },
          );
          if (!delivered.success)
            throw new Error(delivered.error || 'Email provider rejected delivery');
          await this.prisma.notificationEmailDelivery.updateMany({
            where: claimed,
            data: {
              status: 'SENT',
              recipientEmail: recipient,
              sentAt: new Date(),
              providerMessageId: delivered.messageId,
              lastError: null,
              leaseUntil: null,
              leaseToken: null,
            },
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Email delivery failed';
          const delaySeconds = Math.min(3600, 30 * 2 ** Math.min(job.attempts - 1, 7));
          await this.prisma.notificationEmailDelivery.updateMany({
            where: claimed,
            data: {
              status: 'PENDING',
              recipientEmail: recipient,
              lastError: reason.slice(0, 1000),
              nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
              leaseUntil: null,
              leaseToken: null,
            },
          });
          this.logger.warn(`Report email ${job.id} will retry after a delivery failure`);
        }
      }
    } catch (error) {
      this.logger.error(
        'Report email queue is temporarily unavailable; saved jobs will retry',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
