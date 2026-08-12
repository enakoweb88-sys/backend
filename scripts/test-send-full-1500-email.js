const nodemailer = require('nodemailer');

async function testFull1500WordEmail() {
  const mailServiceModule = require('../dist/src/modules/mail/mail.service');
  const service = new mailServiceModule.MailService();

  const fullName = 'Chinji Clinton';
  const position = 'Outreach Manager';
  const department = 'Outreach / NGO';
  const loginEmail = 'enakoweb88@gmail.com';
  const password = 'OutreachPassword@2026!';
  const responsibilities = 'Oversee ENAKO Outreach Foundation operations (enakooutreach.cm), direct charity fundraising campaigns, review and verify scholarship applications, coordinate community development projects, manage donor communications, and publish monthly impact reports.';
  const goals = '1. Launch 3 major community development campaigns this quarter.\n2. Increase diaspora recurring donor subscriptions by 25%.\n3. Process and verify 100+ scholarship applications.\n4. Achieve 98% donor satisfaction rate.';

  console.log('Sending the COMPLETE 1,500+ word onboarding email toenakoweb88@gmail.com...');
  const success = await service.sendWelcomeEmail({
    toEmail: loginEmail,
    fullName,
    department,
    position,
    password,
    loginEmail,
    responsibilities,
    goals
  });

  if (success) {
    console.log('🎉 FULL 1,500+ Word Onboarding Packet Email Sent Successfully toenakoweb88@gmail.com!');
  } else {
    console.error('❌ Failed to send email.');
  }
}

testFull1500WordEmail().catch(console.error);
