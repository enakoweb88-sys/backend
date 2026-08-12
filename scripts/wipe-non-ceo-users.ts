/**
 * ENAKO OS — One-time script: Delete all non-CEO users from the database.
 * This wipes all MANAGER, EMPLOYEE, OUTREACH_MANAGER accounts so the CEO
 * can re-create every team member fresh with proper corporate emails.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/wipe-non-ceo-users.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Find all CEO role IDs so we never delete them
  const ceoRoles = await prisma.role.findMany({
    where: { name: 'CEO' },
  });
  const ceoRoleIds = ceoRoles.map((r: any) => r.id);

  if (ceoRoleIds.length === 0) {
    console.warn('⚠️  No CEO role found in the database. Aborting to prevent total wipe.');
    process.exit(1);
  }

  // 2. Find all non-CEO users
  const nonCeoUsers = await prisma.user.findMany({
    where: {
      roleId: { notIn: ceoRoleIds },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: { select: { name: true } },
    },
  });

  if (nonCeoUsers.length === 0) {
    console.log('✅ No non-CEO users found. Database is already clean.');
    process.exit(0);
  }

  console.log(`\n🗑️  Found ${nonCeoUsers.length} non-CEO user(s) to delete:\n`);
  nonCeoUsers.forEach((u: any) => {
    console.log(`  • [${u.role.name}] ${u.fullName} <${u.email}>`);
  });

  const nonCeoIds = nonCeoUsers.map((u: any) => u.id);

  // 3. Clean up all related records before deleting users
  console.log('\n🧹 Cleaning up related records...');

  // UserPreference (userId, cascade)
  await prisma.userPreference.deleteMany({ where: { userId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted user preferences');

  // Tasks (assigneeId or creatorId)
  await prisma.task.deleteMany({
    where: { OR: [{ assigneeId: { in: nonCeoIds } }, { creatorId: { in: nonCeoIds } }] },
  });
  console.log('  ✓ Deleted tasks');

  // Goals (ownerId)
  await prisma.goal.deleteMany({ where: { ownerId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted goals');

  // Messages (senderId)
  await prisma.message.deleteMany({ where: { senderId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted messages');

  // Notifications (userId)
  await prisma.notification.deleteMany({ where: { userId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted notifications');

  // Expenses (userId)
  await prisma.expense.deleteMany({ where: { userId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted expenses');

  // MealRecord (employeeId)
  await prisma.mealRecord.deleteMany({ where: { employeeId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted meal records');

  // PerformanceMetric (userId)
  await prisma.performanceMetric.deleteMany({ where: { userId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted performance metrics');

  // AuditLog (userId)
  await prisma.auditLog.deleteMany({ where: { userId: { in: nonCeoIds } } });
  console.log('  ✓ Deleted audit logs');

  // 4. Finally delete the users themselves
  const result = await prisma.user.deleteMany({
    where: { id: { in: nonCeoIds } },
  });

  console.log(`\n✅ Successfully deleted ${result.count} non-CEO user(s).`);
  console.log('🏁 The CEO account(s) have been preserved.\n');
  console.log('The CEO can now re-create all employees from scratch via ENAKO OS → Employees → Create Employee.\n');
}

main()
  .catch((err: any) => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
