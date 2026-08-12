const nodemailer = require('nodemailer');

async function testSendRealWelcome() {
  const user = 'enakosupport@gmail.com';
  const pass = 'drsg gmlk hqfz kwev';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const fullName = 'Chinji Clinton';
  const position = 'Outreach Manager';
  const department = 'Outreach / NGO';
  const loginEmail = 'enakoweb88@gmail.com';
  const password = 'OutreachPassword@2026!';
  const responsibilities = 'Oversee ENAKO Outreach Foundation operations (enakooutreach.cm), direct charity fundraising campaigns, review and verify scholarship applications, coordinate community development projects, manage donor communications, and publish monthly impact reports.';
  const goals = '1. Launch 3 major community development campaigns this quarter.\n2. Increase diaspora recurring donor subscriptions by 25%.\n3. Process and verify 100+ scholarship applications.\n4. Achieve 98% donor satisfaction rate.';
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

    <p style="font-size:15px;margin:0 0 20px;">Dear <strong>${fullName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;">
      On behalf of the entire leadership team and every member of the ENAKO family, we are delighted to extend to you a warm and official welcome as you join us as a <strong>${position}</strong> in the <strong>${department} Department</strong>.
    </p>

    <!-- SECTION 1: LOGIN CREDENTIALS -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 14px;font-size:16px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;">🔐 Section 1 — Your ENAKO Cloud OS Login Credentials</h2>
      <p style="margin:0 0 12px;color:#475569;">Your personal ENAKO Cloud OS account has been created and is ready for you to access:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:8px 0;font-weight:700;color:#334155;width:160px;">Login Portal:</td>
          <td style="padding:8px 0;"><a href="https://enakoos.com" style="color:#0284c7;font-weight:700;">enakoos.com</a></td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:700;color:#334155;">Corporate Email:</td>
          <td style="padding:8px 0;font-weight:700;color:#0f172a;">${loginEmail}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:700;color:#334155;">Temporary Password:</td>
          <td style="padding:8px 0;"><code style="background:#e0f2fe;color:#0369a1;padding:4px 8px;border-radius:4px;font-size:13px;font-weight:700;">${password}</code></td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-weight:700;color:#334155;">Assigned Role:</td>
          <td style="padding:8px 0;color:#0369a1;font-weight:700;">${position} (${department})</td>
        </tr>
      </table>
    </div>

    <!-- CORE RESPONSIBILITIES -->
    <div style="background:#f8fafc;border-left:4px solid #1c4980;padding:16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:13px;color:#1c4980;font-weight:700;">📌 Your Assigned Core Responsibilities:</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${responsibilities}</p>
    </div>

    <!-- INITIAL GOALS -->
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:6px;margin:16px 0 24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#15803d;font-weight:700;">🎯 Your Initial Performance Goals:</p>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${goals}</p>
    </div>

  </div>
</div>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"ENAKO Support" <${user}>`,
      to: loginEmail,
      subject: `🎉 Welcome to ENAKO, ${firstName}! Your Onboarding Guide & Login Credentials [Ref: #${Math.floor(1000+Math.random()*9000)}]`,
      html
    });
    console.log('✅ Real Welcome Email Sent Successfully! MessageId:', info.messageId);
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}

testSendRealWelcome();
