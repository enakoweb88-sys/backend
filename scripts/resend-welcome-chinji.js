const nodemailer = require('nodemailer');

async function resendWelcome() {
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
  const tempPassword = 'SetOnCreation'; // Note for temporary password
  
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
    <div style="font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;opacity:0.75;margin-bottom:10px;">ENAKO CLOUD OS · HUMAN RESOURCES</div>
    <h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:0.02em;">Welcome to ENAKO, ${firstName}! 🎉</h1>
    <p style="margin:10px 0 0;font-size:14px;opacity:0.85;line-height:1.5;">Official Onboarding Documentation & Employee Guide</p>
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
        <tr style="border-bottom:1px solid #bae6fd;"><td style="padding:9px 8px;font-weight:700;color:#0369a1;">Personal Email</td><td style="padding:9px 8px;font-weight:800;color:#1e293b;">${personalEmail}</td></tr>
        <tr><td style="padding:9px 8px;font-weight:700;color:#0369a1;">Assigned Role</td><td style="padding:9px 8px;font-weight:800;color:#1d4ed8;">${position} (${department})</td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:#0284c7;font-weight:700;">SECURITY NOTICE: You can log into ENAKO OS at enakoos.com using your corporate email.</p>
    </div>

    <!-- SECTION 2: ABOUT ENAKO -->
    <h2 style="font-size:15px;font-weight:800;color:#1c4980;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">Section 2: About ENAKO (Company Overview and Business Divisions)</h2>
    <p style="margin:0 0 14px;color:#475569;">
      ENAKO is a multi-division financial technology group headquartered in Yaoundé, Cameroon. Our corporate mission is to deliver secure, modern, and accessible financial services to individuals, businesses, and institutions across Africa and the global diaspora. We operate across three distinct business divisions:
    </p>

    <!-- DIVISION 1: MOBILE APP -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px;margin-bottom:18px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#1d4ed8;">Division 1: ENAKO Mobile Application (Consumer Fintech)</p>
      <ul style="margin:0;padding-left:20px;color:#475569;line-height:2.1;font-size:13px;">
        <li><strong>Akawo Smart Savings:</strong> Automated high-yield savings plans with flexible daily, weekly, or monthly schedules.</li>
        <li><strong>Njangi Digital Savings Groups:</strong> Digitized rotating savings and credit associations managed transparently on-app.</li>
        <li><strong>Land Banking and Real Estate:</strong> Structured real estate investment opportunities with fixed annual yields of 12% per annum.</li>
        <li><strong>Institutional &amp; Utility Payments:</strong> Tuition, school fees, rent, and utility bill settlements.</li>
      </ul>
    </div>

    <!-- DIVISION 2: NGO OUTREACH -->
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;margin-bottom:18px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:#15803d;">Division 2: ENAKO Outreach Foundation (Social Impact and NGO)</p>
      <p style="margin:0 0 12px;color:#475569;font-size:13px;">
        Operating via <a href="https://enakooutreach.cm" style="color:#15803d;font-weight:700;">enakooutreach.cm</a>, ENAKO Outreach manages non-profit humanitarian and community development initiatives including Charity Fundraising, Academic Scholarships, Infrastructure Development, and Humanitarian Relief.
      </p>
    </div>

    <!-- SECTION 3: CORE RESPONSIBILITIES -->
    <div style="background:#f8fafc;border-left:4px solid #1c4980;padding:18px;border-radius:8px;margin:24px 0;">
      <h2 style="margin:0 0 10px;font-size:15px;font-weight:800;color:#1c4980;text-transform:uppercase;">Section 3: Your Core Responsibilities &amp; Duties</h2>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.75;white-space:pre-wrap;">${responsibilities}</p>
    </div>

    <!-- SECTION 4: INITIAL GOALS -->
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:18px;border-radius:8px;margin:24px 0;">
      <h2 style="margin:0 0 10px;font-size:15px;font-weight:800;color:#15803d;text-transform:uppercase;">Section 4: Your Initial Performance Goals</h2>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.75;white-space:pre-wrap;">${goals}</p>
    </div>

    <!-- SECTION 5: WEEKLY REPORTS -->
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:22px;margin-bottom:28px;">
      <h2 style="margin:0 0 12px;font-size:15px;font-weight:800;color:#713f12;text-transform:uppercase;letter-spacing:0.05em;">Section 5: Weekly Activity Reports</h2>
      <p style="margin:0;color:#475569;">
        All staff must submit a Weekly Activity Report (WAR) via ENAKO OS every <strong>Friday before 5:00 PM</strong> detailing completed tasks, tasks in progress, operational blockers, and key commitments for the upcoming week.
      </p>
    </div>

    <!-- CLOSING -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:22px;margin-bottom:8px;">
      <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1c4980;">Welcome aboard, ${firstName}.</p>
      <p style="margin:0;color:#475569;font-size:13px;line-height:1.7;">
        We look forward to your leadership and driving impact through ENAKO Outreach.
      </p>
    </div>

    <p style="margin:24px 0 0;color:#64748b;font-size:13px;">Regards,</p>
    <p style="margin:4px 0 0;font-size:14px;font-weight:800;color:#1c4980;">ENAKO Executive Management &amp; Human Resources</p>
    <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">ENAKO Cloud OS · Yaoundé, Cameroon · <a href="mailto:hr@enako.cm" style="color:#2563eb;text-decoration:none;">hr@enako.cm</a></p>

  </div>

  <!-- FOOTER -->
  <div style="background:#1e293b;padding:18px 24px;text-align:center;font-size:11px;color:#64748b;letter-spacing:0.03em;">
    © ${new Date().getFullYear()} ENAKO Cloud OS · Confidential · Prepared for ${fullName}<br/>
    <a href="https://enakoos.com" style="color:#0ea5e9;text-decoration:none;margin-top:4px;display:inline-block;">https://enakoos.com</a>
  </div>
</div>
</body>
</html>
  `;

  // Send to both corporate and personal email
  const recipients = [loginEmail, personalEmail];

  for (const recipient of recipients) {
    try {
      console.log(`Sending welcome email to ${recipient}...`);
      const info = await transporter.sendMail({
        from: `"ENAKO Support" <${user}>`,
        to: recipient,
        subject: `🎉 Welcome to ENAKO, ${firstName}! Your Official Onboarding Guide [Ref: #${refCode}]`,
        html
      });
      console.log(`✅ Welcome Email Sent Successfully to ${recipient}! MessageId: ${info.messageId}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${recipient}:`, err.message);
    }
  }
}

resendWelcome();
