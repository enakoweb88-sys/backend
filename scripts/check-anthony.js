const { PrismaClient } = require('@prisma/client');
const connectionString = require('./maintenance-config.cjs').databaseUrl();
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'capoatabe' } },
    include: { role: true, department: true }
  });
  console.log('Anthony user record:', JSON.stringify(user, null, 2));
  await prisma.$disconnect();
}
check();
