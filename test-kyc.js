const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.kycSubmission.count();
  console.log('Total KYC submissions:', count);
  const submissions = await prisma.kycSubmission.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(submissions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
