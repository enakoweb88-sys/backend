const nodemailer = require('nodemailer');

async function sendConfirmationTest() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || 'enakosupport@gmail.com';
  const pass = process.env.SMTP_PASS || 'drsg gmlk hqfz kwev';

  const recipient = 'enakoweb88@gmail.com';

  console.log(`Connecting to ${host}:${port} as ${user}...`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ENAKO Email System Confirmation</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.65;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <div style="background: #001f5b; padding: 28px 32px; color: #ffffff;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #38bdf8; margin-bottom: 6px;">ENAKO CLOUD OS • DISPATCH VERIFICATION</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Email Confirmation & Test Run</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Automated Transaction & Notification System</p>
    </div>

    <div style="padding: 32px;">
      <p style="font-size: 15px; margin: 0 0 16px 0;">Hello <strong>ENAKO Administrator</strong>,</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0;">
        This is an official test confirmation sent to <strong>${recipient}</strong> to verify the active outbound email dispatch pipeline for <strong>ENAKO OS</strong> and the <strong>Cash Collection & OTC FX Systems</strong>.
      </p>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 4px;">✔ Dispatch Engine Status: Active & Operational</div>
        <div style="font-size: 13px; color: #15803d;">Outbound delivery to your inbox has been validated successfully. All cash collections and client transaction receipts are wired to dispatch automatically.</div>
      </div>

      <div style="margin: 20px 0;">
        <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">System Dispatch Metadata</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Recipient</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${recipient}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Sender Address</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">notifications@mail.enakoos.com / ${user}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Timestamp</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${new Date().toUTCString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Trigger Event</td>
            <td style="padding: 8px 0; color: #0284c7; font-weight: 700;">Live Confirmation Run</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
        ENAKO Cloud OS • Yaoundé, Cameroon • <a href="https://enakoos.com" style="color: #0284c7; text-decoration: none;">https://enakoos.com</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"ENAKO OS Notifications" <${user}>`,
      to: recipient,
      subject: `✔ [CONFIRMATION] ENAKO OS Outbound Email Pipeline Verified - ${new Date().toLocaleDateString()}`,
      html,
    });
    console.log(`✅ Success! Confirmation email delivered to ${recipient}`);
    console.log(`MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Failed to send confirmation email:', err);
    return { success: false, error: err.message };
  }
}

sendConfirmationTest();
