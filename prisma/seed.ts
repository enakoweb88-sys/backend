import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Roles ─────────────────────────────────────────────────────────────────
  const roles = [];
  for (const name of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name} role` },
    });
    roles.push(role);
  }
  console.log(`✅ Roles seeded: ${roles.map(r => r.name).join(', ')}`);

  // ─── Departments ────────────────────────────────────────────────────────────
  const deptNames = ['Executive', 'Operations', 'Finance', 'HR', 'Technology', 'Sales', 'Compliance'];
  const departments = [];
  for (const name of deptNames) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    departments.push(dept);
  }
  console.log(`✅ Departments seeded: ${departments.map(d => d.name).join(', ')}`);

  const ceoRole = roles.find(r => r.name === RoleName.CEO)!;
  const execDept = departments.find(d => d.name === 'Executive')!;

  // ─── Default CEO ────────────────────────────────────────────────────────────
  const ceoEmail = 'ceo@enako.com';
  let ceoUser = await prisma.user.findUnique({ where: { email: ceoEmail } });
  if (!ceoUser) {
    ceoUser = await prisma.user.create({
      data: {
        email: ceoEmail,
        fullName: 'ENAKO CEO',
        title: 'Chief Executive Officer',
        passwordHash: await bcrypt.hash('Enako@2025!', 12),
        roleId: ceoRole.id,
        departmentId: execDept.id,
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Default CEO created: ${ceoEmail} / Enako@2025!`);
  } else {
    console.log(`ℹ️  CEO account already exists: ${ceoEmail}`);
  }

  // ─── Demo Manager ───────────────────────────────────────────────────────────
  const managerRole = roles.find(r => r.name === RoleName.MANAGER)!;
  const opsDept = departments.find(d => d.name === 'Operations')!;
  const managerEmail = 'manager@enako.com';
  let mgrUser = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!mgrUser) {
    mgrUser = await prisma.user.create({
      data: {
        email: managerEmail,
        fullName: 'Operations Manager',
        title: 'Operations Manager',
        passwordHash: await bcrypt.hash('Manager@2025!', 12),
        roleId: managerRole.id,
        departmentId: opsDept.id,
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Demo Manager created: ${managerEmail} / Manager@2025!`);
  } else {
    console.log(`ℹ️  Manager account already exists: ${managerEmail}`);
  }

  // ─── Demo Employee ──────────────────────────────────────────────────────────
  const employeeRole = roles.find(r => r.name === RoleName.EMPLOYEE)!;
  const employeeEmail = 'employee@enako.com';
  let empUser = await prisma.user.findUnique({ where: { email: employeeEmail } });
  if (!empUser) {
    empUser = await prisma.user.create({
      data: {
        email: employeeEmail,
        fullName: 'John Doe',
        title: 'Software Engineer',
        passwordHash: await bcrypt.hash('Employee@2025!', 12),
        roleId: employeeRole.id,
        departmentId: opsDept.id,
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Demo Employee created: ${employeeEmail} / Employee@2025!`);
  } else {
    console.log(`ℹ️  Employee account already exists: ${employeeEmail}`);
  }

  // ─── Demo Outreach Manager ─────────────────────────────────────────────────
  const outreachRole = roles.find(r => r.name === RoleName.OUTREACH_MANAGER);
  if (outreachRole) {
    const outreachEmail = 'outreach@enako.com';
    let outreachUser = await prisma.user.findUnique({ where: { email: outreachEmail } });
    if (!outreachUser) {
      outreachUser = await prisma.user.create({
        data: {
          email: outreachEmail,
          fullName: 'Sarah Good',
          title: 'Outreach Manager',
          passwordHash: await bcrypt.hash('Outreach@2025!', 12),
          roleId: outreachRole.id,
          departmentId: opsDept.id,
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Demo Outreach Manager created: ${outreachEmail} / Outreach@2025!`);
    } else {
      console.log(`ℹ️  Outreach Manager account already exists: ${outreachEmail}`);
    }
  }

  // ─── Seed Dashboard Additions ────────────────────────────────────────────────
  console.log('🌱 Seeding dashboard data...');

  // Bank Accounts
  if ((await prisma.bankAccount.count()) === 0) {
    await prisma.bankAccount.createMany({
      data: [
        { name: 'Main Operating Account', bank: 'UBA Cameroon', accountNo: '10023XXXX', balance: 145000000 },
        { name: 'Payroll Account', bank: 'Ecobank', accountNo: '04321XXXX', balance: 45000000 },
        { name: 'Reserve Account', bank: 'Afriland First Bank', accountNo: '88392XXXX', balance: 80000000 }
      ]
    });
  }

  // Budgets
  if ((await prisma.budget.count()) === 0) {
    await prisma.budget.createMany({
      data: [
        { category: 'Operations', budget: 10000000, actual: 8500000 },
        { category: 'Salaries & Wages', budget: 45000000, actual: 45000000 },
        { category: 'Marketing', budget: 5000000, actual: 6200000 },
        { category: 'Office & Admin', budget: 2000000, actual: 1800000 },
        { category: 'Others', budget: 1000000, actual: 400000 }
      ]
    });
  }

  // Invoices
  if ((await prisma.invoice.count()) === 0) {
    await prisma.invoice.createMany({
      data: [
        { client: 'Acme Corp', amount: 1500000, status: 'Paid', dueDate: new Date('2026-06-05') },
        { client: 'Tech Hub Ltd', amount: 800000, status: 'Pending', dueDate: new Date('2026-06-12') },
        { client: 'Global Logistics', amount: 2500000, status: 'Overdue', dueDate: new Date('2026-05-30') }
      ]
    });
  }

  // App Activity
  if ((await prisma.appActivity.count()) === 0) {
    const dates = [
      { d: '2026-06-05', down: 400, act: 240 },
      { d: '2026-06-06', down: 300, act: 139 },
      { d: '2026-06-07', down: 200, act: 980 },
      { d: '2026-06-08', down: 278, act: 390 },
      { d: '2026-06-09', down: 189, act: 480 },
      { d: '2026-06-10', down: 239, act: 380 },
      { d: '2026-06-11', down: 349, act: 430 }
    ];
    await prisma.appActivity.createMany({
      data: dates.map(x => ({
        date: new Date(x.d), downloads: x.down, active: x.act
      }))
    });
  }

  // Marketing Channels
  if ((await prisma.marketingChannel.count()) === 0) {
    await prisma.marketingChannel.createMany({
      data: [
        { name: 'Facebook', users: 3450, total: 10000, growth: 12 },
        { name: 'Instagram', users: 2100, total: 10000, growth: 8 },
        { name: 'WhatsApp', users: 1800, total: 10000, growth: 15 },
        { name: 'Website', users: 1500, total: 10000, growth: -2 },
        { name: 'TikTok', users: 1150, total: 10000, growth: 22 }
      ]
    });
  }

  // Njangi Groups
  if ((await prisma.njangiGroup.count()) === 0) {
    await prisma.njangiGroup.createMany({
      data: [
        { name: 'Elite Traders', amount: 12000000, active: true },
        { name: 'Tech Innovators', amount: 8000000, active: true },
        { name: 'Community Fund', amount: 4500000, active: true }
      ]
    });
  }

  // Leads
  if ((await prisma.lead.count()) === 0) {
    await prisma.lead.createMany({
      data: [
        { name: 'Grace M.', phone: '+237 671 234 567', source: 'WhatsApp', interest: 'Njangi Group', status: 'New' },
        { name: 'Definitive Tech', phone: '+237 692 345 678', source: 'Referral', interest: 'B2B API', status: 'Contacted' },
        { name: 'Alice W.', phone: '+237 653 456 789', source: 'Facebook', interest: 'Bill Payments', status: 'Interested' }
      ]
    });
  }

  // Meetings
  if ((await prisma.meeting.count()) === 0) {
    await prisma.meeting.createMany({
      data: [
        { time: '10:00 AM', person: 'Sarah Jenkins', type: 'Initial Discovery', status: 'Confirmed' },
        { time: '02:30 PM', person: 'Michael Obi', type: 'Proposal Review', status: 'Pending' }
      ]
    });
  }

  // Content Posts
  if ((await prisma.contentPost.count()) === 0) {
    await prisma.contentPost.createMany({
      data: [
        { title: 'How to use ENAKO OS', platform: 'Facebook', type: 'Posts', status: 'Published', author: 'Digital Team', reach: 15400, engagement: 1200 },
        { title: 'New Feature Alert', platform: 'Instagram', type: 'Reels', status: 'Published', author: 'Digital Team', reach: 12100, engagement: 1500 },
        { title: 'Summer Campaign Reel', platform: 'Instagram', type: 'Reels', status: 'Pending', author: 'Jane D.', reach: 0, engagement: 0 },
        { title: 'Feature Update Thread', platform: 'Twitter', type: 'Posts', status: 'Approved', author: 'Mark T.', reach: 0, engagement: 0 }
      ]
    });
  }

  // Ad Campaigns
  if ((await prisma.adCampaign.count()) === 0) {
    const adData = [
      { d: '2026-06-01', spend: 50000, conv: 12 },
      { d: '2026-06-02', spend: 60000, conv: 15 },
      { d: '2026-06-03', spend: 45000, conv: 10 },
      { d: '2026-06-04', spend: 75000, conv: 22 },
      { d: '2026-06-05', spend: 55000, conv: 14 },
      { d: '2026-06-06', spend: 80000, conv: 28 }
    ];
    await prisma.adCampaign.createMany({
      data: adData.map(x => ({
        date: new Date(x.d), spend: x.spend, conversions: x.conv
      }))
    });
  }

  // Social Metrics
  if ((await prisma.socialMetric.count()) === 0) {
    await prisma.socialMetric.createMany({
      data: [
        { platform: 'Facebook', followers: 45200, engagement: '4.2%', impressions: 125000, growth: 5.2 },
        { platform: 'Instagram', followers: 32100, engagement: '6.8%', impressions: 98000, growth: 8.4 },
        { platform: 'TikTok', followers: 15400, engagement: '12.4%', impressions: 250000, growth: 15.2 },
        { platform: 'Twitter', followers: 12500, engagement: '3.1%', impressions: 45000, growth: 1.2 }
      ]
    });
  }

  // Support Tickets
  if ((await prisma.supportTicket.count()) === 0) {
    await prisma.supportTicket.createMany({
      data: [
        { customer: 'Acme Corp', subject: 'API Integration Failure', status: 'New' },
        { customer: 'John Doe', subject: 'Cannot reset password', status: 'In Progress' },
        { customer: 'Sarah W.', subject: 'Billing dispute', status: 'Escalated' }
      ]
    });
  }

  // Leave Requests
  if ((await prisma.leaveRequest.count()) === 0) {
    await prisma.leaveRequest.createMany({
      data: [
        { employee: 'Michael Obi', type: 'Annual Leave', duration: '5 days', status: 'Pending' },
        { employee: 'Jane Doe', type: 'Sick Leave', duration: '2 days', status: 'Pending' }
      ]
    });
  }

  // Commissions
  if ((await prisma.commission.count()) === 0) {
    await prisma.commission.create({
      data: {
        userId: empUser.id,
        total: 450000,
        paid: 300000,
        pending: 150000
      }
    });
  }

  console.log('✅ Dashboard specific data seeded.');
  console.log('✅ Seeding complete!');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
