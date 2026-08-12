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
    const user = process.env.SMTP_USER || 'enakosupport@gmail.com';
    // Allow pass with or without spaces (e.g. "drsg gmlk hqfz kwev" or "drsggmlkhqfzkwev")
    const pass = (process.env.SMTP_PASS || 'drsg gmlk hqfz kwev').trim();

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      this.logger.log(`SMTP Mailer initialized using Gmail Service (${user})`);
    } else {
      this.logger.warn('SMTP_PASS is not configured. Email notifications will be logged to console in dev mode.');
    }
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    const senderUser = (process.env.SMTP_USER || 'enakosupport@gmail.com').trim();
    const from = `"ENAKO Support" <${senderUser}>`;
    
    if (!this.transporter) {
      this.initTransporter();
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to,
          subject,
          text: text || subject,
          html,
        });
        this.logger.log(`Email successfully sent to ${to}: "${subject}" (MessageId: ${info.messageId})`);
        return true;
      } catch (err: any) {
        this.logger.error(`Failed to send email to ${to}: ${err.message}`, err.stack);
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

  // ── CORPORATE EMAIL UPDATED NOTIFICATION ────────────────────────────────────
  async sendCorporateEmailUpdated(newEmail: string, fullName: string, oldEmail: string) {
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1c4980 0%, #2563eb 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">ENAKO CLOUD OS</h1>
          <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.85; letter-spacing: 0.05em;">Corporate Email Address Update Notification</p>
        </div>
        <div style="padding: 32px 28px; color: #1e293b;">
          <h2 style="font-size: 17px; font-weight: 700; color: #1c4980; margin: 0 0 16px;">Hello ${fullName},</h2>
          <p style="font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 20px;">
            This is an official notification from <strong>ENAKO Cloud OS</strong> to inform you that your corporate email address has been updated by the system administrator.
          </p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <table style="width: 100%; font-size: 13px; color: #1e293b; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e0f2fe;">
                <td style="padding: 10px 8px; font-weight: 700; color: #64748b; width: 140px;">Previous Email</td>
                <td style="padding: 10px 8px; color: #dc2626; font-weight: 600; text-decoration: line-through;">${oldEmail}</td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; font-weight: 700; color: #64748b;">New Corporate Email</td>
                <td style="padding: 10px 8px; color: #16a34a; font-weight: 800;">${newEmail}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 16px;">
            <strong>Action Required:</strong> From this point forward, please use your <strong>new corporate email (${newEmail})</strong> to log in to the ENAKO Cloud OS dashboard. Your password remains unchanged.
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 24px;">
            If you did not expect this change or believe it was made in error, please contact the HR department or write to <a href="mailto:hr@enako.cm" style="color: #2563eb; font-weight: 600;">hr@enako.cm</a> immediately.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://enakoos.com" style="display: inline-block; background: #1c4980; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 13px 32px; border-radius: 8px; letter-spacing: 0.04em;">Log In with New Email →</a>
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          ENAKO Cloud OS • HR &amp; Systems Administration • <a href="mailto:hr@enako.cm" style="color: #2563eb; text-decoration: none;">hr@enako.cm</a>
        </div>
      </div>
    `;
    return this.sendMail(newEmail, '📧 Your ENAKO Corporate Email Address Has Been Updated', html);
  }

  // ── NEW EMPLOYEE WELCOME EMAIL ────────────────────────────────────────────────
  async sendWelcomeEmail(opts: {
    toEmail: string;
    fullName: string;
    department: string;
    position: string;
    password: string;
    loginEmail: string;
    responsibilities?: string;
    goals?: string;
  }) {
    const { toEmail, fullName, department, position, password, loginEmail, responsibilities, goals } = opts;
    const firstName = fullName.split(' ')[0];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1c4980 0%,#1d4ed8 60%,#0ea5e9 100%);padding:40px 32px;text-align:center;color:#fff;">
    <div style="font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;opacity:0.75;margin-bottom:10px;">ENAKO CLOUD OS · HUMAN RESOURCES</div>
    <h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:0.02em;">Welcome to the ENAKO Family, ${firstName}! 🎉</h1>
    <p style="margin:10px 0 0;font-size:14px;opacity:0.85;line-height:1.5;">Your official onboarding packet — please read every section carefully</p>
  </div>

  <!-- BODY -->
  <div style="padding:36px 32px;color:#1e293b;line-height:1.75;font-size:14px;">

    <!-- GREETING -->
    <p style="font-size:15px;margin:0 0 20px;">Dear <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;">
      On behalf of the entire leadership team and every member of the ENAKO family, we are delighted to extend to you a warm and official welcome as you join us as a <strong>${position}</strong> in the <strong>${department} Department</strong>. This moment marks the beginning of what we believe will be a mutually rewarding professional journey. You were selected because we saw in you the skills, the values, and the drive that align perfectly with what ENAKO stands for.
    </p>
    <p style="margin:0 0 28px;color:#475569;">
      This email contains everything you need to know to get started — your login credentials, company policies, department expectations, daily operational routines, and how to make the most of your ENAKO Cloud OS dashboard. Please take the time to read this in full, as it serves as your primary onboarding reference document.
    </p>

    <!-- SECTION 1: LOGIN CREDENTIALS -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:16px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;">🔐 Section 1 — Your ENAKO Cloud OS Login Credentials</h2>
      <p style="margin:0 0 12px;color:#475569;">Your personal ENAKO Cloud OS account has been created and is ready for you to access. Use the details below to log in for the first time:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #bae6fd;"><td style="padding:9px 8px;font-weight:700;color:#0369a1;width:160px;">Portal URL</td><td style="padding:9px 8px;"><a href="https://enakoos.com" style="color:#0369a1;font-weight:700;">https://enakoos.com</a></td></tr>
        <tr style="border-bottom:1px solid #bae6fd;"><td style="padding:9px 8px;font-weight:700;color:#0369a1;">Corporate Email</td><td style="padding:9px 8px;font-weight:800;color:#1e293b;">${loginEmail}</td></tr>
        <tr><td style="padding:9px 8px;font-weight:700;color:#0369a1;">Temporary Password</td><td style="padding:9px 8px;font-weight:800;color:#dc2626;font-family:monospace;font-size:15px;">${password}</td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:#dc2626;font-weight:700;">⚠️ IMPORTANT: You are required to change this password on your first login. Go to Settings → Security → Change Password. Do not share your credentials with anyone.</p>
    </div>

    <!-- SECTION 2: ABOUT ENAKO -->
    <h2 style="font-size:16px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">🏢 Section 2 — About ENAKO: Who We Are, What We Do & How We Work</h2>
    <p style="margin:0 0 14px;color:#475569;">
      ENAKO is a multi-division, technology-driven financial services group headquartered in Yaoundé, Cameroon. Our overarching mission is to democratize access to modern, secure, and inclusive financial services for individuals, businesses, and communities across Africa and the diaspora. We operate across three major, distinct business divisions — each with its own purpose, client base, and product offering. As a member of the ENAKO team, you must understand all three divisions deeply, because everything we do as a company flows from this three-pillar foundation.
    </p>

    <!-- DIVISION 1: MOBILE APP -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px;margin-bottom:18px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#1d4ed8;">📱 Division 1 — ENAKO Mobile Application (Consumer Fintech)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        The ENAKO Mobile App is our flagship consumer product — available on both iOS and Android — and serves as the financial super-app for everyday Cameroonians and the African diaspora. It brings together a powerful set of financial tools in one intuitive interface:
      </p>
      <ul style="margin:0;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>💰 Akawo Smart Savings:</strong> A high-yield automated savings product. Users set savings goals and ENAKO automatically deducts the chosen amount on a daily, weekly, or monthly schedule. Interest is earned on balances, making it the smartest way to save consistently without effort. This is one of our most-loved products.</li>
        <li><strong>🤝 Njangi (Group Savings &amp; Rotating Funds):</strong> ENAKO digitizes the traditional African tontine system. Users can create or join digital Njangi groups, set rotation schedules, and manage contributions — all transparently on the app. No more missed contributions or disputes.</li>
        <li><strong>🏗️ Land Banking &amp; Real Estate Investment:</strong> Users can invest in verified land and real estate parcels through the app, with a guaranteed annual return of <strong>12% interest per year</strong>. This makes property investment accessible to ordinary people who do not have large lump sums — they invest what they can, and the returns are calculated and credited automatically. All properties are verified, documented, and legal.</li>
        <li><strong>🎓 School Fees Payment:</strong> Parents and guardians can pay school fees for any institution directly through the ENAKO app — no queues, no agent, no cash. The payment is processed instantly and a digital receipt is issued immediately.</li>
        <li><strong>🏠 Rent Payment:</strong> Tenants can pay their monthly rent through the app. Landlords registered on the platform receive funds directly. This removes the friction and risk of cash-based rent transactions.</li>
        <li><strong>💡 Utility Bill Payments (Water, Electricity &amp; More):</strong> Users can pay their CDE (electricity), CAMWATER (water), and other utility bills in seconds through the app. No more travelling to payment centers or standing in long lines. We are continuously expanding our utility payment partners.</li>
        <li><strong>📲 Mobile Money Transfers &amp; Remittances:</strong> Send money instantly across mobile money networks (MTN MoMo, Orange Money) within Cameroon, and to the diaspora internationally. Our remittance product is fast, low-fee, and built for the African corridor.</li>
      </ul>
    </div>

    <!-- DIVISION 2: NGO OUTREACH -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin-bottom:18px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#15803d;">🌍 Division 2 — ENAKO Outreach Foundation (NGO / Charity)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        ENAKO Outreach is our non-profit, social impact arm — a registered NGO operating under the website <a href="https://enakooutreach.cm" style="color:#15803d;font-weight:700;">enakooutreach.cm</a>. While the fintech division exists to serve individuals and businesses commercially, ENAKO Outreach exists to serve communities that have been left behind.
      </p>
      <ul style="margin:0;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>Charity Fundraising Campaigns:</strong> We organize and manage fundraising campaigns for individuals, communities, and causes in Cameroon and across Africa. Anyone can submit a cause and ENAKO Outreach facilitates the collection and transparent distribution of funds.</li>
        <li><strong>Scholarship Programs:</strong> We award scholarships to brilliant but financially disadvantaged students to support their education — from primary school all the way to university level.</li>
        <li><strong>Community Development Projects:</strong> From borehole construction to school renovation, ENAKO Outreach channels funds into verified community development projects that create lasting, measurable impact.</li>
        <li><strong>Humanitarian Relief:</strong> In times of crisis — floods, displacement, or medical emergencies — ENAKO Outreach mobilizes resources rapidly to get aid to those who need it most.</li>
        <li><strong>Donor Management:</strong> The Outreach platform allows donors locally and from the diaspora to give once or on a recurring basis. Every cent is tracked, reported, and accounted for with full transparency.</li>
      </ul>
      <p style="margin:12px 0 0;color:#475569;font-size:13px;">
        As an ENAKO employee, you are an ambassador of this mission. We hold ourselves to the highest standards of integrity in everything we do, because our community is watching and trusting us.
      </p>
    </div>

    <!-- DIVISION 3: FX / OTC -->
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#713f12;">💱 Division 3 — ENAKO FX / OTC (International Foreign Exchange Desk)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        ENAKO FX is our over-the-counter (OTC) foreign exchange desk, serving businesses and high-value clients who need to make international payments in foreign currency. This is a B2B and corporate-facing service designed for importers, exporters, corporate entities, procurement officers, and businesses that regularly deal with international suppliers.
      </p>
      <p style="margin:0 0 10px;font-weight:700;color:#78350f;font-size:13px;">How It Works:</p>
      <ul style="margin:0 0 14px;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>Who We Serve:</strong> Importers who need to pay overseas suppliers, exporters managing cross-border settlements, corporate procurement teams, and any business individual who holds CFA Francs (FCFA) in Cameroon and needs to send value abroad.</li>
        <li><strong>The Problem We Solve:</strong> Sending money internationally from Cameroon is notoriously difficult, expensive, and slow through traditional banking channels. ENAKO FX bypasses these barriers by leveraging OTC settlement networks to deliver funds faster and at better rates.</li>
        <li><strong>Outbound-Only (For Now):</strong> At this stage of our operations, ENAKO FX operates <strong>outbound payments only</strong> — meaning we send your money abroad in your preferred foreign currency. We do not currently receive inbound international payments. This policy may evolve as we grow our compliance and liquidity infrastructure.</li>
        <li><strong>Currencies We Deal In:</strong> We actively trade and settle in <strong>Nigerian Naira (NGN)</strong>, <strong>USDT (Tether / Stablecoin)</strong>, <strong>US Dollar (USD)</strong>, and <strong>Euro (EUR)</strong>. Requests in other currencies are evaluated on a case-by-case basis.</li>
        <li><strong>Client Profile:</strong> Our typical FX client is a big-ticket business operator — an importer bringing in goods from China, India, Europe, or the UAE; a corporate treasurer needing to pay international contracts; or an entrepreneur paying for software licenses, digital services, or overseas training fees.</li>
        <li><strong>Rate &amp; Settlement Process:</strong> The client brings their FCFA, we provide a live rate quote, agree on the transaction, execute the settlement through our partner networks, and deliver confirmation once funds clear on the recipient's end. Rates are competitive and transparent.</li>
        <li><strong>Compliance:</strong> All FX transactions are subject to KYC/AML verification. We require proper documentation of the business purpose before processing any transaction. ENAKO FX operates strictly within the regulatory framework.</li>
      </ul>
      <p style="margin:0;color:#475569;font-size:13px;font-style:italic;">
        Note: If you are in a client-facing role, you will regularly interact with FX clients. Always present yourself professionally, maintain strict confidentiality about client transaction details, and escalate any unusual requests immediately to your supervisor.
      </p>
    </div>

    <p style="margin:0 0 28px;color:#475569;">
      ENAKO Cloud OS — the internal platform you are now part of — is the operational backbone that ties all three divisions together. It manages HR, payroll, tasks, goals, performance reviews, client leads, financial dashboards, compliance workflows, and all internal communications. Understanding both the business and the system is essential to performing at your best here.
    </p>

    <!-- SECTION 3: COMPANY RULES & CODE OF CONDUCT -->
    <h2 style="font-size:16px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">📜 Section 3 — Company Rules & Code of Conduct</h2>
    <p style="margin:0 0 12px;color:#475569;">All ENAKO employees are bound by the following non-negotiable standards of professional conduct:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:2;">
      <li><strong>Punctuality &amp; Attendance:</strong> Be at your workstation or logged into ENAKO OS by your contracted start time. Repeated tardiness without prior notification will be logged and addressed during performance reviews.</li>
      <li><strong>Confidentiality:</strong> All company data, client information, financial records, and internal communications are strictly confidential. Sharing any internal data externally — even with family members — is grounds for immediate disciplinary action.</li>
      <li><strong>Respect &amp; Professionalism:</strong> Every team member must treat colleagues, clients, and external partners with dignity and respect, regardless of seniority, department, or background. ENAKO has zero tolerance for harassment, discrimination, or workplace hostility.</li>
      <li><strong>Device &amp; System Security:</strong> Never leave your ENAKO OS session unlocked and unattended. Always log out when stepping away. Report any suspicious system behavior or unauthorized access attempts to IT immediately.</li>
      <li><strong>Communication Standards:</strong> Internal communication should be professional. Use the ENAKO OS Chat module for team discussions. External communication with clients or partners must be pre-approved or comply with your department's communication guidelines.</li>
      <li><strong>No Moonlighting:</strong> While employed at ENAKO, you are expected to not engage in work for competitors or activities that create a conflict of interest. Any outside professional engagement must be disclosed to HR.</li>
      <li><strong>Continuous Learning:</strong> ENAKO is a fast-growing company. You are expected to stay current with developments in your field and proactively develop your skills. Training resources will be assigned through ENAKO OS.</li>
    </ul>

    <!-- SECTION 4: DEPARTMENT EXPECTATIONS -->
    <h2 style="font-size:16px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">🎯 Section 4 — Your Role in the ${department} Department</h2>
    <p style="margin:0 0 12px;color:#475569;">
      As a <strong>${position}</strong> in the <strong>${department} Department</strong>, your primary mandate is to contribute meaningfully to the department's objectives and directly support ENAKO's operational and business growth goals. Below are the key expectations for every team member in your department:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:2;">
      <li><strong>Ownership:</strong> Take full responsibility for your assigned tasks and deliverables. Do not wait to be reminded — manage your own pipeline proactively using the Tasks module in ENAKO OS.</li>
      <li><strong>Collaboration:</strong> Work closely with other department members and cross-functional teams. Use the ENAKO OS Chat and Announcements modules for real-time coordination.</li>
      <li><strong>Quality Standards:</strong> All work produced must meet ENAKO's internal quality benchmarks. Whether it's a financial report, a piece of content, a code feature, or a client proposal — do not submit work you are not proud of.</li>
      <li><strong>Deadline Compliance:</strong> Every task assigned in ENAKO OS has a due date. Meeting deadlines is not optional — communicate early if you foresee blockers.</li>
      <li><strong>Initiative:</strong> We value team members who identify opportunities for improvement and take action. If you see something that could be done better, raise it with your department head.</li>
      <li><strong>KPI Alignment:</strong> Your work will be measured against clear Key Performance Indicators (KPIs) set by your manager and visible in your ENAKO OS Performance Dashboard. Review them regularly.</li>
    </ul>

    ${responsibilities ? `
    <div style="background:#f8fafc;border-left:4px solid #1c4980;padding:16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:13px;color:#1c4980;font-weight:700;">📌 Your Assigned Core Responsibilities:</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${responsibilities}</p>
    </div>` : ''}

    ${goals ? `
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:6px;margin:16px 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#15803d;font-weight:700;">🎯 Your Initial Performance Goals:</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${goals}</p>
    </div>` : ''}

    <!-- SECTION 5: WEEKLY REPORTS -->
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800;color:#713f12;text-transform:uppercase;letter-spacing:0.05em;">📊 Section 5 — How to Submit Your Weekly Report</h2>
      <p style="margin:0 0 12px;color:#475569;">
        Every ENAKO employee is required to submit a Weekly Activity Report (WAR) every <strong>Friday before 5:00 PM</strong>. This report is non-negotiable — it allows leadership to monitor team progress, identify blockers, and ensure departmental alignment.
      </p>
      <p style="margin:0 0 10px;font-weight:700;color:#78350f;">Your Weekly Report must cover the following:</p>
      <ol style="margin:0 0 14px;padding-left:20px;color:#475569;line-height:2;">
        <li><strong>Tasks Completed This Week:</strong> List everything you accomplished, referencing task IDs in ENAKO OS where applicable.</li>
        <li><strong>Tasks In Progress:</strong> What are you currently working on and what is the expected completion date?</li>
        <li><strong>Blockers &amp; Challenges:</strong> Any obstacles slowing your progress — be specific and honest.</li>
        <li><strong>Goals for Next Week:</strong> What do you commit to completing in the coming week?</li>
        <li><strong>Support Needed:</strong> Any resources, approvals, or collaboration you need from other teams or leadership.</li>
      </ol>
      <p style="margin:0;color:#475569;font-size:13px;">
        <strong>How to submit:</strong> Log in to ENAKO Cloud OS → Navigate to <strong>Reports</strong> in the sidebar → Click <strong>"Create Weekly Report"</strong> → Fill in all sections → Submit. Your report goes directly to your Department Head and the CEO for review. You can also email it to your supervisor and copy <a href="mailto:reports@enako.cm" style="color:#0369a1;font-weight:600;">reports@enako.cm</a>.
      </p>
    </div>

    <!-- SECTION 6: STAFF MEALS & FOOD INPUT -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:800;color:#14532d;text-transform:uppercase;letter-spacing:0.05em;">🍱 Section 6 — Staff Meal Subsidy & Daily Food Input</h2>
      <p style="margin:0 0 12px;color:#475569;">
        ENAKO values the well-being of its team members. As part of our employee welfare program, the company provides a <strong>daily meal subsidy</strong> to every active staff member. Here is how it works:
      </p>
      <div style="background:#dcfce7;border-radius:8px;padding:16px;margin-bottom:14px;">
        <p style="margin:0;font-size:14px;color:#14532d;font-weight:700;">📌 Meal Subsidy Policy Summary</p>
        <ul style="margin:10px 0 0;padding-left:20px;color:#166534;line-height:2;font-size:13px;">
          <li>The standard daily meal allowance is <strong>1,000 FCFA per day</strong> per employee.</li>
          <li>ENAKO covers <strong>50% of this cost (500 FCFA)</strong> as a company-sponsored welfare benefit.</li>
          <li>The remaining <strong>500 FCFA</strong> is your personal contribution, which is tracked and can optionally be deducted from your monthly salary.</li>
          <li>The subsidy applies to <strong>working days only</strong> (Monday through Friday, excluding public holidays).</li>
        </ul>
      </div>
      <p style="margin:0 0 10px;font-weight:700;color:#14532d;">How to Log Your Daily Meal in ENAKO OS:</p>
      <ol style="margin:0 0 14px;padding-left:20px;color:#475569;line-height:2;font-size:13px;">
        <li>Log in to <strong>ENAKO Cloud OS</strong> at <a href="https://enakoos.com" style="color:#0369a1;">https://enakoos.com</a>.</li>
        <li>In your dashboard sidebar, click on <strong>"Staff Meals"</strong>.</li>
        <li>Click <strong>"Log Today's Meal"</strong>.</li>
        <li>Enter what you ate, the total cost, and optionally upload a receipt photo.</li>
        <li>The system will automatically calculate your personal contribution (50%) and log the company's 500 FCFA subsidy for payroll processing.</li>
      </ol>
      <p style="margin:0;font-size:12px;color:#475569;font-style:italic;">
        Note: Meal logs that are not submitted by end of the working day will not be eligible for the day's subsidy. Please ensure you log your meals daily. Finance reviews meal logs every Friday for weekly reimbursement processing.
      </p>
    </div>

    <!-- SECTION 7: SUPPORT & CONTACTS -->
    <h2 style="font-size:16px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">📞 Section 7 — Who to Contact for Support</h2>
    <p style="margin:0 0 12px;color:#475569;">At ENAKO, no one works in isolation. If you have a question, concern, or need assistance, here are the right people and channels to reach out to:</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
      <thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">
        <th style="padding:9px 10px;text-align:left;">Matter</th>
        <th style="padding:9px 10px;text-align:left;">Contact</th>
        <th style="padding:9px 10px;text-align:left;">Email</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">HR, Leave, Welfare, Benefits</td><td style="padding:9px 10px;color:#64748b;">HR Department</td><td style="padding:9px 10px;"><a href="mailto:hr@enako.cm" style="color:#2563eb;">hr@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">System Login, Technical Issues</td><td style="padding:9px 10px;color:#64748b;">IT / Engineering</td><td style="padding:9px 10px;"><a href="mailto:it@enako.cm" style="color:#2563eb;">it@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">Salary, Payroll, Expenses</td><td style="padding:9px 10px;color:#64748b;">Finance Team</td><td style="padding:9px 10px;"><a href="mailto:finance@enako.cm" style="color:#2563eb;">finance@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">Tasks, Projects, Department Work</td><td style="padding:9px 10px;color:#64748b;">Your Dept. Head</td><td style="padding:9px 10px;"><a href="mailto:management@enako.cm" style="color:#2563eb;">management@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">Complaints, Grievances</td><td style="padding:9px 10px;color:#64748b;">CEO Office</td><td style="padding:9px 10px;"><a href="mailto:ceo@enako.cm" style="color:#2563eb;">ceo@enako.cm</a></td></tr>
        <tr><td style="padding:9px 10px;font-weight:600;">General Support</td><td style="padding:9px 10px;color:#64748b;">Support Team</td><td style="padding:9px 10px;"><a href="mailto:support@enako.cm" style="color:#2563eb;">support@enako.cm</a></td></tr>
      </tbody>
    </table>
    <p style="margin:0 0 28px;color:#475569;font-size:13px;">
      You can also raise support tickets directly from your ENAKO Cloud OS dashboard by navigating to <strong>Help &amp; Support → New Ticket</strong>. Our support team targets a response time of under 4 hours on business days.
    </p>

    <!-- SECTION 8: YOUR ENAKO OS DASHBOARD -->
    <h2 style="font-size:16px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">💻 Section 8 — Your ENAKO Cloud OS Dashboard: A Full Guide</h2>
    <p style="margin:0 0 12px;color:#475569;">
      ENAKO Cloud OS is your personal command center. Everything you need to do your job effectively — from tracking your goals to logging your meals, submitting leave requests, reading announcements, sending messages to teammates, and reviewing your own performance — is all in one place.
    </p>
    <p style="margin:0 0 12px;color:#475569;">Here is a breakdown of your key dashboard modules and how to use each one:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:2.1;">
      <li><strong>🏠 Dashboard (Home):</strong> Your personalized overview. See your active tasks, recent announcements, upcoming deadlines, daily KPIs, and a summary of your department's performance at a glance. This is your starting point every morning.</li>
      <li><strong>✅ Tasks:</strong> All tasks assigned to you appear here. You can update the status (To Do → In Progress → Done), add comments, attach files, and set reminders. Keeping your tasks up to date is critical as your manager monitors them in real time.</li>
      <li><strong>🎯 Goals:</strong> Your personal and department goals are tracked here. Each goal has a progress bar, target date, and status. Update your goal progress at least once a week so leadership can see your trajectory.</li>
      <li><strong>📊 Reports:</strong> Submit your weekly activity reports, view past submissions, and track report history. You can also view company reports relevant to your department.</li>
      <li><strong>📢 Announcements:</strong> All official company communications, policy updates, event notifications, and urgent alerts are published here by management. Check this daily — important information will not always be repeated.</li>
      <li><strong>💬 Chat:</strong> Real-time messaging with colleagues. Use department channels for team coordination and direct messages for one-on-one communication. Keep all professional conversations within ENAKO OS Chat.</li>
      <li><strong>📅 Leaves:</strong> Submit leave requests, view your remaining leave days, and track the approval status of your applications. Leaves must be submitted at least 3 working days in advance, except for emergencies.</li>
      <li><strong>🍱 Staff Meals:</strong> Log your daily meal here as described in Section 6. Keep this updated every day to ensure you receive your meal subsidy without delays.</li>
      <li><strong>👤 My Profile:</strong> View and update your personal information, upload your professional photo, and review your employment details. Contact HR if you need to update information you cannot change yourself.</li>
      <li><strong>⚙️ Settings:</strong> Customize your notification preferences, change your password, enable two-factor authentication, and manage your account security settings. We strongly recommend enabling 2FA immediately.</li>
      <li><strong>🎫 Help &amp; Support:</strong> Submit support tickets and track their status. You can also access training materials, company FAQs, and policy documents here.</li>
    </ul>
    <p style="margin:0 0 28px;color:#475569;">
      Depending on your department, additional specialized modules such as Financial Reports, KYC Management, Content Calendar, Ad Campaigns, or Sales Pipeline may also be visible in your sidebar. These are tailored to your role to ensure you have exactly the tools you need — nothing more, nothing less.
    </p>

    <!-- SECTION 9: PERFORMANCE & GROWTH -->
    <h2 style="font-size:16px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">📈 Section 9 — Performance Reviews & Your Growth at ENAKO</h2>
    <p style="margin:0 0 12px;color:#475569;">
      ENAKO operates a transparent, data-driven performance management system. Every quarter, you will participate in a structured performance review with your direct supervisor. Reviews are based on your task completion rate, goal achievement, weekly report quality, peer feedback, and your overall contribution to the team.
    </p>
    <p style="margin:0 0 28px;color:#475569;">
      High-performing employees are recognized through the ENAKO Excellence Award, salary reviews, and accelerated promotion pathways. Your ENAKO OS Performance Dashboard updates in real time — you will always know exactly where you stand and what you need to focus on to grow. We believe in rewarding excellence transparently and fairly.
    </p>

    <!-- CLOSING -->
    <div style="background:linear-gradient(135deg,#f0f9ff,#eff6ff);border:1px solid #bae6fd;border-radius:10px;padding:22px;margin-bottom:8px;">
      <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1c4980;">We are excited to have you on the team, ${firstName}.</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7;">
        You are joining a team of passionate, talented people who are building something that truly matters. We are counting on your talent, your dedication, and your unique perspective. The road ahead will be demanding — but deeply rewarding. Give us your best, and ENAKO will give you the platform, the resources, and the support to grow beyond what you imagined possible.
      </p>
    </div>

    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">Warmly,</p>
    <p style="margin:4px 0 0;font-size:14px;font-weight:800;color:#1c4980;">The ENAKO Human Resources &amp; Leadership Team</p>
    <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">ENAKO Cloud OS · Yaoundé, Cameroon · <a href="mailto:hr@enako.cm" style="color:#2563eb;text-decoration:none;">hr@enako.cm</a></p>

  </div>

  <!-- FOOTER -->
  <div style="background:#1e293b;padding:18px 24px;text-align:center;font-size:11px;color:#64748b;letter-spacing:0.03em;">
    © ${new Date().getFullYear()} ENAKO Cloud OS · All Rights Reserved · Confidential — For ${fullName} Only<br/>
    <a href="https://enakoos.com" style="color:#0ea5e9;text-decoration:none;margin-top:4px;display:inline-block;">enakoos.com</a>
  </div>
</div>
</body>
</html>
    `;

    return this.sendMail(
      toEmail,
      `🎉 Welcome to ENAKO, ${firstName}! Your Onboarding Guide & Login Credentials`,
      html
    );
  }
}
