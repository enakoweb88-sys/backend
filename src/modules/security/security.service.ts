import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  // ── CRON JOB 1: MONTHLY PASSWORD UPDATE REMINDER ────────────────────────────
  // Runs on the 1st day of every month at midnight (00:00)
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyPasswordReminder() {
    this.logger.log('🔐 Triggering Automated Monthly Password Security Reminder to all active users...');
    try {
      const activeUsers = await this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { email: true, fullName: true },
      });

      this.logger.log(`Found ${activeUsers.length} active users for monthly security reminder.`);

      for (const u of activeUsers) {
        if (u.email) {
          await this.mailService.sendMonthlyPasswordReminder(u.email, u.fullName).catch(err => {
            this.logger.error(`Failed password reminder for ${u.email}: ${err.message}`);
          });
        }
      }
      this.logger.log('✅ Monthly password security reminders completed.');
    } catch (e: any) {
      this.logger.error(`Error executing monthly password reminder cron: ${e.message}`);
    }
  }

  // ── CRON JOB 2: DAILY SUBSCRIPTION EXPIRATION ALERT (CEO & MANAGER) ────────
  // Runs daily at 9:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleSubscriptionExpirationCheck() {
    this.logger.log('⚠️ Running Subscription Expiration Check for CEO & Management...');
    try {
      const subscriptions = await this.prisma.subscription.findMany({
        where: { status: 'Active' },
      });

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const expiringSubs = subscriptions.filter(s => {
        const nextBill = new Date(s.nextBilling);
        return nextBill <= sevenDaysFromNow;
      }).map(s => {
        const nextBill = new Date(s.nextBilling);
        const daysLeft = Math.ceil((nextBill.getTime() - now.getTime()) / (1000 * 3600 * 24));
        return {
          name: s.name,
          cycle: s.cycle,
          cost: Number(s.costInXaf || s.cost || 0),
          nextBilling: s.nextBilling,
          daysLeft,
        };
      });

      if (!expiringSubs.length) {
        this.logger.log('No expiring subscriptions found within the 7-day window.');
        return;
      }

      this.logger.log(`Found ${expiringSubs.length} subscriptions expiring soon.`);

      // Find CEO & Managers
      const managers = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          role: {
            name: { in: ['CEO', 'MANAGER', 'OUTREACH_MANAGER'] },
          },
        },
        select: { email: true },
      });

      for (const mgr of managers) {
        if (mgr.email) {
          await this.mailService.sendSubscriptionExpirationAlert(mgr.email, expiringSubs).catch(err => {
            this.logger.error(`Failed subscription alert to ${mgr.email}: ${err.message}`);
          });
        }
      }
      this.logger.log('✅ Subscription expiration alerts sent to management.');
    } catch (e: any) {
      this.logger.error(`Error executing subscription expiration check: ${e.message}`);
    }
  }

  // ── DIRECT METHOD: SECURITY BREACH / INCIDENT ALERT TO enakoweb88@gmail.com ──
  async reportSecurityBreach(incidentType: string, details: { ip?: string; email?: string; reason?: string; timestamp?: Date }) {
    this.logger.warn(`🚨 EMERGENCY: Security breach alert reported - [${incidentType}]`);

    // Log to AuditLog table in database
    try {
      await this.prisma.auditLog.create({
        data: {
          action: `SECURITY_BREACH_${incidentType.toUpperCase()}`,
          entity: 'SECURITY_MONITOR',
          entityId: details.email || 'UNAUTHENTICATED',
          metadata: details,
          ipAddress: details.ip || null,
        },
      });
    } catch (e) {
      this.logger.error('Failed to save security breach audit log to database', e);
    }

    // Immediately dispatch email to enakoweb88@gmail.com
    return this.mailService.sendSecurityBreachAlert(incidentType, details);
  }
}
