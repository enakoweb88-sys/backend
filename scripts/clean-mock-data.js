const { PrismaClient } = require('@prisma/client');
if (typeof process.loadEnvFile === 'function') process.loadEnvFile();
const prisma = new PrismaClient();

async function clean() {
  console.log('--- Cleaning seeded mock leads ---');
  const mockNames = [
    'Bonaberi Central Market Vendors',
    'Mambanda Youth Cooperative',
    'Ndobo Commercial Center',
    'Test Prospect Bonaberi Supermarket'
  ];

  const deletedLeads = await prisma.marketerLead.deleteMany({
    where: {
      prospectName: { in: mockNames }
    }
  });
  console.log(`Deleted ${deletedLeads.count} mock leads.`);

  const deletedTerritories = await prisma.marketerTerritory.deleteMany({
    where: {
      region: 'Bonaberi',
      OR: [
        { zoneName: 'Bonassama', targetAudience: 'Retail shops and services' },
        { zoneName: 'Mambanda', targetAudience: 'Traders and communities' },
        { zoneName: 'Ndobo', targetAudience: 'Scheduled prospect follow-ups' },
      ],
    },
  });
  console.log(`Deleted ${deletedTerritories.count} seeded territory zones.`);

  const templateTitles = [
    'Prospecting', 'Verified Akawo account activations', 'Landbanking accounts with first payment',
    'Customer follow-up within 48 hours', 'Customer retention: second payment within 30 days',
    'Daily field reports and office check-ins', 'Conduct and attendance',
  ];
  const deletedTemplateGoals = await prisma.goal.deleteMany({
    where: { title: { in: templateTitles }, currentValue: 0 },
  });
  console.log(`Deleted ${deletedTemplateGoals.count} untouched auto-generated KPI goals.`);

  console.log('--- Cleaning test FIELD daily reports ---');
  // Find test reports that contain the test JSON strings
  const testReports = await prisma.dailyReport.findMany({
    where: {
      type: 'FIELD',
      content: { contains: 'ACC-2026-BON-01' }
    }
  });

  console.log(`Found ${testReports.length} test daily reports.`);
  for (const r of testReports) {
    await prisma.dailyReport.delete({ where: { id: r.id } });
    console.log(`Deleted test daily report ${r.id}`);
  }

  const remainingLeads = await prisma.marketerLead.count();
  const remainingReports = await prisma.dailyReport.count({ where: { type: 'FIELD' } });
  const remainingTerritories = await prisma.marketerTerritory.count();

  console.log(`\nRemaining leads in DB: ${remainingLeads}`);
  console.log(`Remaining FIELD reports in DB: ${remainingReports}`);
  console.log(`Remaining assigned territories in DB: ${remainingTerritories}`);

  await prisma.$disconnect();
}

clean().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
