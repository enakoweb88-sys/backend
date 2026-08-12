const axios = require('axios');

const PROD_API = 'https://api.enakoos.com/api/v1';

async function testProductionEmployeeCreation() {
  console.log('1. Logging in as CEO on production API:', PROD_API);
  
  try {
    const loginRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'ceo@enako.com',
      password: 'Enako@2025!',
      role: 'CEO'
    });

    const token = loginRes.data.accessToken;
    console.log('✅ CEO Login successful! Token received.');

    console.log('2. Creating test employee via production API...');
    const testEmail = `test.outreach.${Date.now()}@gmail.com`; // or real email
    const createRes = await axios.post(
      `${PROD_API}/employees`,
      {
        fullName: 'Test Outreach Lead',
        email: 'enakoweb88@gmail.com', // Sending to real user email
        phone: '+237690000000',
        title: 'Outreach Manager',
        role: 'OUTREACH_MANAGER',
        department: 'Outreach / NGO',
        password: 'Password@2026!',
        employmentType: 'Full-Time',
        responsibilities: 'Oversee ENAKO Outreach Foundation operations and scholarships.',
        goals: '1. Reach 100+ students.\n2. Increase recurring donors.'
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Employee Created successfully on Production DB! ID:', createRes.data.id);
    console.log('📧 Check your inbox atenakoweb88@gmail.com for the welcome email!');
  } catch (err) {
    if (err.response) {
      console.error('❌ Production API Error:', err.response.status, err.response.data);
    } else {
      console.error('❌ Request failed:', err.message);
    }
  }
}

testProductionEmployeeCreation();
