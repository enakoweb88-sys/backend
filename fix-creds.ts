import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30"
    }
  }
});

async function main() {
  const newManagerPass = await bcrypt.hash('Manager@2025!', 12);
  const newEmployeePass = await bcrypt.hash('Employee@2025!', 12);

  const mgr = await prisma.user.updateMany({
    where: { email: 'manager@enako.com' },
    data: { passwordHash: newManagerPass, status: 'ACTIVE' }
  });

  const emp = await prisma.user.updateMany({
    where: { email: 'employee@enako.com' },
    data: { passwordHash: newEmployeePass, status: 'ACTIVE' }
  });

  console.log('Updated Manager count:', mgr.count);
  console.log('Updated Employee count:', emp.count);

  if (mgr.count === 0) {
    const managerRole = await prisma.role.findUnique({ where: { name: 'MANAGER' } });
    const opsDept = await prisma.department.findUnique({ where: { name: 'Operations' } });
    if (managerRole && opsDept) {
        await prisma.user.create({
          data: {
            email: 'manager@enako.com',
            fullName: 'Operations Manager',
            title: 'Operations Manager',
            passwordHash: newManagerPass,
            roleId: managerRole.id,
            departmentId: opsDept.id,
            status: 'ACTIVE',
          },
        });
        console.log('Created missing manager account.');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
