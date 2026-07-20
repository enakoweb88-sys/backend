const http = require('http');
const https = require('https');

async function test() {
  const loginRes = await fetch('https://api.enakoos.com/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'outreach@enako.com', password: 'Outreach@2025!', role: 'OUTREACH_MANAGER' })
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData);

  if (!loginData.accessToken) return;

  const patchRes = await fetch('https://api.enakoos.com/api/v1/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginData.accessToken}` },
    body: JSON.stringify({ fullName: 'Sarah Good Updated' })
  });
  const patchData = await patchRes.text();
  console.log('Patch status:', patchRes.status);
  console.log('Patch response:', patchData);
}
test();
