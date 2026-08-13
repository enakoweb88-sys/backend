const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });

async function run() {
  const plainPassword = 'OutreachPassword@2026!';
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  console.log(`1. Setting password for enakooutreach@gmail.com to: ${plainPassword}`);
  await prisma.user.updateMany({
    where: { email: 'enakooutreach@gmail.com' },
    data: { passwordHash: hashedPassword }
  });
  console.log('✅ Password successfully updated in Supabase Database!');

  // 2. Setup email transport
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
  const loginEmail = 'enakooutreach@gmail.com';
  const personalEmail = 'clintonchinji180@gmail.com';
  const firstName = fullName.split(' ')[0];

  const responsibilities = `Key Operational Responsibilities & Duties:
1. Outreach Strategy & Campaign Execution: Develop, execute, and manage cold and warm outreach campaigns (Email, LinkedIn, Direct Messaging, Phone) to drive lead acquisition and partner relationships.
2. Lead Generation & Prospecting: Identify target personas, build and qualify prospect databases, and ensure continuous top-of-funnel pipeline growth.
3. Relationship Management & Nurturing: Engage prospective clients, partners, and key stakeholders; build rapport, qualify incoming opportunities, and schedule discovery meetings/pitches for leadership.
4. Messaging & Collateral Creation: Craft compelling outreach templates, follow-up cadences, pitch decks, and personalized communications tailored to specific customer segments.
5. Pipeline & CRM Management: Maintain meticulous records of all outreach activities, prospect interactions, conversion statuses, and deal progress within the CRM/tracking system.
6. Market Research & Competitor Analysis: Monitor industry trends, track competitor outreach tactics, and refine messaging based on market response rates.
7. Analytics & Performance Reporting: Track and report on outreach metrics including open rates, response rates, meeting booking rates, and campaign ROI.

Key Deliverables:
- Qualified leads and booked discovery meetings meeting or exceeding weekly quota.
- Up-to-date prospect databases and segmented contact lists.
- Weekly outreach performance reports (Response rates, conversion funnel, CRM health).
- Optimized email copy, pitch messaging templates, and outreach scripts.`;

  const goals = `Initial Employee Goals:
30-Day Goals (Onboarding & Campaign Setup):
- Product & Pitch Mastery: Develop a deep understanding of ENAKO products/services, target audience demographics, value propositions, and key sales messaging.
- Infrastructure & Database Setup: Audit existing prospect lists, configure outreach tools/CRM workflows, and build an initial verified prospect list (e.g., 200 to 500 targeted contacts).
- Initial Messaging Launch: Create and test 2 to 3 outreach sequences/templates and launch initial pilot campaigns to gather baseline response metrics.

60-Day Goals (Pipeline Building & Conversions):
- Outreach Scaling: Scale weekly outreach volume to target capacity while maintaining high response quality and list hygiene.
- Meeting Generation: Consistently achieve weekly/monthly target metrics for qualified discovery calls/demos booked.
- A/B Testing & Optimization: Analyze campaign data (open/reply rates), refine copy and targeting criteria based on response feedback to double conversion efficiency.

90-Day Goals (Consistent Delivery & Growth):
- Predictable Lead Pipeline: Establish a steady, predictable pipeline of qualified leads and strategic partnerships meeting quarterly conversion targets.
- Playbook Creation: Document a comprehensive Outreach Playbook detailing top-performing sequences, objection handling techniques, and campaign best practices.
- Expansion Planning: Present recommendations for expanding into new verticals, target markets, or referral outreach channels.`;

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
      <div class="cred-item"><span class="cred-label">Your Login Password:</span> <span class="pwd-highlight">${plainPassword}</span></div>
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

    <p><strong>Your Core Responsibilities & Duties:</strong></p>
    <div style="white-space:pre-wrap;margin-bottom:16px;line-height:1.7;">${responsibilities}</div>

    <p><strong>Your Initial Performance Goals:</strong></p>
    <div style="white-space:pre-wrap;margin-bottom:16px;line-height:1.7;">${goals}</div>
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

  const recipients = [loginEmail, personalEmail];
  const refCode = Math.floor(1000 + Math.random() * 9000);

  for (const recipient of recipients) {
    try {
      console.log(`Sending updated welcome email to ${recipient}...`);
      const info = await transporter.sendMail({
        from: `"ENAKO Support" <${user}>`,
        to: recipient,
        subject: `🎉 Welcome to ENAKO, ${firstName}! Your Login Credentials & Onboarding Guide [Ref: #${refCode}]`,
        html
      });
      console.log(`✅ Mobile-Responsive Welcome Email Sent Successfully to ${recipient}! MessageId: ${info.messageId}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${recipient}:`, err.message);
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
