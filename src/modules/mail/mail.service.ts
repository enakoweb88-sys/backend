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
    // Explicitly use production verified Gmail SMTP credentials
    const host = 'smtp.gmail.com';
    const port = 587;
    const user = 'enakosupport@gmail.com';
    const pass = 'drsg gmlk hqfz kwev';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
    this.logger.log(`SMTP Mailer initialized using ${host}:${port} (${user})`);
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
    const refCode = Math.floor(1000 + Math.random() * 9000);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1c4980 0%,#1d4ed8 60%,#0ea5e9 100%);padding:40px 32px;text-align:center;color:#fff;">
    <div style="font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;opacity:0.75;margin-bottom:10px;">ENAKO CLOUD OS . HUMAN RESOURCES</div>
    <h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:0.02em;">Welcome to ENAKO, ${firstName}</h1>
    <p style="margin:10px 0 0;font-size:14px;opacity:0.85;line-height:1.5;">Official Onboarding Documentation and Employee Guide</p>
  </div>

  <!-- BODY -->
  <div style="padding:36px 32px;color:#1e293b;line-height:1.75;font-size:14px;">

    <!-- GREETING -->
    <p style="font-size:15px;margin:0 0 20px;">Dear <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;">
      On behalf of executive leadership and the entire team, we welcome you to ENAKO as a <strong>${position}</strong> in the <strong>${department} Department</strong>. You were selected for your expertise, leadership potential, and alignment with our corporate mission.
    </p>
    <p style="margin:0 0 28px;color:#475569;">
      This document serves as your official onboarding guide. It outlines your system credentials, departmental expectations, company policies, operational routines, and dashboard navigation instructions. Please review each section carefully.
    </p>

    <!-- SECTION 1: LOGIN CREDENTIALS -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:15px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;">Section 1: Your ENAKO Cloud OS Credentials</h2>
      <p style="margin:0 0 12px;color:#475569;">Your corporate user account has been provisioned. Access your workspace using the credentials below:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #bae6fd;"><td style="padding:9px 8px;font-weight:700;color:#0369a1;width:160px;">Portal URL</td><td style="padding:9px 8px;"><a href="https://enakoos.com" style="color:#0369a1;font-weight:700;">https://enakoos.com</a></td></tr>
        <tr style="border-bottom:1px solid #bae6fd;"><td style="padding:9px 8px;font-weight:700;color:#0369a1;">Corporate Email</td><td style="padding:9px 8px;font-weight:800;color:#1e293b;">${loginEmail}</td></tr>
        <tr><td style="padding:9px 8px;font-weight:700;color:#0369a1;">Temporary Password</td><td style="padding:9px 8px;font-weight:800;color:#dc2626;font-family:monospace;font-size:15px;">${password}</td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:#dc2626;font-weight:700;">SECURITY NOTICE: You are required to update your temporary password immediately upon your initial login via Settings -> Security.</p>
    </div>

    <!-- SECTION 2: ABOUT ENAKO -->
    <h2 style="font-size:15px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Section 2: About ENAKO (Company Overview and Business Divisions)</h2>
    <p style="margin:0 0 14px;color:#475569;">
      ENAKO is a multi-division financial technology group headquartered in Yaoundé, Cameroon. Our corporate mission is to deliver secure, modern, and accessible financial services to individuals, businesses, and institutions across Africa and the global diaspora. We operate across three distinct business divisions:
    </p>

    <!-- DIVISION 1: MOBILE APP -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px;margin-bottom:18px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#1d4ed8;">Division 1: ENAKO Mobile Application (Consumer Fintech)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        Our flagship mobile platform available on iOS and Android. Key features include:
      </p>
      <ul style="margin:0;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>Akawo Smart Savings:</strong> Automated high-yield savings plans with flexible daily, weekly, or monthly schedules.</li>
        <li><strong>Njangi Digital Savings Groups:</strong> Digitized rotating savings and credit associations managed transparently on-app.</li>
        <li><strong>Land Banking and Real Estate:</strong> Structured real estate investment opportunities with fixed annual yields of 12% per annum.</li>
        <li><strong>Institutional Payments:</strong> Automated payment processing for tuition, school fees, and residential rent.</li>
        <li><strong>Utility Payments:</strong> Instant bill settlement for electricity, water, and essential public utilities.</li>
        <li><strong>Remittances:</strong> High-speed local Mobile Money transfers (MTN MoMo, Orange Money) and international diaspora transfers.</li>
      </ul>
    </div>

    <!-- DIVISION 2: NGO OUTREACH -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin-bottom:18px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#15803d;">Division 2: ENAKO Outreach Foundation (Social Impact and NGO)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        Operating via <a href="https://enakooutreach.cm" style="color:#15803d;font-weight:700;">enakooutreach.cm</a>, ENAKO Outreach manages non-profit humanitarian and community development initiatives:
      </p>
      <ul style="margin:0;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>Charity Fundraising:</strong> Public and private fundraising campaigns for community medical, social, and developmental causes.</li>
        <li><strong>Academic Scholarships:</strong> Merit and need-based financial awards for underprivileged primary, secondary, and university students.</li>
        <li><strong>Infrastructure Development:</strong> Clean water boreholes, school renovations, and civic development projects.</li>
        <li><strong>Humanitarian Relief:</strong> Rapid emergency response and resource deployment during natural or social crises.</li>
      </ul>
    </div>

    <!-- DIVISION 3: FX / OTC -->
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#713f12;">Division 3: ENAKO FX / OTC (Foreign Exchange Desk)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        Our institutional Over-The-Counter (OTC) Foreign Exchange desk catering to commercial importers, exporters, and corporate entities requiring outbound international settlements.
      </p>
      <ul style="margin:0 0 14px;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>Outbound Settlements:</strong> Foreign currency payments for international supplier invoices and contracts.</li>
        <li><strong>Traded Currencies:</strong> US Dollar (USD), Euro (EUR), Nigerian Naira (NGN), and USDT (Tether).</li>
        <li><strong>Compliance:</strong> Strict KYC and anti-money laundering (AML) protocols applied to all institutional transactions.</li>
      </ul>
    </div>

    <!-- SECTION 3: COMPANY RULES -->
    <h2 style="font-size:15px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Section 3: Corporate Standards and Code of Conduct</h2>
    <ul style="margin:0 0 16px;padding-left:20px;color:#475569;line-height:2;">
      <li><strong>Punctuality:</strong> Logged into ENAKO Cloud OS by your scheduled shift start time.</li>
      <li><strong>Confidentiality:</strong> Strict non-disclosure regarding proprietary financial data, code, client lists, and operational metrics.</li>
      <li><strong>Professional Integrity:</strong> High ethical conduct required in all internal and client-facing interactions.</li>
      <li><strong>Information Security:</strong> Always lock or sign out of your workstation when stepping away.</li>
    </ul>

    <!-- SECTION 4: DEPARTMENT EXPECTATIONS -->
    <h2 style="font-size:15px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Section 4: Department Expectations for ${department}</h2>
    <p style="margin:0 0 12px;color:#475569;">
      As a <strong>${position}</strong> in the <strong>${department} Department</strong>, you are responsible for executing departmental objectives and maintaining high standards of deliverable quality.
    </p>

    ${responsibilities ? `
    <div style="background:#f8fafc;border-left:4px solid #1c4980;padding:16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:13px;color:#1c4980;font-weight:700;">Assigned Core Responsibilities:</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${responsibilities}</p>
    </div>` : ''}

    ${goals ? `
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:6px;margin:16px 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#15803d;font-weight:700;">Initial Performance Goals:</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${goals}</p>
    </div>` : ''}

    <!-- SECTION 5: WEEKLY REPORTS -->
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:#713f12;text-transform:uppercase;letter-spacing:0.05em;">Section 5: Weekly Activity Reports</h2>
      <p style="margin:0 0 12px;color:#475569;">
        All staff must submit a Weekly Activity Report (WAR) via ENAKO OS every <strong>Friday before 5:00 PM</strong>.
      </p>
      <ol style="margin:0 0 14px;padding-left:20px;color:#475569;line-height:2;">
        <li>Tasks Completed This Week (with task IDs referenced)</li>
        <li>Tasks In Progress and Expected Delivery Dates</li>
        <li>Operational Blockers and Remediation Requests</li>
        <li>Key Commitments for Upcoming Week</li>
      </ol>
    </div>

    <!-- SECTION 6: STAFF MEALS -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:#14532d;text-transform:uppercase;letter-spacing:0.05em;">Section 6: Staff Meal Subsidy Policy</h2>
      <p style="margin:0 0 12px;color:#475569;">
        ENAKO provides a standard daily meal allowance of <strong>1,000 FCFA</strong> on active working days.
      </p>
      <ul style="margin:0 0 14px;padding-left:20px;color:#166534;line-height:2;font-size:13px;">
        <li>Company Subsidy: 50% (500 FCFA per working day).</li>
        <li>Employee Contribution: 50% (500 FCFA per working day).</li>
        <li>Daily Logging Requirement: Log your daily meal under "Staff Meals" in ENAKO OS by end of shift.</li>
      </ul>
    </div>

    <!-- SECTION 7: CONTACTS -->
    <h2 style="font-size:15px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Section 7: Key Departmental Contacts</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
      <thead><tr style="background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">
        <th style="padding:9px 10px;text-align:left;">Department</th>
        <th style="padding:9px 10px;text-align:left;">Scope</th>
        <th style="padding:9px 10px;text-align:left;">Email</th>
      </tr></thead>
      <tbody>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">Human Resources</td><td style="padding:9px 10px;color:#64748b;">Onboarding, Leave, Policy</td><td style="padding:9px 10px;"><a href="mailto:hr@enako.cm" style="color:#2563eb;">hr@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">IT &amp; Systems</td><td style="padding:9px 10px;color:#64748b;">Accounts, Security, Technical</td><td style="padding:9px 10px;"><a href="mailto:it@enako.cm" style="color:#2563eb;">it@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">Finance</td><td style="padding:9px 10px;color:#64748b;">Payroll, Expenses, Meals</td><td style="padding:9px 10px;"><a href="mailto:finance@enako.cm" style="color:#2563eb;">finance@enako.cm</a></td></tr>
        <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:9px 10px;font-weight:600;">Executive Office</td><td style="padding:9px 10px;color:#64748b;">Escalations &amp; Operations</td><td style="padding:9px 10px;"><a href="mailto:ceo@enako.cm" style="color:#2563eb;">ceo@enako.cm</a></td></tr>
      </tbody>
    </table>

    <!-- CLOSING -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:22px;margin-bottom:8px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1c4980;">Welcome aboard, ${firstName}.</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7;">
        We look forward to your contributions toward ENAKO's growth and operational success.
      </p>
    </div>

    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">Regards,</p>
    <p style="margin:4px 0 0;font-size:14px;font-weight:800;color:#1c4980;">ENAKO Executive Management &amp; Human Resources</p>
    <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">ENAKO Cloud OS . Yaoundé, Cameroon . <a href="mailto:hr@enako.cm" style="color:#2563eb;text-decoration:none;">hr@enako.cm</a></p>

  </div>

  <!-- FOOTER -->
  <div style="background:#1e293b;padding:18px 24px;text-align:center;font-size:11px;color:#64748b;letter-spacing:0.03em;">
    © ${new Date().getFullYear()} ENAKO Cloud OS . Confidential . Prepared for ${fullName}<br/>
    <a href="https://enakoos.com" style="color:#0ea5e9;text-decoration:none;margin-top:4px;display:inline-block;">https://enakoos.com</a>
  </div>
</div>
</body>
</html>
    `;

    return this.sendMail(
      toEmail,
      `Welcome to ENAKO, ${firstName} | Onboarding Documentation [Ref: #${refCode}]`,
      html
    );
  }
}
