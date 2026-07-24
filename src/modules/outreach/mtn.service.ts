import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface RequestToPayProps {
  phone: string;
  amount: number | string;
  currency?: string;
  externalId: string;
  payerMessage: string;
  payeeMessage: string;
}

interface PaymentStatusProps {
  referenceId: string;
  status: 'CREATED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  financialTransactionId: string;
  reason?: string;
}

@Injectable()
export class MtnService {
  private readonly logger = new Logger(MtnService.name);

  private get baseUrl() {
    return process.env.MTN_BASE_URL || 'https://proxy.momoapi.mtn.com';
  }

  private get primaryKey() {
    return process.env.MTN_PRIMARY_KEY || '';
  }

  private get apiUser() {
    return process.env.MTN_PAYMENTS_API_USER || '';
  }

  private get apiKey() {
    return process.env.MTN_PAYMENTS_API_KEY || '';
  }

  private get targetEnvironment() {
    return process.env.MTN_TARGET_ENVIRONMENT || 'mtncameroon';
  }

  async getAuthToken(): Promise<{ token?: string; error?: string }> {
    try {
      const basicAuth = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
      const response = await fetch(`${this.baseUrl}/collection/token/`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.primaryKey,
          'Authorization': `Basic ${basicAuth}`,
          'Content-Length': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch token: ${await response.text()}`);
      }

      const data = await response.json();
      return { token: data.access_token };
    } catch (error) {
      this.logger.error('Error getting token:', error);
      return { error: 'Failed to fetch token' };
    }
  }

  async requestToPay({ amount, currency = 'XAF', externalId, payeeMessage, payerMessage, phone }: RequestToPayProps): Promise<{ uuid?: string; data?: any; token?: string; error?: string }> {
    const { token, error } = await this.getAuthToken();
    if (error || !token) {
      return { error: 'Failed to fetch token' };
    }

    const uuid = crypto.randomUUID();

    try {
      const response = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Reference-Id': uuid,
          'X-Target-Environment': this.targetEnvironment,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.primaryKey
        },
        body: JSON.stringify({
          amount: amount.toString(),
          currency,
          externalId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: phone
          },
          payerMessage,
          payeeNote: payeeMessage
        })
      });

      if (!response.ok && response.status !== 202) {
        throw new Error(`Failed requestToPay: ${await response.text()}`);
      }

      // 202 means ACCEPTED by MTN
      return { uuid, data: response.status === 202 ? { status: 'ACCEPTED' } : await response.json().catch(() => ({})), token };
    } catch (err) {
      this.logger.error('Error requesting to pay:', err);
      return { error: 'Failed to request payment' };
    }
  }

  async getPaymentStatus(uuid: string, token: string): Promise<{ data?: PaymentStatusProps; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay/${uuid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.primaryKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed getPaymentStatus: ${await response.text()}`);
      }

      const result = await response.json();
      return { data: result as PaymentStatusProps };
    } catch (err) {
      this.logger.error('Error getting payment status:', err);
      return { error: 'Failed to get payment status' };
    }
  }
}
