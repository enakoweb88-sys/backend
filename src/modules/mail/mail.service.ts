import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || 'enakooutreach@gmail.com';
    const pass = process.env.SMTP_PASS || '';

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`SMTP Mailer initialized using ${host}:${port} (${user})`);
    } else {
      this.logger.warn('SMTP_PASS is not configured. Email notifications will be logged to console in dev mode.');
    }
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    const from = process.env.SMTP_FROM || `"ENAKO Support" <${process.env.SMTP_USER || 'enakosupport@gmail.com'}>`;
    
    if (!this.transporter) {
      // Re-check in case ENV was updated at runtime
      this.initTransporter();
    }

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to,
          subject,
          text: text || subject,
          html,
        });
        this.logger.log(`Email successfully sent to ${to}: "${subject}"`);
        return true;
      } catch (err: any) {
        this.logger.error(`Failed to send email to ${to}: ${err.message}`);
        return false;
      }
    } else {
      this.logger.log(`[SIMULATED MAIL TO ${to}] Subject: "${subject}"\nContent: ${text || html}`);
      return true;
    }
  }

  // ── HTML EMAIL TEMPLATES ────────────────────────────────────────────────────
  async sendNotificationAlert(toEmail: string, title: string, body: string, link?: string) {
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: #1c4980; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">ENAKO OUTREACH</h1>
          <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.85;">System & Community Notification Alert</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #1c4980; margin-top: 0;">${title}</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">${body}</p>
          ${
            link
              ? `<div style="text-align: center; margin: 28px 0;">
                  <a href="${link}" style="display: inline-block; background: #1eb4d4; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 6px;">View Notification Details</a>
                 </div>`
              : ''
          }
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          ENAKO Outreach Foundation • BP 1234, Yaoundé, Cameroon • <a href="mailto:enakooutreach@gmail.com" style="color: #1eb4d4; text-decoration: none;">enakooutreach@gmail.com</a>
        </div>
      </div>
    `;

    return this.sendMail(toEmail, `[ENAKO Notification] ${title}`, html, body);
  }

  async sendNewMessageAlert(toEmail: string, senderName: string, channelName: string, messageContent: string) {
    const title = `New Message from ${senderName}`;
    const body = `You received a new message in channel <strong>#${channelName}</strong>:<br/><br/><em>"${messageContent}"</em>`;
    return this.sendNotificationAlert(toEmail, title, body);
  }

  async sendNewDonationAlert(toEmail: string, donorName: string, amount: string, method: string) {
    const title = `New Donation Received: ${amount}`;
    const body = `Thank you! <strong>${donorName}</strong> has made a generous donation of <strong>${amount}</strong> via ${method}.`;
    return this.sendNotificationAlert(toEmail, title, body);
  }

  // ── MONTHLY PASSWORD SECURITY REMINDER ────────────────────────────────────
  async sendMonthlyPasswordReminder(toEmail: string, fullName: string) {
    const title = `🔐 Monthly Security Reminder: Time to Update Your Password`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: #1c4980; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">ENAKO OS SECURITY</h1>
          <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.85;">Mandatory Monthly Security Compliance</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #1c4980; margin-top: 0;">Hello ${fullName || 'Team Member'},</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            As part of ENAKO OS monthly security policy, all active staff members are required to update their account password every month to safeguard system operations and corporate data.
          </p>
          <div style="background: #f8fafc; border-left: 4px solid #1c4980; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #334155; font-weight: bold;">Password Security Requirements:</p>
            <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 12px; color: #64748b; line-height: 1.6;">
              <li>At least 8 characters long</li>
              <li>Include uppercase & lowercase letters</li>
              <li>Include numbers and special symbols (@, #, $, etc.)</li>
              <li>Do not reuse previous passwords</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://enakoos.com/#/settings" style="display: inline-block; background: #1eb4d4; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 6px;">Update Your Password Now</a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          ENAKO OS Security Team • BP 1234, Yaoundé, Cameroon • <a href="mailto:enakosupport@gmail.com" style="color: #1eb4d4; text-decoration: none;">enakosupport@gmail.com</a>
        </div>
      </div>
    `;

    return this.sendMail(toEmail, `🔐 ENAKO OS Security Alert: Monthly Password Update Reminder`, html);
  }

  // ── SUBSCRIPTION EXPIRATION WARNING (CEO & MANAGER) ──────────────────────
  async sendSubscriptionExpirationAlert(toEmail: string, subscriptions: Array<{ name: string; cycle: string; cost: number; nextBilling: Date; daysLeft: number }>) {
    const title = `⚠️ ENAKO OS Alert: Enterprise Subscription Expiration Notice`;
    
    const tableRows = subscriptions.map(s => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-size: 13px; font-weight: bold; color: #1e293b;">${s.name}</td>
        <td style="padding: 10px; font-size: 12px; color: #64748b;">${s.cycle}</td>
        <td style="padding: 10px; font-size: 12px; font-weight: bold; color: #1c4980;">${Number(s.cost || 0).toLocaleString()} FCFA</td>
        <td style="padding: 10px; font-size: 12px; color: #dc2626; font-weight: bold;">${new Date(s.nextBilling).toLocaleDateString()} (${s.daysLeft <= 0 ? 'OVERDUE' : s.daysLeft + ' days left'})</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: #eab308; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">SUBSCRIPTION NOTICE</h1>
          <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Management & CEO Operational Alert</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #1c4980; margin-top: 0;">Enterprise Subscriptions Requiring Renewal</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            The following corporate service subscriptions are expiring soon or require immediate renewal to avoid service disruption across ENAKO OS infrastructure:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: #f8fafc; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 8px 10px;">Service</th>
                <th style="padding: 8px 10px;">Cycle</th>
                <th style="padding: 8px 10px;">Cost</th>
                <th style="padding: 8px 10px;">Expiration Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://enakoos.com/#/subscriptions" style="display: inline-block; background: #1c4980; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 6px;">Manage Subscriptions</a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          ENAKO OS Management Systems • <a href="mailto:enakosupport@gmail.com" style="color: #1eb4d4; text-decoration: none;">enakosupport@gmail.com</a>
        </div>
      </div>
    `;

    return this.sendMail(toEmail, title, html);
  }

  // ── SECURITY BREACH ALERT (TARGET: enakoweb88@gmail.com) ───────────────────
  async sendSecurityBreachAlert(incidentType: string, details: { ip?: string; email?: string; reason?: string; timestamp?: Date }) {
    const breachEmailRecipient = 'enakoweb88@gmail.com';
    const title = `🚨 CRITICAL SECURITY BREACH ALERT: ${incidentType}`;
    const timestamp = details.timestamp ? new Date(details.timestamp).toLocaleString() : new Date().toLocaleString();

    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 2px solid #dc2626; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(220,38,38,0.15);">
        <div style="background: #dc2626; padding: 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">🚨 SECURITY BREACH ALERT</h1>
          <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.95;">ENAKO OS Automated Security Protection System</p>
        </div>
        <div style="padding: 32px 24px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #dc2626; margin-top: 0;">Incident Type: ${incidentType}</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            A potential security violation or breach attempt was detected and intercepted by the ENAKO OS security monitor.
          </p>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 18px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #991b1b; font-weight: bold;">Incident Telemetry Details:</p>
            <table style="width: 100%; font-size: 12px; color: #7f1d1d;">
              <tr><td style="padding: 4px 0; font-weight: bold; width: 120px;">Target Email:</td><td>${details.email || 'Unknown / Unauthenticated'}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: bold;">Origin IP:</td><td>${details.ip || 'Unknown IP'}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: bold;">Timestamp:</td><td>${timestamp}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: bold;">Reason / Event:</td><td>${details.reason || 'Unauthorized security boundary violation'}</td></tr>
            </table>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://enakoos.com/#/audit-logs" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 6px;">Inspect Security Audit Logs</a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          Automated Emergency Dispatch • Target Administrator: <strong style="color: #dc2626;">${breachEmailRecipient}</strong>
        </div>
      </div>
    `;

    return this.sendMail(breachEmailRecipient, title, html);
  }
}
