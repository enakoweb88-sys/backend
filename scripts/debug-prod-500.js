const axios = require('axios');

const PROD_API = 'https://api.enakoos.com/api/v1';

async function debugProductionEmployeeCreation() {
  try {
    const loginRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'ceo@enako.com',
      password: 'Enako@2025!',
      role: 'CEO'
    });

    const token = loginRes.data.accessToken;

    console.log('Testing employee creation without optional responsibilities/goals...');
    const createRes1 = await axios.post(
      `${PROD_API}/employees`,
      {
        fullName: 'Test Employee Standard',
        email: `test.std.${Date.now()}@gmail.com`,
        phone: '+237690000000',
        title: 'Backend Engineer',
        role: 'EMPLOYEE',
        department: 'Engineering',
        password: 'Password@2026!',
        employmentType: 'Full-Time',
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('✅ Standard Employee Created successfully! ID:', createRes1.data.id);
  } catch (err) {
    if (err.response) {
      console.error('❌ Standard Employee Error:', err.response.status, JSON.stringify(err.response.data));
    } else {
      console.error('❌ Request failed:', err.message);
    }
  }
}

debugProductionEmployeeCreation();
