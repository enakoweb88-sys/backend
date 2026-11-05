const { PrismaClient } = require('@prisma/client');
const connectionString = require('./maintenance-config.cjs').databaseUrl();
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
