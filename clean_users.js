const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '.os' } } // only delete the original .os seed users
  });
  
  for (const u of users) {
    const id = u.id;
    console.log(`Deleting related records for ${u.email}...`);
    await prisma.message.deleteMany({ where: { senderId: id } });
    await prisma.taskComment.deleteMany({ where: { authorId: id } });
    await prisma.task.deleteMany({ where: { OR: [{ creatorId: id }, { assigneeId: id }] } });
    await prisma.expense.deleteMany({ where: { OR: [{ submittedById: id }, { reviewedById: id }] } });
    await prisma.mealRecord.deleteMany({ where: { employeeId: id } });
    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.announcement.deleteMany({ where: { authorId: id } });
    await prisma.performanceMetric.deleteMany({ where: { userId: id } });
    
    // Nullify KYC references instead of deleting KYC
    await prisma.kycSubmission.updateMany({
      where: { reviewedById: id },
      data: { reviewedById: null }
    });
    await prisma.kycSubmission.updateMany({
      where: { approvedById: id },
      data: { approvedById: null }
    });
    
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
    await prisma.auditLog.deleteMany({ where: { actorId: id } });
    await prisma.activityLog.deleteMany({ where: { userId: id } });
    await prisma.document.deleteMany({ where: { uploadedById: id } });
    await prisma.goal.deleteMany({ where: { ownerId: id } });
    await prisma.commission.deleteMany({ where: { userId: id } });
    await prisma.channelMember.deleteMany({ where: { userId: id } });
    
    console.log(`Deleting user ${u.email}...`);
    await prisma.user.delete({ where: { id } });
  }
  
  console.log('Cleanup complete!');
}

clean().catch(console.error).finally(() => prisma.$disconnect());
