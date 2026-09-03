const nodemailer = require('nodemailer');

async function sendWelcomeChelsea() {
  const user = 'enakosupport@gmail.com';
  const pass = 'drsg gmlk hqfz kwev';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const fullName = 'Nchang Chelsea';
  const position = 'Department Manager';
  const department = 'Management';
  const loginEmail = 'enakomgt@gmail.com';
  const firstName = 'Chelsea';
  const refCode = Math.floor(1000 + Math.random() * 9000);

  const responsibilities = `Key Operational Responsibilities & Duties:

Daily Operational Oversight: Supervise day-to-day operations, ensure smooth workflow execution across team members, and resolve operational bottlenecks proactively.
Team Leadership & Guidance: Provide directional leadership, mentor direct reports, delegate assignments effectively, and foster an accountable, high-performance team culture.
Process & System Optimization: Evaluate existing operational workflows, identify inefficiencies, and design standard operating procedures (SOPs) to maximize team productivity and cloud system efficiency.
Resource & Workload Management: Manage project schedules, allocate human and technological resources efficiently, and ensure balance across team workloads.
Performance Monitoring & Quality Control: Establish KPI benchmarks, monitor key metrics across departmental projects, and perform regular quality control audits to ensure high deliverables standards.
Cross-Functional Collaboration: Serve as a bridge between executive management, client managers, technical leads, and outreach teams to align operations with strategic business objectives.
Reporting & Risk Mitigation: Generate weekly and monthly operational reports for executive stakeholders, identify operational risks early, and implement corrective measures.

Key Deliverables:
- Documented SOPs and streamlined operational guidelines.
- Weekly team performance, project completion, and productivity dashboards.
- Quarterly resource allocation plans and risk assessment reports.`;

  const goals = `Initial Employee Goals:

30-Day Goals (Onboarding & Discovery):
- System & Team Integration: Complete full onboarding across ENAKO Cloud System platforms, tools, and internal communication channels.
- Operational Audit: Review existing team workflows, current projects, SOPs, and past performance data to identify key bottlenecks and immediate quick-wins.
- 1-on-1 Alignment: Conduct 1-on-1 onboarding meetings with all direct reports and key cross-functional stakeholders to establish expectations and working styles.

60-Day Goals (Implementation & Execution):
- Process Refinement: Implement updated or standardized SOPs for core daily operations and task tracking.
- Performance Tracking: Establish standard team KPIs and roll out a clear weekly progress reporting matrix.
- Efficiency Enhancement: Achieve a measurable reduction in project delivery turnaround times or workflow friction.

90-Day Goals (Optimization & Scalability):
- Strategic Optimization: Deliver a comprehensive 90-day operational evaluation report outlining strategic recommendations for scaling team throughput.
- Team Performance: Ensure team members are operating autonomously under established SOPs with clear performance visibility.
- Strategic Planning: Collaborate with leadership to define operational targets for the upcoming quarter.`;

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
      <div class="cred-item"><span class="cred-label">Assigned Position:</span> <span class="cred-val">${position} (${department})</span></div>
    </div>
    <p style="color:#dc2626;font-size:14px;font-weight:700;">
      SECURITY NOTICE: You can log in immediately at <a href="https://enakoos.com">enakoos.com</a> using the temporary password configured during account creation.
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

  try {
    console.log(`Sending welcome email to ${loginEmail}...`);
    const info = await transporter.sendMail({
      from: `"ENAKO Support" <${user}>`,
      to: loginEmail,
      subject: `🎉 Welcome to ENAKO, ${firstName}! Your Official Manager Onboarding Guide [Ref: #${refCode}]`,
      html
    });
    console.log(`✅ Welcome Email Delivered Successfully to ${loginEmail}! MessageId: ${info.messageId}`);
  } catch (err) {
    console.error(`❌ Failed to send to ${loginEmail}:`, err.message);
  }
}

sendWelcomeChelsea();
