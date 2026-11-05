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
  referenceId?: string;
}

interface PaymentStatusProps {
  referenceId: string;
  amount: string;
  currency: string;
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
    return process.env.MTN_DEPOSIT_API_USER || process.env.DEPOSIT_API_USER || '';
  }

  private get apiKey() {
    return process.env.MTN_DEPOSIT_API_KEY || process.env.DEPOSIT_API_KEY || '';
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
          timeout: 10000,
          maxRedirects: 0,
          headers: {
            'Ocp-Apim-Subscription-Key': this.primaryKey
          },
          auth: {
            username: this.apiUser,
            password: this.apiKey
          }
        }
      );

      this.logger.log('MTN token fetched successfully');
      return { token: response.data.access_token };
    } catch (error: any) {
      this.logger.error('MTN provider request failed; sensitive response omitted');
      return { error: `Failed to fetch token: ${error.response?.status} - ${JSON.stringify(error.response?.data || error.message)}` };
    }
  }

  async requestToPay({ amount, currency = 'XAF', externalId, payeeMessage, payerMessage, phone, referenceId }: RequestToPayProps): Promise<{ uuid?: string; data?: any; token?: string; error?: string }> {
    const { token, error } = await this.getAuthToken();
    if (error || !token) {
      return { error: 'Failed to fetch token' };
    }

    const uuid = referenceId || crypto.randomUUID();

    try {
      // Ensure phone number starts with 237 for Cameroon MTN
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.length === 9 && (formattedPhone.startsWith('67') || formattedPhone.startsWith('65') || formattedPhone.startsWith('68') || formattedPhone.startsWith('69'))) {
        formattedPhone = '237' + formattedPhone;
      }
      
      const response = await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        {
          amount: amount.toString(),
          currency,
          externalId,
          payer: {
            partyIdType: 'MSISDN',
            partyId: formattedPhone
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
      this.logger.error('MTN provider request failed; sensitive response omitted');
      return { error: 'Failed to submit payment' };
    }
  }

  async checkPaymentStatus(uuid: string, token?: string): Promise<PaymentStatusProps | null> {
    try {
      if (!token) token = (await this.getAuthToken()).token;
      if (!token) return null;
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
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        financialTransactionId: data.financialTransactionId,
        reason: data.reason?.message
      };
    } catch (error: any) {
      this.logger.error('MTN provider request failed; sensitive response omitted');
      return null;
    }
  }
}

