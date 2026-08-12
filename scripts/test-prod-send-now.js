const axios = require('axios');
const PROD_API = 'https://api.enakoos.com/api/v1';

async function testPureProdAPI() {
  console.log('1. Logging in as CEO on production API:', PROD_API);
  const loginRes = await axios.post(`${PROD_API}/auth/login`, {
    email: 'ceo@enako.com',
    password: 'Enako@2025!',
    role: 'CEO'
  });
  const token = loginRes.data.accessToken;

  // Generate unique corporate email address for fresh user test
  const uniqueEmail = `chinji.outreach.${Date.now()}@gmail.com`;

  console.log(`2. Sending POST /employees for ${uniqueEmail} to production API now...`);
  const createRes = await axios.post(
    `${PROD_API}/employees`,
    {
      fullName: 'Chinji Clinton',
      email: uniqueEmail,
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

  console.log('🎉 Production API Response:', createRes.data);
  console.log(`📧 Account ID: ${createRes.data.id} created for ${uniqueEmail}.`);
}

testPureProdAPI().catch(err => {
  if (err.response) {
    console.error('❌ Production Error:', err.response.status, JSON.stringify(err.response.data));
  } else {
    console.error('❌ Error:', err.message);
  }
});
