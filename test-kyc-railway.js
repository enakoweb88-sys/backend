const url = 'http://localhost:5000/api/v1/kyc/submissions';

async function testSubmit() {
  console.log(`Sending POST request to ${url}...`);
  
  const payloadData = {
    gender: 'Male',
    idType: 'National ID',
    fullName: 'Test User Railway',
    idNumber: '1234567890',
    agreement: 'true',
    signature: 'Test Signature',
    phoneNumber: '237 671063170',
    emailAddress: 'test-railway@enako.com'
  };

  const formData = new FormData();
  formData.append('applicantType', 'individual');
  formData.append('applicantName', 'Test User Railway');
  formData.append('email', 'test-railway@enako.com');
  formData.append('phone', '237 671063170');
  formData.append('payload', JSON.stringify(payloadData));

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      const errText = await res.text();
      console.error('Error Body:', errText);
    } else {
      const data = await res.json();
      console.log('Success Body:', data);
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testSubmit();
