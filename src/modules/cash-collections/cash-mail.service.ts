import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

// Shared mail-provider infrastructure is allowed; company contacts, roles,
// templates and OS audit tables are never consulted for Cash messages.
@Injectable()
export class CashMailService {
  constructor(private readonly config: ConfigService) {}
  private async send(to: string, subject: string, text: string) {
    const key = this.config.get<string>('CASH_RESEND_API_KEY');
    const from = this.config.get<string>('CASH_MAIL_FROM');
    const replyTo = this.config.get<string>('CASH_MAIL_REPLY_TO');
    if (!key || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) || !replyTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) throw new ServiceUnavailableException('Cash mail delivery is not configured');
    try {
      const result = await new Resend(key).emails.send({ to, from, replyTo, subject, text });
      if (result.error || !result.data?.id) throw Error();
      return { success: true, messageId: result.data.id };
    } catch { throw new ServiceUnavailableException('Cash email delivery failed; no delivery confirmation is available'); }
  }
  sendCollectionReceiptAlert(input: { toEmail: string; clientName: string; collectionId: string; amount: number; currency: string; collectorName: string; location: string; status: string }) {
    return this.send(input.toEmail, 'Cash collection ' + input.collectionId, ['Cash collection record', 'Reference: ' + input.collectionId, 'Client: ' + input.clientName, 'Amount: ' + input.amount + ' ' + input.currency, 'Status: ' + input.status, 'Collector: ' + input.collectorName, 'Location: ' + input.location].join('\n'));
  }
}
