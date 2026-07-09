import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsCronService {
  private readonly logger = new Logger(SubscriptionsCronService.name);

  constructor(private prisma: PrismaService) {}

  // Run every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiringSubscriptions() {
    this.logger.log('Running check for expiring monthly subscriptions...');
    
    const now = new Date();
    // Check for subscriptions within 3 days of nextBilling
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + 3);

    const expiringSubs = await this.prisma.subscription.findMany({
      where: {
        cycle: 'Monthly',
        status: 'Active',
        nextBilling: {
          lte: thresholdDate,
          gt: now
        }
      }
    });

    for (const sub of expiringSubs) {
      this.logger.log(`Subscription ${sub.name} expiring soon. Notifying user ${sub.addedById}`);
      
      // Check if we already notified recently to prevent spam
      const existingNotif = await this.prisma.notification.findFirst({
        where: {
          userId: sub.addedById,
          title: `Subscription Expiring: ${sub.name}`,
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Within last 24h
          }
        }
      });

      if (!existingNotif) {
        await this.prisma.notification.create({
          data: {
            userId: sub.addedById,
            title: `Subscription Expiring: ${sub.name}`,
            body: `Your subscription for ${sub.name} will expire/renew on ${sub.nextBilling.toLocaleDateString()}. Please ensure payment is ready.`,
            type: 'INFO'
          }
        });
      }
    }
  }
}
