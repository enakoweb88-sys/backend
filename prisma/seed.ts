/**
 * ENAKO OS — Database Seed Script
 * Run: npx ts-node prisma/seed.ts
 * Or add to package.json: "prisma": { "seed": "ts-node prisma/seed.ts" }
 * Then run: npx prisma db seed
 *
 * Test Credentials:
 *   CEO      → ceo@enako.os       / EnakoOS@CEO2025
 *   Manager  → manager@enako.os   / EnakoOS@Mgr2025
 *   Employee → employee@enako.os  / EnakoOS@Emp2025
 */

import { PrismaClient, RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ENAKO OS seed...');

  // ── 1. Upsert Roles ──────────────────────────────────────────────────────
  const ceoRole = await prisma.role.upsert({
    where:  { name: RoleName.CEO },
    update: { description: 'Chief Executive Officer — full system access' },
    create: { name: RoleName.CEO, description: 'Chief Executive Officer — full system access' },
  });

  const managerRole = await prisma.role.upsert({
    where:  { name: RoleName.MANAGER },
    update: { description: 'Department Manager — operational access' },
    create: { name: RoleName.MANAGER, description: 'Department Manager — operational access' },
  });

  const employeeRole = await prisma.role.upsert({
    where:  { name: RoleName.EMPLOYEE },
    update: { description: 'Staff Member — personal workspace access' },
    create: { name: RoleName.EMPLOYEE, description: 'Staff Member — personal workspace access' },
  });

  console.log('✅ Roles seeded');

  // ── 2. Upsert Test Users ──────────────────────────────────────────────────
  const SALT_ROUNDS = 12;

  const accounts = [
    {
      email:    'ceo@enako.os',
      fullName: 'ENAKO CEO',
      password: 'EnakoOS@CEO2025',
      roleId:   ceoRole.id,
      title:    'Chief Executive Officer',
    },
    {
      email:    'manager@enako.os',
      fullName: 'ENAKO Manager',
      password: 'EnakoOS@Mgr2025',
      roleId:   managerRole.id,
      title:    'Department Manager',
    },
    {
      email:    'employee@enako.os',
      fullName: 'ENAKO Employee',
      password: 'EnakoOS@Emp2025',
      roleId:   employeeRole.id,
      title:    'Staff Member',
    },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);
    await prisma.user.upsert({
      where:  { email: account.email },
      update: { passwordHash, fullName: account.fullName, title: account.title, status: UserStatus.ACTIVE },
      create: {
        email:        account.email,
        fullName:     account.fullName,
        passwordHash,
        title:        account.title,
        status:       UserStatus.ACTIVE,
        roleId:       account.roleId,
      },
    });
    console.log(`✅ User seeded: ${account.email} [${account.roleId === ceoRole.id ? 'CEO' : account.roleId === managerRole.id ? 'MANAGER' : 'EMPLOYEE'}]`);
  }

  console.log('');
  console.log('🎉 Seed complete! Test credentials:');
  console.log('   CEO      → ceo@enako.os       / EnakoOS@CEO2025');
  console.log('   Manager  → manager@enako.os   / EnakoOS@Mgr2025');
  console.log('   Employee → employee@enako.os  / EnakoOS@Emp2025');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
