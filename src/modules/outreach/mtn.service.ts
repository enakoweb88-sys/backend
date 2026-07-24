import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';

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
    return process.env.MTN_PRIMARY_KEY || process.env.PRIMARY_KEY || '';
  }

  private get apiUser() {
    return process.env.MTN_PAYMENTS_API_USER || process.env.PAYMENTS_API_USER || '';
  }

  private get apiKey() {
    return process.env.MTN_PAYMENTS_API_KEY || process.env.PAYMENTS_API_KEY || '';
  }

  private get targetEnvironment() {
    return process.env.MTN_TARGET_ENVIRONMENT || 'mtncameroon';
  }

  async getAuthToken(): Promise<{ token?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.primaryKey
          },
          auth: {
            username: this.apiUser,
            password: this.apiKey
          }
        }
      );

      return { token: response.data.access_token };
    } catch (error: any) {
      this.logger.error('Error getting token:', error.response?.data || error.message);
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
      const response = await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        {
          amount: amount.toString(),
          currency,
          externalId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: phone
          },
          payerMessage,
          payeeNote: payeeMessage
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Reference-Id': uuid,
            'X-Target-Environment': this.targetEnvironment,
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': this.primaryKey
          }
        }
      );

      return { uuid, data: response.data, token };
    } catch (error: any) {
      this.logger.error('Failed to submit requestToPay:', error.response?.data || error.message);
      return { error: 'Failed to submit payment' };
    }
  }

  async checkPaymentStatus(uuid: string, token: string): Promise<PaymentStatusProps | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collection/v1_0/requesttopay/${uuid}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Target-Environment': this.targetEnvironment,
            'Ocp-Apim-Subscription-Key': this.primaryKey
          }
        }
      );

      const data = response.data;
      return {
        referenceId: data.externalId,
        status: data.status,
        financialTransactionId: data.financialTransactionId,
        reason: data.reason?.message
      };
    } catch (error: any) {
      this.logger.error(`Error checking payment status for ${uuid}:`, error.response?.data || error.message);
      return null;
    }
  }
}
