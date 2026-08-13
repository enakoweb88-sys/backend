const { PrismaClient } = require('@prisma/client');
const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });

async function fixSchema() {
  console.log('Adding passwordChangedAt column if missing...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`);
    console.log('✅ Column passwordChangedAt added or verified successfully!');
  } catch (err) {
    console.error('❌ Error updating DB schema:', err.message);
  }

  // Let's test finding the outreach manager user now
  try {
    const user = await prisma.user.findFirst({
      where: { role: { name: 'OUTREACH_MANAGER' } },
      include: { role: true, department: true }
    });
    console.log('Found Outreach Manager:', JSON.stringify(user, null, 2));
  } catch (err) {
    console.error('❌ Error finding user after schema fix:', err.message);
  }

  await prisma.$disconnect();
}

fixSchema();
