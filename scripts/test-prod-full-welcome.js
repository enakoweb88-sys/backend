const axios = require('axios');
const PROD_API = 'https://api.enakoos.com/api/v1';

async function testFullOnboardingEmailToUser() {
  try {
    const loginRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'ceo@enako.com',
      password: 'Enako@2025!',
      role: 'CEO'
    });

    const token = loginRes.data.accessToken;

    console.log('Creating Outreach Manager account on production API for enakoweb88@gmail.com...');
    const createRes = await axios.post(
      `${PROD_API}/employees`,
      {
        fullName: 'Chinji Clinton',
        email: 'enakoweb88@gmail.com', // Sending directly to user's real email
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
    console.log('📧 Onboarding welcome email dispatched directly to enakoweb88@gmail.com!');
  } catch (err) {
    if (err.response) {
      console.error('❌ Production Error:', err.response.status, JSON.stringify(err.response.data));
    } else {
      console.error('❌ Request failed:', err.message);
    }
  }
}

testFullOnboardingEmailToUser();
