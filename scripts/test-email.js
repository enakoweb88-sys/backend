const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER || 'enakosupport@gmail.com';
const pass = process.env.SMTP_PASS || 'drsg gmlk hqfz kwev';

console.log(`Connecting to ${host}:${port} with user: ${user}...`);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false, // 587 uses STARTTLS
  auth: {
    user,
    pass,
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error);
  } else {
    console.log('✅ SMTP Connection Success! Server is ready to send messages.');
    
    transporter.sendMail({
      from: `"ENAKO Support" <${user}>`,
      to: 'enakoweb88@gmail.com',
      subject: '🧪 ENAKO OS Production SMTP Test Email',
      html: '<h1>SMTP Test Success!</h1><p>If you see this email, Gmail App Password SMTP is working 100%.</p>'
    }).then(info => {
      console.log('📧 Test email sent! MessageId:', info.messageId);
    }).catch(err => {
      console.error('❌ sendMail failed:', err);
    });
  }
});
