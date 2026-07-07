const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Found ${users.length} users:`);
  users.forEach(u => console.log(`- ${u.email} (${u.role.name}) ID: ${u.id}`));
  
  await prisma.$disconnect();
}

main().catch(console.error);
