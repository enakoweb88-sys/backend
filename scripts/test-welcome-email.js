const nodemailer = require('nodemailer');

async function testWelcome() {
  const user = 'enakosupport@gmail.com';
  const pass = 'drsg gmlk hqfz kwev';

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const to = 'enakoweb88@gmail.com';
  const subject = '🎉 Welcome to ENAKO, Test! Your Onboarding Guide & Login Credentials';
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Welcome to ENAKO!</h2>
      <p>This is a test welcome email.</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"ENAKO Support" <${user}>`,
      to,
      subject,
      html
    });
    console.log('✅ Welcome Email Sent Successfully! MessageId:', info.messageId);
  } catch (err) {
    console.error('❌ Failed to send welcome email:', err);
  }
}

testWelcome();
