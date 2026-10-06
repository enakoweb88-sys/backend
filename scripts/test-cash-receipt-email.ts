import { ConfigService } from '@nestjs/config';
import { MailService } from '../src/modules/mail/mail.service';

async function testCashReceiptEmail() {
  const configService = new ConfigService();
  const mailService = new MailService(configService);

  const recipient = 'enakoweb88@gmail.com';
  console.log(`Sending cash collection receipt email test to: ${recipient}...`);

  const result = await mailService.sendCollectionReceiptAlert({
    toEmail: recipient,
    clientName: 'Nchang Chelsea',
    collectionId: 'COL-9482',
    amount: 1500000,
    currency: 'FCFA',
    collectorName: 'Field Cash Collector (ACC-2746)',
    location: 'Douala Commercial Center',
    status: 'PENDING',
    time: new Date().toLocaleTimeString(),
    depositDestination: 'ECOBANK',
  });

  console.log('Dispatch result:', result);
  if (result.success) {
    console.log(`✅ Success! Cash Collection Receipt Email sent directly to ${recipient}! MessageId: ${result.messageId}`);
  } else {
    console.error('❌ Failed:', result.error);
  }
}

testCashReceiptEmail().catch(console.error);
