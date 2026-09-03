const { PrismaClient } = require('@prisma/client');
const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'enakomgt@gmail.com' },
    include: { role: true, department: true }
  });
  console.log('Manager details:', JSON.stringify(user, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
