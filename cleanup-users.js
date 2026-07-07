const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'employee@enako.com';
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    // Delete related records
    await prisma.message.deleteMany({ where: { senderId: user.id } });
    await prisma.taskComment.deleteMany({ where: { authorId: user.id } });
    await prisma.task.deleteMany({ where: { creatorId: user.id } });
    await prisma.task.deleteMany({ where: { assigneeId: user.id } });
    // And finally the user
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Deleted employee@enako.com');
  } else {
    console.log('employee@enako.com not found');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
