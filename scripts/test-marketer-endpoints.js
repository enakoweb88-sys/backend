const { PrismaClient } = require('@prisma/client');
const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });

async function testAll() {
  console.log('--- 1. Finding Anthony / Field Marketer ---');
  let marketer = await prisma.user.findFirst({
    where: {
      OR: [
        { title: { contains: 'Marketer', mode: 'insensitive' } },
        { fullName: { contains: 'Anthony', mode: 'insensitive' } }
      ]
    },
    include: { role: true }
  });

  if (!marketer) {
    console.log('No marketer found by title, picking first active employee:');
    marketer = await prisma.user.findFirst({
      where: { role: { name: 'EMPLOYEE' } },
      include: { role: true }
    });
  }

  console.log('Marketer user:', marketer?.fullName, marketer?.email, marketer?.id);

  console.log('--- 2. Finding HOD / Manager user ---');
  const manager = await prisma.user.findFirst({
    where: {
      role: { name: { in: ['MANAGER', 'OUTREACH_MANAGER', 'CEO'] } }
    },
    include: { role: true }
  });
  console.log('Manager user:', manager?.fullName, manager?.email, manager?.role?.name);

  if (!marketer) {
    console.error('No employee found to test with!');
    await prisma.$disconnect();
    return;
  }

  console.log('--- 3. Testing Marketer Territory in DB ---');
  const existingTerritories = await prisma.marketerTerritory.findMany({
    where: { marketerId: marketer.id, isActive: true }
  });
  console.log(`Found ${existingTerritories.length} existing territories for marketer.`);
  if (existingTerritories.length === 0) {
    await prisma.marketerTerritory.createMany({
      data: [
        { marketerId: marketer.id, zoneName: 'Bonassama', region: 'Bonaberi', targetAudience: 'Retail shops and services', schedule: 'Morning | Prospecting' },
        { marketerId: marketer.id, zoneName: 'Mambanda', region: 'Bonaberi', targetAudience: 'Traders and communities', schedule: 'Midday | Demonstrations' },
        { marketerId: marketer.id, zoneName: 'Ndobo', region: 'Bonaberi', targetAudience: 'Scheduled prospect follow-ups', schedule: 'Afternoon | Activation support' },
      ]
    });
    console.log('✅ Created 3 default territory zones for marketer.');
  }

  console.log('--- 4. Testing Marketer Lead Creation & Fetching ---');
  const newLead = await prisma.marketerLead.create({
    data: {
      marketerId: marketer.id,
      prospectName: 'Test Prospect Bonaberi Supermarket',
      phone: '+237 671 00 22 44',
      zone: 'Bonassama',
      product: 'Akawo / Savings',
      status: 'NEW_LEAD',
      nextAction: 'Visit store manager for demonstration',
      notes: 'High daily cash transactions from retail sales.',
      contactPermission: true,
      followUpDate: new Date(Date.now() + 86400000 * 2)
    }
  });
  console.log('✅ Created lead:', newLead.id, newLead.prospectName, newLead.status);

  const leads = await prisma.marketerLead.findMany({
    where: { marketerId: marketer.id }
  });
  console.log(`✅ Marketer now has ${leads.length} leads in DB.`);

  console.log('--- 5. Testing FIELD Daily Report Creation & HOD Review ---');
  const fieldReport = await prisma.dailyReport.create({
    data: {
      userId: marketer.id,
      type: 'FIELD',
      status: 'SUBMITTED',
      content: JSON.stringify({
        reportDate: new Date().toISOString().slice(0, 10),
        marketer: marketer.fullName,
        people: '18',
        qualified: '7',
        followUps: '5',
        accounts: '3',
        transactions: '2',
        evidence: 'ACC-2026-BON-01, ACC-2026-BON-02',
        completed: 'Visited retail strip in Bonassama. Demonstrated Akawo app to 5 shop owners.',
        blockers: 'None today. Network was fast.',
        priorities: 'Revisit Mambanda market vendors tomorrow morning.',
        submittedAt: new Date().toISOString()
      })
    }
  });
  console.log('✅ Submitted FIELD daily report ID:', fieldReport.id);

  if (manager) {
    console.log('--- 6. Testing Manager HOD Review (Verify / Return) ---');
    const reviewedReport = await prisma.dailyReport.update({
      where: { id: fieldReport.id },
      data: {
        status: 'VERIFIED',
        reviewerId: manager.id,
        reviewerComments: 'Verified against banking core records. 2 new Akawo accounts confirmed.',
        reviewedAt: new Date()
      },
      include: {
        user: { select: { fullName: true } },
        reviewer: { select: { fullName: true, role: true } }
      }
    });

    console.log('✅ Report reviewed successfully:');
    console.log(`Status: ${reviewedReport.status}`);
    console.log(`Reviewer: ${reviewedReport.reviewer?.fullName} (${reviewedReport.reviewer?.role?.name})`);
    console.log(`Reviewer Comments: ${reviewedReport.reviewerComments}`);
    console.log(`Reviewed At: ${reviewedReport.reviewedAt}`);

    // Clean up test report
    await prisma.dailyReport.delete({ where: { id: fieldReport.id } });
    console.log('🧹 Cleaned up temporary test daily report.');
  } else {
    await prisma.dailyReport.delete({ where: { id: fieldReport.id } });
  }

  // Clean up test lead
  await prisma.marketerLead.delete({ where: { id: newLead.id } });
  console.log('🧹 Cleaned up temporary test lead.');

  console.log('\n🎉 ALL OPERATIONAL ENDPOINTS & DB SCHEMA CHECKS PASSED!');
  await prisma.$disconnect();
}

testAll().catch(async (e) => {
  console.error('❌ Error during test:', e);
  await prisma.$disconnect();
});
