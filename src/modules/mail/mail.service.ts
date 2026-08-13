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
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin: 0; padding: 16px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; font-size: 16px; }
    a { color: #1d4ed8; text-decoration: underline; word-break: break-all; }
    .header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1d4ed8; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; color: #1e293b; font-weight: 800; }
    .header p { margin: 0; font-size: 15px; color: #475569; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 18px; font-weight: 800; color: #1d4ed8; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.03em; }
    .credentials-box { font-size: 16px; margin-bottom: 20px; line-height: 1.8; }
    .cred-item { margin-bottom: 10px; }
    .cred-label { font-weight: 700; color: #334155; }
    .cred-val { font-weight: 800; color: #0f172a; word-break: break-all; }
    .pwd-highlight { background-color: #fef08a; color: #854d0e; padding: 4px 10px; font-family: monospace; font-size: 18px; font-weight: 800; border-radius: 4px; display: inline-block; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 15px; vertical-align: top; word-break: break-word; }
    th { font-weight: 700; color: #475569; background-color: #f8fafc; }
    ul, ol { margin: 0 0 16px 0; padding-left: 24px; }
    li { margin-bottom: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div style="font-size:12px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:#1d4ed8;margin-bottom:6px;">ENAKO CLOUD OS • HUMAN RESOURCES</div>
    <h1>Welcome to ENAKO, ${firstName}!</h1>
    <p>Official Onboarding Documentation & Employee Guide</p>
  </div>

  <!-- GREETING -->
  <p>Dear <strong>${fullName}</strong>,</p>
  <p>
    On behalf of executive leadership and the entire team, we welcome you to ENAKO as a <strong>${position}</strong> in the <strong>${department} Department</strong>. You were selected for your expertise, leadership potential, and alignment with our corporate mission.
  </p>
  <p>
    This document serves as your official onboarding guide. It outlines your system credentials, departmental expectations, company policies, operational routines, and contact details. Please review each section carefully.
  </p>

  <!-- SECTION 1: CREDENTIALS -->
  <div class="section">
    <h2 class="section-title">Section 1: Your ENAKO Cloud OS Login Credentials</h2>
    <p>Your corporate user account has been provisioned. Access your workspace using the credentials below:</p>
    <div class="credentials-box">
      <div class="cred-item"><span class="cred-label">Login Portal URL:</span> <a href="https://enakoos.com" style="font-weight:800;font-size:17px;">https://enakoos.com</a></div>
      <div class="cred-item"><span class="cred-label">Corporate Login Email:</span> <span class="cred-val">${loginEmail}</span></div>
      <div class="cred-item"><span class="cred-label">Your Login Password:</span> <span class="pwd-highlight">${password}</span></div>
      <div class="cred-item"><span class="cred-label">Assigned Position:</span> <span class="cred-val">${position} (${department})</span></div>
    </div>
    <p style="color:#dc2626;font-size:14px;font-weight:700;">
      SECURITY NOTICE: You can use the password above to log in immediately at <a href="https://enakoos.com">enakoos.com</a>. Please update your password after logging in via Settings -> Security.
    </p>
  </div>

  <!-- SECTION 2: ABOUT ENAKO -->
  <div class="section">
    <h2 class="section-title">Section 2: About ENAKO (Company Overview & Divisions)</h2>
    <p>
      ENAKO is a multi-division financial technology group headquartered in Yaoundé, Cameroon. Our corporate mission is to deliver secure, modern, and accessible financial services to individuals, businesses, and institutions across Africa and the global diaspora. We operate across three distinct business divisions:
    </p>
    
    <p><strong>Division 1: ENAKO Mobile Application (Consumer Fintech)</strong></p>
    <ul>
      <li><strong>Akawo Smart Savings:</strong> Automated high-yield savings plans with flexible schedules.</li>
      <li><strong>Njangi Digital Savings Groups:</strong> Digitized rotating savings and credit associations managed transparently on-app.</li>
      <li><strong>Land Banking and Real Estate:</strong> Structured real estate investment opportunities with fixed annual yields.</li>
      <li><strong>Institutional & Utility Payments:</strong> Tuition, school fees, rent, electricity, water bill settlement, and instant Mobile Money remittances.</li>
    </ul>

    <p><strong>Division 2: ENAKO Outreach Foundation (Social Impact and NGO)</strong></p>
    <p>
      Operating via <a href="https://enakooutreach.cm">enakooutreach.cm</a>, ENAKO Outreach manages non-profit humanitarian and community development initiatives including Charity Fundraising, Academic Scholarships, Infrastructure Development, and Humanitarian Relief.
    </p>

    <p><strong>Division 3: ENAKO FX / OTC (Foreign Exchange Desk)</strong></p>
    <p>
      Institutional Over-The-Counter (OTC) Foreign Exchange desk catering to commercial importers, exporters, and corporate entities requiring outbound international currency settlements (USD, EUR, NGN, USDT).
    </p>
  </div>

  <!-- SECTION 3: CORPORATE STANDARDS -->
  <div class="section">
    <h2 class="section-title">Section 3: Corporate Standards & Code of Conduct</h2>
    <ul>
      <li><strong>Punctuality:</strong> Logged into ENAKO Cloud OS by your scheduled shift start time.</li>
      <li><strong>Confidentiality:</strong> Strict non-disclosure regarding proprietary financial data, code, client lists, and operational metrics.</li>
      <li><strong>Professional Integrity:</strong> High ethical conduct required in all internal and client-facing interactions.</li>
      <li><strong>Information Security:</strong> Always lock or sign out of your workstation when stepping away.</li>
    </ul>
  </div>

  <!-- SECTION 4: DEPARTMENT EXPECTATIONS -->
  <div class="section">
    <h2 class="section-title">Section 4: Department Expectations for ${department}</h2>
    <p>
      As a <strong>${position}</strong> in the <strong>${department} Department</strong>, you are responsible for executing departmental objectives and maintaining high standards of deliverable quality.
    </p>

    ${responsibilities ? `
    <p><strong>Your Core Responsibilities & Duties:</strong></p>
    <div style="white-space:pre-wrap;margin-bottom:16px;line-height:1.7;">${responsibilities}</div>
    ` : ''}

    ${goals ? `
    <p><strong>Your Initial Performance Goals:</strong></p>
    <div style="white-space:pre-wrap;margin-bottom:16px;line-height:1.7;">${goals}</div>
    ` : ''}
  </div>

  <!-- SECTION 5: WEEKLY REPORTS -->
  <div class="section">
    <h2 class="section-title">Section 5: Weekly Activity Reports</h2>
    <p>
      All staff must submit a Weekly Activity Report (WAR) via ENAKO OS every <strong>Friday before 5:00 PM</strong> detailing:
    </p>
    <ol>
      <li>Tasks Completed This Week (with task IDs referenced)</li>
      <li>Tasks In Progress and Expected Delivery Dates</li>
      <li>Operational Blockers and Remediation Requests</li>
      <li>Key Commitments for Upcoming Week</li>
    </ol>
  </div>

  <!-- SECTION 6: STAFF MEALS -->
  <div class="section">
    <h2 class="section-title">Section 6: Staff Meal Subsidy Policy</h2>
    <p>
      ENAKO provides a standard daily meal allowance of <strong>1,000 FCFA</strong> on active working days (50% company subsidy of 500 FCFA / 50% employee contribution of 500 FCFA). Log daily meals under "Staff Meals" in ENAKO OS by end of shift.
    </p>
  </div>

  <!-- SECTION 7: SUPPORT & CONTACTS -->
  <div class="section">
    <h2 class="section-title">Section 7: Management & Support Contact</h2>
    <p>For all HR inquiries, technical assistance, onboarding support, and executive escalations, please contact Management directly:</p>
    <table>
      <thead>
        <tr>
          <th>Department / Scope</th>
          <th>Support Email</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Management & Support (HR, IT, Operations, Executive)</td>
          <td><a href="mailto:enakomgt@gmail.com" style="font-weight:700;font-size:16px;">enakomgt@gmail.com</a></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- CLOSING & FOOTER -->
  <div class="footer">
    <p style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 8px 0;">Welcome aboard, ${firstName}.</p>
    <p style="margin:0 0 16px 0;">We look forward to your contributions toward ENAKO's growth and operational success.</p>
    <p style="margin:0;"><strong>ENAKO Executive Management & Human Resources</strong></p>
    <p style="margin:4px 0 0 0;">ENAKO Cloud OS • Yaoundé, Cameroon • <a href="mailto:enakomgt@gmail.com">enakomgt@gmail.com</a></p>
    <p style="margin:16px 0 0 0;font-size:12px;">© ${new Date().getFullYear()} ENAKO Cloud OS • Confidential • Prepared for ${fullName} • <a href="https://enakoos.com">https://enakoos.com</a></p>
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

