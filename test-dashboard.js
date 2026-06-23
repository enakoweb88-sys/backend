async function test() {
  console.log("Logging in as CEO...");
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ceo@enako.com', password: 'password123', role: 'CEO' })
  });
  if (!loginRes.ok) {
    console.log("Login failed:", await loginRes.text());
    return;
  }
  const session = await loginRes.json();
  console.log("Login success! Token:", session.accessToken.substring(0, 20) + "...");

  console.log("Fetching KYC submissions...");
  const kycRes = await fetch('http://localhost:5000/api/v1/kyc/submissions?limit=50', {
    headers: { 'Authorization': `Bearer ${session.accessToken}` }
  });
  if (!kycRes.ok) {
    console.log("KYC fetch failed:", await kycRes.text());
    return;
  }
  const kyc = await kycRes.json();
  console.log(`Successfully fetched ${kyc.length} KYC submissions!`);
}
test();
