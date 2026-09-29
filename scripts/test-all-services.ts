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

async function sendAllTestEmails() {
  const recipient = process.argv[2] || 'enakoweb88@gmail.com';
  const apiKey = (process.env.RESEND_API_KEY || '').trim();

  console.log('────────────────────────────────────────────────────────────');
  console.log(`🚀 DISPATCHING FULL TEST BATCH TO: ${recipient}`);
  console.log('────────────────────────────────────────────────────────────');
  if (apiKey) {
    console.log(`🔑 Resend API Key: Present (${apiKey.slice(0, 7)}...${apiKey.slice(-4)}) -> REAL DISPATCH`);
  } else {
    console.log('⚠️ RESEND_API_KEY is not set in backend/.env -> RUNNING IN SIMULATION MODE');
  }
  console.log('────────────────────────────────────────────────────────────\n');

  const configService = new ConfigService();
  const mailService = new MailService(configService);

  const results: Array<{ service: string; from: string; subject: string; success: boolean; id?: string; error?: string }> = [];

  // 1. KYC Submission Received
  console.log('1/5 Sending KYC Submission Confirmation...');
  const kycReceived = await mailService.sendKycSubmissionReceived(
    recipient,
    'Enako Web Executive',
    'sub_live_982341'
  );
  results.push({
    service: 'KYC Compliance',
    from: EMAIL_SENDERS.KYC,
    subject: 'KYC Submission Received [Ref: #982341] - ENAKO',
    success: kycReceived.success,
    id: kycReceived.messageId,
    error: kycReceived.error,
  });

  // Brief pause to ensure rate compliance
  await new Promise((r) => setTimeout(r, 600));

  // 2. KYC Approved
  console.log('2/5 Sending KYC Approved Notification...');
  const kycApproved = await mailService.sendKycApproved(
    recipient,
    'Enako Web Executive'
  );
  results.push({
    service: 'KYC Approval',
    from: EMAIL_SENDERS.KYC,
    subject: 'Your KYC Verification Has Been Approved - ENAKO',
    success: kycApproved.success,
    id: kycApproved.messageId,
    error: kycApproved.error,
  });

  await new Promise((r) => setTimeout(r, 600));

  // 3. Task Assignment Alert
  console.log('3/5 Sending Task Assignment Alert...');
  const taskAlert = await mailService.sendTaskAssignedAlert({
    toEmail: recipient,
    assigneeName: 'Enako Executive',
    assignerName: 'Operations Lead',
    taskTitle: 'Executive Review of Q4 Operations & Treasury',
    priority: 'HIGH',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    description: 'Perform a comprehensive reconciliation of company treasury accounts across regional branches.',
  });
  results.push({
    service: 'Task Management',
    from: EMAIL_SENDERS.NOTIFICATIONS,
    subject: 'New task assigned to you: Executive Review of Q4 Operations & Treasury',
    success: taskAlert.success,
    id: taskAlert.messageId,
    error: taskAlert.error,
  });

  await new Promise((r) => setTimeout(r, 600));

  // 4. Security Password Changed Alert
  console.log('4/5 Sending Security Password Change Alert...');
  const securityAlert = await mailService.sendPasswordChangedAlert(
    recipient,
    'Enako Executive',
    '72.60.182.35'
  );
  results.push({
    service: 'Security Sentinel',
    from: EMAIL_SENDERS.SECURITY,
    subject: 'Security Alert: Your ENAKO OS Password Was Changed',
    success: securityAlert.success,
    id: securityAlert.messageId,
    error: securityAlert.error,
  });

  await new Promise((r) => setTimeout(r, 600));

  // 5. Welcome & Onboarding
  console.log('5/5 Sending Employee Welcome & Onboarding Documentation...');
  const welcomeAlert = await mailService.sendWelcomeEmail({
    toEmail: recipient,
    fullName: 'Enako Executive',
    department: 'Executive Operations',
    position: 'Managing Executive',
    password: 'SecureAuth@2026',
    loginEmail: recipient,
    responsibilities: '1. Oversee group financial operations.\n2. Steer enterprise compliance across jurisdictions.\n3. Direct strategic technology adoption.',
    goals: 'Finalize core enterprise infrastructure and integrate automated compliance channels.',
  });
  results.push({
    service: 'Onboarding & HR',
    from: EMAIL_SENDERS.NOTIFICATIONS,
    subject: 'Welcome to ENAKO, Enako | Onboarding Documentation',
    success: welcomeAlert.success,
    id: welcomeAlert.messageId,
    error: welcomeAlert.error,
  });

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('📊 DISPATCH BATCH SUMMARY');
  console.log('────────────────────────────────────────────────────────────');
  results.forEach((r, idx) => {
    const statusIcon = r.success ? '✅' : '❌';
    console.log(`${idx + 1}. [${r.service}]`);
    console.log(`   From: ${r.from}`);
    console.log(`   Status: ${statusIcon} ${r.success ? 'Delivered' : 'Failed'}`);
    console.log(`   Message ID: ${r.id || 'N/A'}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  });
  console.log('────────────────────────────────────────────────────────────\n');

  if (!apiKey) {
    console.log('ℹ️ These 5 emails ran in SIMULATION mode because RESEND_API_KEY is not yet in backend/.env.');
    console.log('👉 To receive them live in your real Gmail inbox:');
    console.log('   1. Open backend/.env');
    console.log('   2. Set RESEND_API_KEY=re_your_actual_key');
    console.log('   3. Re-run: npx tsx scripts/test-all-services.ts enakoweb88@gmail.com');
  } else {
    console.log('🎉 All 5 live emails have been delivered to Resend! Check your inbox at enakoweb88@gmail.com.');
  }
}

sendAllTestEmails().catch(console.error);
