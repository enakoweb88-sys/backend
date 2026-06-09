import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ENAKO OS seed...');

  const ceoRole = await prisma.role.upsert({
    where:  { name: 'CEO' },
    update: { description: 'Chief Executive Officer — full system access' },
    create: { name: 'CEO' as any, description: 'Chief Executive Officer — full system access' },
  });

  const managerRole = await prisma.role.upsert({
    where:  { name: 'MANAGER' },
    update: { description: 'Department Manager — operational access' },
    create: { name: 'MANAGER' as any, description: 'Department Manager — operational access' },
  });

  const employeeRole = await prisma.role.upsert({
    where:  { name: 'EMPLOYEE' },
    update: { description: 'Staff Member — personal workspace access' },
    create: { name: 'EMPLOYEE' as any, description: 'Staff Member — personal workspace access' },
  });

  console.log('✅ Roles seeded');

  const accounts = [
    { email: 'ceo@enako.os',      fullName: 'ENAKO CEO',      password: 'EnakoOS@CEO2025', roleId: ceoRole.id,      title: 'Chief Executive Officer' },
    { email: 'manager@enako.os',  fullName: 'ENAKO Manager',  password: 'EnakoOS@Mgr2025', roleId: managerRole.id,  title: 'Department Manager' },
    { email: 'employee@enako.os', fullName: 'ENAKO Employee', password: 'EnakoOS@Emp2025', roleId: employeeRole.id, title: 'Staff Member' },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where:  { email: account.email },
      update: { passwordHash, fullName: account.fullName, title: account.title, status: 'ACTIVE' as any },
      create: { email: account.email, fullName: account.fullName, passwordHash, title: account.title, status: 'ACTIVE' as any, roleId: account.roleId },
    });
    console.log(`✅ Seeded: ${account.email}`);
  }

  console.log('\n🎉 Seed complete!');
  console.log('   CEO      → ceo@enako.os       / EnakoOS@CEO2025');
  console.log('   Manager  → manager@enako.os   / EnakoOS@Mgr2025');
  console.log('   Employee → employee@enako.os  / EnakoOS@Emp2025');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
