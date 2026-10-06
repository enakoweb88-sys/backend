import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_SENDERS,
  DEFAULT_REPLY_TO,
  VERIFIED_EMAIL_DOMAIN,
  EmailSenderType,
  getSenderAddress,
} from './mail.constants';
import { SendEmailOptions, SendEmailResult } from './mail.interfaces';
import { buildBrandedEmail } from './templates/email-template.builder';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private readonly apiKeyConfigured: boolean = false;
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const apiKey = (this.config.get<string>('RESEND_API_KEY') || process.env.RESEND_API_KEY || '').trim();

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.apiKeyConfigured = true;
      this.logger.log(
        `Resend transactional mail service initialized with verified domain: ${VERIFIED_EMAIL_DOMAIN}`,
      );
    } else {
      this.logger.log('RESEND_API_KEY is not set. SMTP delivery channel active.');
    }

    const smtpHost = this.config.get<string>('SMTP_HOST') || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(this.config.get<string>('SMTP_PORT') || process.env.SMTP_PORT || '587', 10);
    const smtpUser = this.config.get<string>('SMTP_USER') || process.env.SMTP_USER || 'enakosupport@gmail.com';
    const smtpPass = this.config.get<string>('SMTP_PASS') || process.env.SMTP_PASS || 'drsg gmlk hqfz kwev';

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false },
      });
      this.logger.log(`Nodemailer SMTP mail transporter initialized (${smtpUser} via ${smtpHost}:${smtpPort})`);
    } catch (e: any) {
      this.logger.warn(`Could not initialize nodemailer transporter: ${e?.message}`);
    }
  }

  /**
   * Primary central method to send transactional emails via Resend with SMTP fallback.
   * Safe execution: Never throws unhandled exceptions to avoid breaking business operations.
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const cleanRecipients = recipients
      .map((r) => r?.trim().toLowerCase())
      .filter((r): r is string => Boolean(r && r.includes('@')));

    if (cleanRecipients.length === 0) {
      this.logger.warn(`Email sending aborted: No valid recipient email provided for subject "${options.subject}"`);
      return { success: false, error: 'No valid recipient email address' };
    }

    // Resolve Sender Address under verified domain
    const senderType: EmailSenderType = options.senderType || 'NOTIFICATIONS';
    const fromAddress = options.from || getSenderAddress(senderType);

    // Resolve Reply-To (Default: support@enakoos.com; NOREPLY does not set replyTo unless specified)
    let replyToAddress: string | undefined = options.replyTo;
    if (!replyToAddress && senderType !== 'NOREPLY') {
      replyToAddress = DEFAULT_REPLY_TO;
    }

    const recipientLogStr = cleanRecipients.join(', ');
    this.logger.log(`Attempting email dispatch -> To: [${recipientLogStr}] | Subject: "${options.subject}" | From: ${fromAddress}`);

    let lastError: string | undefined;

    // 1. Attempt dispatch via Resend if API key is configured
    if (this.resend && this.apiKeyConfigured) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: fromAddress,
          to: cleanRecipients,
          subject: options.subject,
          html: options.html,
          text: options.text || options.subject,
          replyTo: replyToAddress,
          attachments: options.attachments,
          tags: options.tag ? [{ name: 'category', value: options.tag }] : undefined,
        });

        if (!error && data?.id) {
          const messageId = data.id;
          this.logger.log(
            `Email successfully dispatched via Resend -> To: [${recipientLogStr}] (MessageId: ${messageId})`,
          );

          await this.logEmailAudit({
            recipients: cleanRecipients,
            subject: options.subject,
            sender: fromAddress,
            success: true,
            messageId,
            tag: options.tag,
            actorId: options.actorId,
          });

          return { success: true, messageId };
        } else if (error) {
          this.logger.warn(
            `Resend delivery notice for [${recipientLogStr}]: ${error.message}. Proceeding to SMTP channel...`,
          );
          lastError = error.message;
        }
      } catch (err: any) {
        this.logger.warn(
          `Resend exception for [${recipientLogStr}]: ${err?.message || err}. Proceeding to SMTP channel...`,
        );
        lastError = err?.message;
      }
    }

    // 2. Dispatch via Nodemailer SMTP (Live guaranteed delivery)
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: fromAddress,
          to: cleanRecipients,
          subject: options.subject,
          html: options.html,
          text: options.text || options.subject,
          replyTo: replyToAddress || 'cash@enakoos.com',
          attachments: options.attachments,
        });

        const messageId = info.messageId || `smtp_${Date.now()}`;
        this.logger.log(
          `Email successfully dispatched via SMTP -> To: [${recipientLogStr}] (MessageId: ${messageId})`,
        );

        await this.logEmailAudit({
          recipients: cleanRecipients,
          subject: options.subject,
          sender: fromAddress,
          success: true,
          messageId,
          tag: options.tag,
          actorId: options.actorId,
        });

        return { success: true, messageId };
      } catch (smtpErr: any) {
        this.logger.error(
          `SMTP dispatch failed for [${recipientLogStr}]: ${smtpErr?.message || smtpErr}`,
        );
        lastError = smtpErr?.message;
      }
    }

    // 3. Fallback audit record if all dispatch channels failed
    await this.logEmailAudit({
      recipients: cleanRecipients,
      subject: options.subject,
      sender: fromAddress,
      success: false,
      error: lastError || 'All dispatch methods failed',
      tag: options.tag,
      actorId: options.actorId,
    });
    return { success: false, error: lastError || 'Email delivery failed' };
  }

  /**
   * Backward-compatible sendMail method used by existing legacy callers.
   */
  async sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
      senderType: 'NOTIFICATIONS',
    });
    return result.success;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KYC TRANSACTIONAL EMAILS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sent immediately when a client KYC submission is created.
   * From: kyc@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendKycSubmissionReceived(toEmail: string, applicantName: string, submissionId: string) {
    const refCode = submissionId.slice(-6).toUpperCase();
    const html = buildBrandedEmail({
      badge: 'KYC VERIFICATION',
      badgeColor: '#001f5b',
      headerTitle: 'ENAKO COMPLIANCE',
      headerSubtitle: 'Client Identity Verification Desk',
      recipientName: applicantName,
      headline: 'We Have Received Your KYC Submission',
      messageHtml: `
        <p>Thank you for submitting your identity verification documents to ENAKO.</p>
        <p>Our compliance and verification team has received your submission and is actively reviewing the uploaded documentation in accordance with regulatory KYC standards.</p>
      `,
      keyDetails: [
        { label: 'Tracking Code', value: `#${refCode}`, isHighlight: true },
        { label: 'Current Status', value: 'Under Active Review' },
        { label: 'Expected Window', value: '24 to 48 business hours' },
      ],
      calloutNote: {
        title: 'Verification In Progress',
        text: 'You will receive an automated notification as soon as compliance review is complete. No further action is required from you at this time.',
        variant: 'info',
      },
      ctaButton: {
        label: 'Check Verification Status',
        url: 'https://kyc.enakoos.com',
      },
    });

    return this.sendEmail({
      to: toEmail,
      subject: `KYC Submission Received [Ref: #${refCode}] - ENAKO`,
      html,
      senderType: 'KYC',
      tag: 'kyc_received',
    });
  }

  /**
   * Sent when a KYC submission is approved by compliance officers.
   * From: kyc@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendKycApproved(toEmail: string, applicantName: string) {
    const html = buildBrandedEmail({
      badge: 'VERIFICATION APPROVED',
      badgeColor: '#16a34a',
      headerTitle: 'ENAKO COMPLIANCE',
      headerSubtitle: 'Client Identity Verification Desk',
      recipientName: applicantName,
      headline: 'Your KYC Verification Has Been Approved',
      messageHtml: `
        <p>Your client identity verification has been successfully reviewed and <strong>approved</strong> by our compliance team.</p>
        <p>All compliance restrictions have been lifted from your account, giving you full access to ENAKO platform services, higher transaction thresholds, and unrestricted operations.</p>
      `,
      keyDetails: [
        { label: 'Compliance Status', value: 'Verified & Approved', isHighlight: true },
        { label: 'Account Tier', value: 'Full Operational Access' },
      ],
      ctaButton: {
        label: 'Access Your Account',
        url: 'https://enakoos.com',
        color: '#16a34a',
      },
    });

    return this.sendEmail({
      to: toEmail,
      subject: 'Your KYC Verification Has Been Approved - ENAKO',
      html,
      senderType: 'KYC',
      tag: 'kyc_approved',
    });
  }

  /**
   * Sent when a KYC submission is rejected or requires updated documentation.
   * From: kyc@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendKycRejected(toEmail: string, applicantName: string, reason?: string) {
    const html = buildBrandedEmail({
      badge: 'ACTION REQUIRED',
      badgeColor: '#dc2626',
      headerTitle: 'ENAKO COMPLIANCE',
      headerSubtitle: 'Client Identity Verification Desk',
      recipientName: applicantName,
      headline: 'Action Required: Your KYC Verification Status',
      messageHtml: `
        <p>Thank you for submitting your KYC verification request. During our compliance review, our team encountered an issue preventing the approval of your submission.</p>
        <p>Please review the details below and re-submit your updated documentation at your earliest convenience.</p>
      `,
      calloutNote: {
        title: 'Reason for Status Update',
        text: reason || 'Uploaded identification documents were unclear or expired. Please upload a clear, valid National ID Card (CNI) or passport.',
        variant: 'danger',
      },
      ctaButton: {
        label: 'Update Your Documents',
        url: 'https://kyc.enakoos.com',
        color: '#dc2626',
      },
    });

    return this.sendEmail({
      to: toEmail,
      subject: 'Action Required: Your KYC Verification Status - ENAKO',
      html,
      senderType: 'KYC',
      tag: 'kyc_rejected',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TASK & EMPLOYEE EMAILS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sent when a new task is assigned to an employee.
   * From: notifications@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendTaskAssignedAlert(opts: {
    toEmail: string;
    assigneeName: string;
    assignerName: string;
    taskTitle: string;
    priority?: string;
    dueDate?: Date | null;
    description?: string | null;
  }) {
    const dueDateFormatted = opts.dueDate ? new Date(opts.dueDate).toLocaleDateString() : 'No specific deadline set';
    const html = buildBrandedEmail({
      badge: 'TASK ASSIGNMENT',
      badgeColor: '#001f5b',
      headerTitle: 'ENAKO OS',
      headerSubtitle: 'Operations & Workflow',
      recipientName: opts.assigneeName,
      headline: opts.taskTitle,
      messageHtml: `
        <p>You have been assigned a new operational task by <strong>${opts.assignerName}</strong>.</p>
        ${opts.description ? `<p style="color: #475569; font-style: italic; margin: 12px 0;">"${opts.description}"</p>` : ''}
      `,
      keyDetails: [
        { label: 'Task Title', value: opts.taskTitle, isHighlight: true },
        { label: 'Priority', value: opts.priority || 'NORMAL' },
        { label: 'Due Date', value: dueDateFormatted },
        { label: 'Assigned By', value: opts.assignerName },
      ],
      ctaButton: {
        label: 'View Task in ENAKO OS',
        url: 'https://enakoos.com/#/tasks',
      },
    });

    return this.sendEmail({
      to: opts.toEmail,
      subject: `New task assigned to you: ${opts.taskTitle}`,
      html,
      senderType: 'NOTIFICATIONS',
      tag: 'task_assigned',
    });
  }

  /**
   * Sent to new team members with their initial onboarding documentation & credentials.
   * From: notifications@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  /**
   * Sent to new team members with their initial onboarding documentation & credentials.
   * Full comprehensive onboarding packet including company overview, code of conduct,
   * weekly reporting protocol, meal subsidies, credentials, and custom manager inputs.
   * From: notifications@mail.enakoos.com | Reply-To: support@enakoos.com
   */
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

    const messageHtml = `
      <p>On behalf of executive leadership and the entire team, we welcome you to ENAKO as a <strong>${position}</strong> in the <strong>${department} Department</strong>. You were selected for your expertise, leadership potential, and alignment with our corporate mission.</p>
      
      <p>This document serves as your official onboarding guide. It outlines your system credentials, departmental expectations, company policies, operational routines, and contact details. Please review each section carefully.</p>

      <!-- SECTION 1: CREDENTIALS -->
      <div style="margin-top: 28px;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 1: Access Credentials</div>
        <p style="margin: 0 0 12px 0;">Your corporate user account has been provisioned. Access your workspace using the credentials below:</p>
      </div>

      <!-- SECTION 2: COMPANY OVERVIEW -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 2: About ENAKO (Company Overview &amp; Divisions)</div>
        <p>ENAKO is a multi-division financial technology group headquartered in Yaoundé, Cameroon. Our corporate mission is to deliver secure, modern, and accessible financial services to individuals, businesses, and institutions across Africa and the global diaspora. We operate across three distinct business divisions:</p>
        
        <p style="margin-bottom: 6px;"><strong>Division 1: ENAKO Mobile Application (Consumer Fintech)</strong></p>
        <ul style="margin: 0 0 12px 0; padding-left: 20px;">
          <li><strong>Akawo Smart Savings:</strong> Automated high-yield savings plans with flexible schedules.</li>
          <li><strong>Njangi Digital Savings Groups:</strong> Digitized rotating savings and credit associations managed transparently on-app.</li>
          <li><strong>Land Banking and Real Estate:</strong> Structured real estate investment opportunities with fixed annual yields.</li>
          <li><strong>Institutional &amp; Utility Payments:</strong> Tuition, school fees, rent, utility bill settlements, and instant Mobile Money remittances.</li>
        </ul>

        <p style="margin-bottom: 6px;"><strong>Division 2: ENAKO Outreach Foundation (Social Impact and NGO)</strong></p>
        <p style="margin-top: 0;">Operating via <a href="https://enakooutreach.cm" style="color: #00adb2; font-weight: 600; text-decoration: none;">enakooutreach.cm</a>, ENAKO Outreach manages non-profit humanitarian and community development initiatives including Charity Fundraising, Academic Scholarships, Infrastructure Development, and Emergency Relief.</p>

        <p style="margin-bottom: 6px;"><strong>Division 3: ENAKO FX / OTC (Foreign Exchange Desk)</strong></p>
        <p style="margin-top: 0;">Institutional Over-The-Counter (OTC) Foreign Exchange desk catering to commercial importers, exporters, and corporate entities requiring outbound international currency settlements (USD, EUR, NGN, USDT).</p>
      </div>

      <!-- SECTION 3: CODE OF CONDUCT -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 3: Corporate Standards &amp; Code of Conduct</div>
        <ul style="margin: 0 0 16px 0; padding-left: 20px;">
          <li><strong>Punctuality:</strong> Logged into ENAKO Cloud OS by your scheduled shift start time.</li>
          <li><strong>Confidentiality:</strong> Strict non-disclosure regarding proprietary financial data, internal code, client lists, and operational metrics.</li>
          <li><strong>Professional Integrity:</strong> High ethical conduct required in all internal and client-facing interactions.</li>
          <li><strong>Information Security:</strong> Always lock or sign out of your workstation when stepping away.</li>
        </ul>
      </div>

      <!-- SECTION 4: DEPARTMENT EXPECTATIONS -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 4: Department Expectations for ${department}</div>
        <p>As a <strong>${position}</strong> in the <strong>${department} Department</strong>, you are responsible for executing departmental objectives and maintaining high standards of deliverable quality.</p>

        ${responsibilities ? `
        <div style="margin: 16px 0;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Your Core Responsibilities &amp; Duties:</div>
          <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #475569; background: #fafafa; padding: 14px 16px; border-radius: 6px;">${responsibilities}</div>
        </div>
        ` : ''}

        ${goals ? `
        <div style="margin: 16px 0;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Your Initial Performance Goals:</div>
          <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #475569; background: #fafafa; padding: 14px 16px; border-radius: 6px;">${goals}</div>
        </div>
        ` : ''}
      </div>

      <!-- SECTION 5: WEEKLY ACTIVITY REPORTS -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 5: Weekly Activity Reports (WAR)</div>
        <p>All staff must submit a Weekly Activity Report via ENAKO OS every <strong>Friday before 5:00 PM</strong> detailing:</p>
        <ol style="margin: 0 0 16px 0; padding-left: 20px;">
          <li>Tasks Completed This Week (with task IDs referenced)</li>
          <li>Tasks In Progress and Expected Delivery Dates</li>
          <li>Operational Blockers and Remediation Requests</li>
          <li>Key Commitments for Upcoming Week</li>
        </ol>
      </div>

      <!-- SECTION 6: STAFF MEAL SUBSIDY -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 6: Staff Meal Subsidy Policy</div>
        <p>ENAKO provides a standard daily meal allowance of <strong>1,000 FCFA</strong> on active working days (50% company subsidy of 500 FCFA / 50% employee contribution of 500 FCFA). Log daily meals under "Staff Meals" in ENAKO OS by the end of your shift.</p>
      </div>

      <!-- SECTION 7: MANAGEMENT & SUPPORT -->
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
        <div style="font-size: 13px; font-weight: 800; color: #00adb2; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">Section 7: Management &amp; Support Contact</div>
        <p>For all HR inquiries, technical assistance, onboarding support, and executive escalations, please contact Management directly at <a href="mailto:support@enakoos.com" style="color: #00adb2; font-weight: 700; text-decoration: none;">support@enakoos.com</a>.</p>
      </div>
    `;

    const html = buildBrandedEmail({
      badge: 'ONBOARDING',
      badgeColor: '#001f5b',
      headerTitle: 'ENAKO OS',
      headerSubtitle: 'Human Resources & Talent Management',
      recipientName: fullName,
      headline: `Welcome to ENAKO, ${firstName}!`,
      messageHtml,
      keyDetails: [
        { label: 'Login Portal', value: '<a href="https://enakoos.com" style="color: #00adb2; font-weight: 700; text-decoration: none;">https://enakoos.com</a>' },
        { label: 'Corporate Email', value: loginEmail, isHighlight: true },
        { label: 'Initial Password', value: `<span style="font-family: monospace; font-size: 14px; font-weight: 800; color: #0f172a; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${password}</span>` },
        { label: 'Position & Dept', value: `${position} (${department})` },
      ],
      calloutNote: {
        title: 'Security Notice',
        text: 'Please log in to your account and update your initial password immediately via Settings &rarr; Security.',
        variant: 'warning',
      },
      ctaButton: {
        label: 'Log In to ENAKO OS',
        url: 'https://enakoos.com',
      },
      footerNote: `Official employee onboarding guide [Ref: #${refCode}]. Prepared for ${fullName}.`,
    });

    return this.sendEmail({
      to: toEmail,
      subject: `Welcome to ENAKO, ${firstName} | Official Onboarding Guide & Credentials [Ref: #${refCode}]`,
      html,
      senderType: 'NOTIFICATIONS',
      tag: 'welcome_onboarding',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SECURITY & AUTHENTICATION EMAILS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sent when a user's password has been updated.
   * From: security@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendPasswordChangedAlert(toEmail: string, fullName: string, ip?: string) {
    const html = buildBrandedEmail({
      badge: 'SECURITY ALERT',
      badgeColor: '#dc2626',
      headerTitle: 'ENAKO SECURITY',
      headerSubtitle: 'Account Access & Authentication Sentinel',
      recipientName: fullName,
      headline: 'Your ENAKO OS Account Password Was Changed',
      messageHtml: `
        <p>This is an automated security alert to confirm that the password for your ENAKO OS account (<strong>${toEmail}</strong>) was changed successfully.</p>
        <p>If you initiated this change, you can safely disregard this email.</p>
      `,
      calloutNote: {
        title: 'Did not authorize this change?',
        text: `If you did not change your password, your account may be compromised. Please revoke active sessions in Settings or contact support immediately at support@enakoos.com.<br/><br/><small style="color: #64748b;">Recorded at: ${new Date().toUTCString()}${ip ? ` | IP: ${ip}` : ''}</small>`,
        variant: 'danger',
      },
      ctaButton: {
        label: 'Inspect Active Sessions',
        url: 'https://enakoos.com/#/settings',
        color: '#dc2626',
      },
      footerNote: 'This security dispatch was triggered automatically by ENAKO OS Security Sentinel.',
    });

    return this.sendEmail({
      to: toEmail,
      subject: 'Security Alert: Your ENAKO OS Password Was Changed',
      html,
      senderType: 'SECURITY',
      tag: 'security_password_changed',
    });
  }

  /**
   * Sent when a corporate email address has been modified by HR or Admin.
   * From: security@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendCorporateEmailUpdated(newEmail: string, fullName: string, oldEmail: string) {
    const html = buildBrandedEmail({
      badge: 'EMAIL UPDATE',
      badgeColor: '#001f5b',
      headerTitle: 'ENAKO OS',
      headerSubtitle: 'Corporate Identity Administration',
      recipientName: fullName,
      headline: 'Your Corporate Email Address Has Been Updated',
      messageHtml: `
        <p>Your official corporate email address has been updated by the system administrator.</p>
        <p>Please use your new corporate email address for all future logins to ENAKO OS. Your password remains unchanged.</p>
      `,
      keyDetails: [
        { label: 'Previous Email', value: `<span style="text-decoration: line-through; color: #94a3b8;">${oldEmail}</span>` },
        { label: 'New Corporate Email', value: newEmail, isHighlight: true },
      ],
      calloutNote: {
        title: 'Security Alert',
        text: 'If you did not expect or authorize this change, contact support@enakoos.com immediately.',
        variant: 'info',
      },
      ctaButton: {
        label: 'Log In with New Email',
        url: 'https://enakoos.com',
      },
    });

    return this.sendEmail({
      to: newEmail,
      subject: 'Your ENAKO Corporate Email Address Has Been Updated',
      html,
      senderType: 'SECURITY',
      tag: 'security_email_updated',
    });
  }

  /**
   * Monthly mandatory password security reminder cron notification.
   * From: security@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendMonthlyPasswordReminder(toEmail: string, fullName: string) {
    const html = buildBrandedEmail({
      badge: 'SECURITY COMPLIANCE',
      badgeColor: '#eab308',
      headerTitle: 'ENAKO SECURITY',
      headerSubtitle: 'Mandatory Monthly Password Refresh',
      recipientName: fullName || 'Team Member',
      headline: 'Monthly Security Reminder: Time to Update Your Password',
      messageHtml: `
        <p>As part of ENAKO OS corporate security policy, all active staff members are required to refresh their account password every month to safeguard enterprise operations and client data.</p>
      `,
      calloutNote: {
        title: 'Password Security Requirements',
        text: 'Minimum 8 characters with a mix of uppercase letters, lowercase letters, numbers, and symbols. Do not reuse previous passwords.',
        variant: 'warning',
      },
      ctaButton: {
        label: 'Update Your Password Now',
        url: 'https://enakoos.com/#/settings',
        color: '#0f172a',
      },
    });

    return this.sendEmail({
      to: toEmail,
      subject: '🔐 ENAKO OS Security Alert: Monthly Password Update Reminder',
      html,
      senderType: 'SECURITY',
      tag: 'security_monthly_password_reminder',
    });
  }

  /**
   * Critical security breach or incident alert dispatch.
   * From: security@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendSecurityBreachAlert(
    incidentType: string,
    details: { ip?: string; email?: string; reason?: string; timestamp?: Date },
  ) {
    const breachRecipient = this.config.get<string>('SECURITY_ALERT_EMAIL') || 'security@enakoos.com';
    const timestampStr = details.timestamp ? new Date(details.timestamp).toUTCString() : new Date().toUTCString();

    const html = buildBrandedEmail({
      badge: 'CRITICAL ALERT',
      badgeColor: '#dc2626',
      headerTitle: 'ENAKO SECURITY SENTINEL',
      headerSubtitle: 'Incident Detection & Telemetry',
      headline: `Security Incident Detected: ${incidentType}`,
      messageHtml: `
        <p>A security boundary violation or suspicious authentication event was intercepted by the ENAKO OS Security Sentinel.</p>
      `,
      keyDetails: [
        { label: 'Incident Type', value: incidentType, isHighlight: true },
        { label: 'Target Identity', value: details.email || 'Unauthenticated / Anonymous' },
        { label: 'Origin IP', value: details.ip || 'Unknown IP' },
        { label: 'Timestamp', value: timestampStr },
        { label: 'Trigger Reason', value: details.reason || 'Unauthorized security violation' },
      ],
      ctaButton: {
        label: 'Inspect Security Audit Logs',
        url: 'https://enakoos.com/#/audit-logs',
        color: '#dc2626',
      },
    });

    return this.sendEmail({
      to: breachRecipient,
      subject: `🚨 CRITICAL SECURITY BREACH ALERT: ${incidentType}`,
      html,
      senderType: 'SECURITY',
      tag: 'security_breach_alert',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SYSTEM & NOTIFICATION EMAILS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * General in-app notification mirror email.
   * From: notifications@mail.enakoos.com | Reply-To: support@enakoos.com
   */
  async sendNotificationAlert(toEmail: string, title: string, body: string, link?: string) {
    const html = buildBrandedEmail({
      badge: 'NOTIFICATION',
      badgeColor: '#001f5b',
      headerTitle: 'ENAKO OS',
      headerSubtitle: 'System & Operations Alert',
      headline: title,
      messageHtml: `<p>${body}</p>`,
      ctaButton: link
        ? {
            label: 'View Notification Details',
            url: link.startsWith('http') ? link : `https://enakoos.com#${link}`,
          }
        : undefined,
    });

    return this.sendEmail({
      to: toEmail,
      subject: `[ENAKO] ${title}`,
      html,
      text: body,
      senderType: 'NOTIFICATIONS',
      tag: 'system_notification',
    });
  }

  async sendNewMessageAlert(toEmail: string, senderName: string, channelName: string, messageContent: string) {
    const title = `New Message from ${senderName}`;
    const body = `You received a new message in channel <strong>#${channelName}</strong>:<br/><br/><em>"${messageContent}"</em>`;
    return this.sendNotificationAlert(toEmail, title, body, '/communications');
  }

  async sendNewDonationAlert(toEmail: string, donorName: string, amount: string, method: string) {
    const title = `New Donation Received: ${amount}`;
    const body = `Thank you! <strong>${donorName}</strong> has made a generous donation of <strong>${amount}</strong> via ${method}.`;
    return this.sendNotificationAlert(toEmail, title, body, '/outreach');
  }

  async sendSubscriptionExpirationAlert(
    toEmail: string,
    subscriptions: Array<{ name: string; cycle: string; cost: number; nextBilling: Date; daysLeft: number }>,
  ) {
    const tableRows = subscriptions
      .map(
        (s) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 10px; font-weight: bold; color: #1e293b;">${s.name}</td>
        <td style="padding: 8px 10px; color: #64748b;">${s.cycle}</td>
        <td style="padding: 8px 10px; font-weight: bold; color: #1c4980;">${Number(s.cost || 0).toLocaleString()} FCFA</td>
        <td style="padding: 8px 10px; color: #dc2626; font-weight: bold;">${new Date(s.nextBilling).toLocaleDateString()} (${s.daysLeft <= 0 ? 'OVERDUE' : s.daysLeft + ' days left'})</td>
      </tr>
    `,
      )
      .join('');

    const html = buildBrandedEmail({
      badge: 'SUBSCRIPTION EXPIRATION',
      badgeColor: '#eab308',
      headerTitle: 'ENAKO OPERATIONS',
      headerSubtitle: 'Executive Operational Notice',
      headline: 'Enterprise Subscriptions Requiring Renewal',
      messageHtml: `
        <p>The following corporate service subscriptions are expiring soon or require immediate renewal to avoid service disruption across ENAKO OS:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <thead>
            <tr style="background: #f8fafc; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 8px 10px;">Service</th>
              <th style="padding: 8px 10px;">Cycle</th>
              <th style="padding: 8px 10px;">Cost</th>
              <th style="padding: 8px 10px;">Expiration</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      `,
      ctaButton: {
        label: 'Manage Subscriptions',
        url: 'https://enakoos.com/#/subscriptions',
      },
    });

    return this.sendEmail({
      to: toEmail,
      subject: '⚠️ ENAKO OS Alert: Enterprise Subscription Expiration Notice',
      html,
      senderType: 'NOTIFICATIONS',
      tag: 'subscription_expiration',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CASH COLLECTION & TRANSACTION EMAILS (cash@enakoos.com)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Sent to client when a field cash collection transaction is created/initiated.
   * From: "ENAKO Cash Desk" <cash@enakoos.com> | Reply-To: cash@enakoos.com
   */
  async sendCollectionReceiptAlert(opts: {
    toEmail: string;
    clientName: string;
    collectionId: string;
    amount: number;
    currency?: string;
    collectorName?: string;
    location?: string;
    status?: string;
    time?: string;
    depositDestination?: string;
    pdfBase64?: string;
  }) {
    const currencyStr = opts.currency || 'FCFA';
    const amountFormatted = `${Number(opts.amount || 0).toLocaleString()} ${currencyStr}`;
    const cleanColId = opts.collectionId.replace(/^COL-/, '');

    const messageHtml = `
      <p>This is an automated confirmation that a field cash collection has been registered for your account on the ENAKO Cloud Operating System.</p>
      <div style="margin: 20px 0; padding: 14px 18px; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px;">
        <div style="font-size: 13px; font-weight: 800; color: #0891b2; margin-bottom: 4px;">📎 Official PDF Receipt Attached</div>
        <div style="font-size: 13px; color: #164e63; line-height: 1.5;">Your official transaction slip <strong>E_NAKO_Receipt_${cleanColId}.pdf</strong> is attached to this email for your records and can be downloaded below.</div>
      </div>
      <p>Please review the verified collection parameters below. A permanent digital audit record has been provisioned.</p>
    `;

    const html = buildBrandedEmail({
      badge: 'CASH RECEIPT',
      badgeColor: '#0891b2',
      headerTitle: 'ENAKO CASH DESK',
      headerSubtitle: 'Field Treasury & Official Cash Receipt',
      recipientName: opts.clientName,
      headline: `Cash Collection Initiated: ${amountFormatted}`,
      messageHtml,
      keyDetails: [
        { label: 'Transaction ID', value: `#COL-${cleanColId}`, isHighlight: true },
        { label: 'Client Name', value: opts.clientName },
        { label: 'Amount Collected', value: amountFormatted, isHighlight: true },
        { label: 'Field Collector', value: opts.collectorName || 'Field Cash Collector' },
        { label: 'Dispatch Desk', value: 'cash@enakoos.com' },
        { label: 'Location', value: opts.location || 'Douala Field Sector' },
        { label: 'Deposit Destination', value: opts.depositDestination || 'ENAKO Central Treasury' },
        { label: 'Current Status', value: opts.status || 'PENDING' },
        { label: 'Date & Time', value: opts.time || new Date().toLocaleString() },
      ],
      calloutNote: {
        title: 'Collection Verification & PDF Receipt',
        text: 'Your payment is registered and undergoing reconciliation. The official signed PDF receipt is attached to this email. For inquiries, reply directly to cash@enakoos.com.',
        variant: 'info',
      },
      ctaButton: {
        label: 'View Portal Status',
        url: 'https://enakoos.com',
        color: '#0891b2',
      },
      footerNote: `Automated transaction receipt #${cleanColId} issued from cash@enakoos.com to ${opts.clientName}.`,
    });

    let attachments: Array<{ filename: string; content: any; contentType: string }> | undefined;
    if (opts.pdfBase64) {
      const cleanBase64 = opts.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      attachments = [
        {
          filename: `E_NAKO_Receipt_${cleanColId}.pdf`,
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ];
    }

    return this.sendEmail({
      to: opts.toEmail,
      subject: `E-NAKO CASH RECEIPT: Collection #${cleanColId} (${amountFormatted})`,
      html,
      senderType: 'CASH',
      from: '"ENAKO Cash Desk" <cash@enakoos.com>',
      replyTo: 'cash@enakoos.com',
      attachments,
      tag: 'cash_collection_receipt',
    });
  }

  /**
   * Sent to client when a field cash collection is marked COMPLETE / SETTLED.
   * From: "ENAKO Cash Desk" <cash@enakoos.com> | Reply-To: cash@enakoos.com
   */
  async sendCollectionSettledAlert(opts: {
    toEmail: string;
    clientName: string;
    collectionId: string;
    amount: number;
    currency?: string;
    collectorName?: string;
    location?: string;
    time?: string;
    pdfBase64?: string;
  }) {
    const currencyStr = opts.currency || 'FCFA';
    const amountFormatted = `${Number(opts.amount || 0).toLocaleString()} ${currencyStr}`;
    const cleanColId = opts.collectionId.replace(/^COL-/, '');

    const messageHtml = `
      <p>Your cash collection transaction has been <strong>successfully verified and settled</strong> by ENAKO Executive Management.</p>
      <div style="margin: 20px 0; padding: 14px 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
        <div style="font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 4px;">📎 Official Settlement PDF Attached</div>
        <div style="font-size: 13px; color: #14532d; line-height: 1.5;">Your verified settlement slip <strong>E_NAKO_Receipt_${cleanColId}.pdf</strong> has been attached to this email.</div>
      </div>
      <p>All funds have been credited and reconciled with your account ledger.</p>
    `;

    const html = buildBrandedEmail({
      badge: 'SETTLED & RECONCILED',
      badgeColor: '#16a34a',
      headerTitle: 'ENAKO CASH DESK',
      headerSubtitle: 'Field Treasury & Settlement Confirmation',
      recipientName: opts.clientName,
      headline: `Payment Settled: ${amountFormatted}`,
      messageHtml,
      keyDetails: [
        { label: 'Transaction ID', value: `#COL-${cleanColId}`, isHighlight: true },
        { label: 'Client Name', value: opts.clientName },
        { label: 'Total Reconciled', value: amountFormatted, isHighlight: true },
        { label: 'Reconciled By', value: opts.collectorName || 'ENAKO Treasury Desk' },
        { label: 'Dispatch Desk', value: 'cash@enakoos.com' },
        { label: 'Settlement Status', value: 'COMPLETED & VERIFIED', isHighlight: true },
        { label: 'Timestamp', value: opts.time || new Date().toLocaleString() },
      ],
      calloutNote: {
        title: 'Official Settlement Complete',
        text: 'This transaction is complete and archived in your official statements. For any support, contact cash@enakoos.com.',
        variant: 'success',
      },
      ctaButton: {
        label: 'View Statement in ENAKO OS',
        url: 'https://enakoos.com',
        color: '#16a34a',
      },
      footerNote: `Official settlement advice #${cleanColId} issued from cash@enakoos.com to ${opts.clientName}.`,
    });

    let attachments: Array<{ filename: string; content: any; contentType: string }> | undefined;
    if (opts.pdfBase64) {
      const cleanBase64 = opts.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      attachments = [
        {
          filename: `E_NAKO_Receipt_${cleanColId}.pdf`,
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ];
    }

    return this.sendEmail({
      to: opts.toEmail,
      subject: `✔ E-NAKO SETTLEMENT CONFIRMATION: Collection #${cleanColId} Completed (${amountFormatted})`,
      html,
      senderType: 'CASH',
      from: '"ENAKO Cash Desk" <cash@enakoos.com>',
      replyTo: 'cash@enakoos.com',
      attachments,
      tag: 'cash_collection_settled',
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // INTERNAL AUDIT LOGGING HELPER
  // ──────────────────────────────────────────────────────────────────────────
  private async logEmailAudit(entry: {
    recipients: string[];
    subject: string;
    sender: string;
    success: boolean;
    messageId?: string;
    error?: string;
    tag?: string;
    actorId?: string;
  }) {
    if (!this.prisma) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.success ? 'EMAIL_SENT' : 'EMAIL_FAILED',
          entity: 'EMAIL_DISPATCH',
          entityId: entry.messageId || 'FAILED',
          actorId: entry.actorId || null,
          metadata: {
            recipients: entry.recipients,
            subject: entry.subject,
            sender: entry.sender,
            tag: entry.tag || 'general',
            success: entry.success,
            messageId: entry.messageId || null,
            error: entry.error || null,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (err: any) {
      // Never let audit log failure crash the email service
      this.logger.debug(`Could not write email audit log: ${err?.message}`);
    }
  }
}
