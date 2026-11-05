const { PrismaClient } = require('@prisma/client');
const connectionString = require('./maintenance-config.cjs').databaseUrl();
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
