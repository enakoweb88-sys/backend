import * as fs from 'fs';
import * as path from 'path';

// Load .env manually if present
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.trim().replace(/^['"](.*)['"]$/, '$1');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

import { ConfigService } from '@nestjs/config';
import { MailService } from '../src/modules/mail/mail.service';
import { EMAIL_SENDERS } from '../src/modules/mail/mail.constants';

/**
 * CLI Test Script for Resend Transactional Emails
 *
 * Usage:
 *   npx tsx scripts/test-resend-live.ts <recipientEmail> <type>
 *
 * Types:
 *   - kyc-received
 *   - kyc-approved
 *   - kyc-rejected
 *   - task
 *   - password-changed
 *   - security-reminder
 *   - breach
 *   - welcome
 */
async function main() {
  const recipient = process.argv[2];
  const type = (process.argv[3] || 'kyc-received').toLowerCase();

  if (!recipient || !recipient.includes('@')) {
    console.error('❌ Error: Please provide a valid recipient email address.');
    console.log('Usage: npx tsx scripts/test-resend-live.ts <recipientEmail> [type]');
    console.log('Available types: kyc-received, kyc-approved, kyc-rejected, task, password-changed, security-reminder, breach, welcome');
    process.exit(1);
  }

  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  console.log('────────────────────────────────────────────────────────────');
  console.log('📧 ENAKO OS - RESEND LIVE EMAIL TEST RUNNER');
  console.log('────────────────────────────────────────────────────────────');
  console.log(`Recipient: ${recipient}`);
  console.log(`Email Type: ${type}`);
  console.log(`API Key Configured: ${apiKey ? `Yes (starts with ${apiKey.slice(0, 7)}...)` : 'NO - Will run in SIMULATION mode'}`);
  console.log('────────────────────────────────────────────────────────────\n');

  const configService = new ConfigService();
  const mailService = new MailService(configService);

  let result;
  switch (type) {
    case 'kyc-received':
      console.log('Sending KYC Submission Received email from:', EMAIL_SENDERS.KYC);
      result = await mailService.sendKycSubmissionReceived(recipient, 'Test Applicant', 'sub_demo_789123');
      break;

    case 'kyc-approved':
      console.log('Sending KYC Approved email from:', EMAIL_SENDERS.KYC);
      result = await mailService.sendKycApproved(recipient, 'Test Applicant');
      break;

    case 'kyc-rejected':
      console.log('Sending KYC Rejected email from:', EMAIL_SENDERS.KYC);
      result = await mailService.sendKycRejected(recipient, 'Test Applicant', 'Uploaded document was unreadable. Please provide a clear national ID card.');
      break;

    case 'task':
      console.log('Sending Task Assignment email from:', EMAIL_SENDERS.NOTIFICATIONS);
      result = await mailService.sendTaskAssignedAlert({
        toEmail: recipient,
        assigneeName: 'Alex Employee',
        assignerName: 'Sarah Operations Lead',
        taskTitle: 'Quarterly Financial Audit Reconciliation',
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        description: 'Please review all branch expense ledgers and upload supporting invoices before Friday close of business.',
      });
      break;

    case 'password-changed':
      console.log('Sending Security Password Changed Alert from:', EMAIL_SENDERS.SECURITY);
      result = await mailService.sendPasswordChangedAlert(recipient, 'Alex Employee', '192.168.1.100');
      break;

    case 'security-reminder':
      console.log('Sending Monthly Security Password Reminder from:', EMAIL_SENDERS.SECURITY);
      result = await mailService.sendMonthlyPasswordReminder(recipient, 'Alex Employee');
      break;

    case 'breach':
      console.log('Sending Security Incident Alert from:', EMAIL_SENDERS.SECURITY);
      result = await mailService.sendSecurityBreachAlert('SUSPICIOUS_LOGIN_ATTEMPT', {
        email: recipient,
        ip: '45.134.142.21',
        reason: 'Multiple failed authentication attempts detected from unverified IP.',
        timestamp: new Date(),
      });
      break;

    case 'welcome':
      console.log('Sending Employee Welcome & Onboarding email from:', EMAIL_SENDERS.NOTIFICATIONS);
      result = await mailService.sendWelcomeEmail({
        toEmail: recipient,
        fullName: 'Alex Employee',
        department: 'Operations & Finance',
        position: 'Financial Analyst',
        password: 'TempPassword@2026',
        loginEmail: recipient,
        responsibilities: '1. Oversee treasury reconciliation.\n2. Verify compliance logs.\n3. Prepare weekly ledger summaries.',
        goals: 'Complete security onboarding and pass compliance review in Week 1.',
      });
      break;

    default:
      console.error(`Unknown type "${type}". Valid types: kyc-received, kyc-approved, kyc-rejected, task, password-changed, security-reminder, breach, welcome`);
      process.exit(1);
  }

  console.log('\n────────────────────────────────────────────────────────────');
  if (result.success) {
    console.log('✅ DISPATCH RESULT: SUCCESS');
    console.log(`Message ID: ${result.messageId}`);
    if (!apiKey) {
      console.log('ℹ️ Note: This was a SIMULATED dispatch because RESEND_API_KEY is not set in backend/.env.');
    } else {
      console.log('📬 Live email delivered to Resend for dispatch! Please check the recipient inbox.');
    }
  } else {
    console.error('❌ DISPATCH RESULT: FAILED');
    console.error(`Error: ${result.error}`);
  }
  console.log('────────────────────────────────────────────────────────────\n');
}

main().catch(console.error);
