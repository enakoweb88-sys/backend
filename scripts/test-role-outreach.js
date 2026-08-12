const axios = require('axios');
const PROD_API = 'https://api.enakoos.com/api/v1';

async function testOutreachRole() {
  try {
    const loginRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'ceo@enako.com',
      password: 'Enako@2025!',
      role: 'CEO'
    });

    const token = loginRes.data.accessToken;

    console.log('Testing OUTREACH_MANAGER role creation...');
    const createRes = await axios.post(
      `${PROD_API}/employees`,
      {
        fullName: 'Test Outreach Officer',
        email: `test.outreach.${Date.now()}@gmail.com`,
        phone: '+237690000000',
        title: 'Outreach Manager',
        role: 'OUTREACH_MANAGER',
        department: 'Outreach / NGO',
        password: 'Password@2026!',
        employmentType: 'Full-Time',
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('✅ OUTREACH_MANAGER Created successfully! ID:', createRes.data.id);
  } catch (err) {
    if (err.response) {
      console.error('❌ OUTREACH_MANAGER Error:', err.response.status, JSON.stringify(err.response.data));
    } else {
      console.error('❌ Request failed:', err.message);
    }
  }
}

testOutreachRole();
