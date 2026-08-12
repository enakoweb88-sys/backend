const { PrismaClient } = require('@prisma/client');
const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });

async function checkUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      email: true,
      fullName: true,
      createdAt: true,
      role: { select: { name: true } }
    }
  });
  console.log('Recent Users in DB:\n', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

checkUsers();
