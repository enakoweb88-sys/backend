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
}
