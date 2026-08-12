const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const connectionString = "postgresql://postgres.ltdodqloxdpnsvthkowl:enakoos2026@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?connect_timeout=30";
const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } });
const PROD_API = 'https://api.enakoos.com/api/v1';

async function testCleanAndCreate() {
  const targetEmail = 'enakoweb88@gmail.com';

  console.log(`1. Deleting any existing user with email ${targetEmail} from database...`);
  const u = await prisma.user.findFirst({ where: { email: targetEmail } });
  if (u) {
    const ceoRoles = await prisma.role.findMany({ where: { name: 'CEO' } });
    const ceoRoleIds = ceoRoles.map(r => r.id);
    if (!ceoRoleIds.includes(u.roleId)) {
      await prisma.user.delete({ where: { id: u.id } }).catch(err => console.log('Delete note:', err.message));
      console.log(`✓ Deleted old account for ${targetEmail}`);
    } else {
      console.log('⚠️ Target email belongs to CEO account. Will use test email.');
    }
  }

  console.log('2. Logging in as CEO on production API:', PROD_API);
  const loginRes = await axios.post(`${PROD_API}/auth/login`, {
    email: 'ceo@enako.com',
    password: 'Enako@2025!',
    role: 'CEO'
  });

  const token = loginRes.data.accessToken;

  console.log(`3. Creating fresh Outreach Manager account for ${targetEmail} via production API...`);
  const createRes = await axios.post(
    `${PROD_API}/employees`,
    {
      fullName: 'Chinji Clinton',
      email: targetEmail,
      phone: '+237690000000',
      title: 'Outreach Manager',
      role: 'OUTREACH_MANAGER',
      department: 'Outreach / NGO',
      password: 'OutreachPassword@2026!',
      employmentType: 'Full-Time',
      responsibilities: 'Oversee ENAKO Outreach Foundation operations (enakooutreach.cm), direct charity fundraising campaigns, review and verify scholarship applications, coordinate community development projects, manage donor communications, and publish monthly impact reports.',
      goals: '1. Launch 3 major community development campaigns this quarter.\n2. Increase diaspora recurring donor subscriptions by 25%.\n3. Process and verify 100+ scholarship applications.\n4. Achieve 98% donor satisfaction rate.'
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  console.log('🎉 SUCCESS! Account created on production DB! ID:', createRes.data.id);
  console.log(`📧 Onboarding welcome email dispatched directly to ${targetEmail}!`);

  await prisma.$disconnect();
}

testCleanAndCreate().catch(err => {
  if (err.response) {
    console.error('❌ Production Error:', err.response.status, JSON.stringify(err.response.data));
  } else {
    console.error('❌ Request failed:', err.message);
  }
  prisma.$disconnect();
});
