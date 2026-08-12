/**
 * ENAKO OS — One-time cleanup: Delete all non-CEO users.
 * Run: node scripts/wipe-non-ceo-users.js
 */
const { PrismaClient } = require('@prisma/client');

const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
});

async function main() {
  const ceoRoles = await prisma.role.findMany({ where: { name: 'CEO' } });
  const ceoRoleIds = ceoRoles.map(r => r.id);

  if (ceoRoleIds.length === 0) {
    console.warn('⚠️  No CEO role found. Aborting to prevent total wipe.');
    process.exit(1);
  }

  const nonCeoUsers = await prisma.user.findMany({
    where: { roleId: { notIn: ceoRoleIds } },
    select: { id: true, fullName: true, email: true, role: { select: { name: true } } },
  });

  if (nonCeoUsers.length === 0) {
    console.log('✅ No non-CEO users found. Database is already clean.');
    return;
  }

  console.log(`\n🗑️  Found ${nonCeoUsers.length} non-CEO user(s) to delete:\n`);
  nonCeoUsers.forEach(u => console.log(`  • [${u.role.name}] ${u.fullName} <${u.email}>`));

  const ids = nonCeoUsers.map(u => u.id);

  console.log('\n🧹 Cleaning up related records...');

  await prisma.userPreference.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.userSession.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  
  await prisma.taskComment.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.task.deleteMany({
    where: { OR: [{ assigneeId: { in: ids } }, { creatorId: { in: ids } }] },
  }).catch(() => {});

  await prisma.goal.deleteMany({ where: { ownerId: { in: ids } } }).catch(() => {});
  await prisma.message.deleteMany({ where: { senderId: { in: ids } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.expense.deleteMany({ where: { submittedById: { in: ids } } }).catch(() => {});
  await prisma.mealRecord.deleteMany({ where: { employeeId: { in: ids } } }).catch(() => {});
  await prisma.dailyReport.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  
  await prisma.announcementComment.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.announcementLike.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.announcement.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.channelMember.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});

  await prisma.performanceMetric.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {});

  // Update KycSubmissions if referenced
  await prisma.kycSubmission.updateMany({
    where: { approvedById: { in: ids } },
    data: { approvedById: null },
  }).catch(() => {});
  await prisma.kycSubmission.updateMany({
    where: { reviewedById: { in: ids } },
    data: { reviewedById: null },
  }).catch(() => {});

  const result = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log(`\n✅ Deleted ${result.count} non-CEO user(s) successfully.`);
  console.log('🏁 CEO account(s) preserved. Ready for fresh employee creation.\n');
}

main()
  .catch(err => { console.error('❌ Failed:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
