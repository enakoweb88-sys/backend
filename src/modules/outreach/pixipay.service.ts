import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

interface PixiPayRequestProps {
  phone: string;
  amount: number | string;
  externalId: string;
  description: string;
  callbackUrl?: string;
}

interface PaymentStatusProps {
  referenceId: string;
  status: 'CREATED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  financialTransactionId?: string;
  reason?: string;
}

@Injectable()
export class PixiPayService {
  private readonly logger = new Logger(PixiPayService.name);

  private get baseUrl() {
    // Allows overriding via environment variable
    return process.env.PIXIPAY_BASE_URL || 'https://api.pixipay.com/v1';
  }

  private get apiKey() {
    return process.env.PIX_PAY_API_KEY || '';
  }

  private get cashInServiceId() {
    return process.env.PIX_PAY_ORANGE_CM_CASHIN_SERVICE_ID || '';
  }

  async requestToPay({ amount, externalId, description, phone, callbackUrl }: PixiPayRequestProps): Promise<{ uuid?: string; data?: any; error?: string }> {
    try {
      this.logger.log(`Initiating PixiPay Cash-In for ${phone} with amount ${amount}`);

      const uuid = crypto.randomUUID();

      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.length === 9) {
        formattedPhone = '237' + formattedPhone;
      }

      const payload = {
        amount: Number(amount),
        phone: formattedPhone,
        serviceId: this.cashInServiceId,
        reference: externalId, // Internal donation ID
        description: description,
        callbackUrl: callbackUrl, // Optional webhook URL
      };

      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': uuid
        }
      });

      return { uuid, data: response.data };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to submit PixiPay payment';
      this.logger.error('Failed to submit PixiPay requestToPay:', errorMsg);
      return { error: `PixiPay Error: ${errorMsg}` };
    }
  }

  async checkPaymentStatus(referenceId: string): Promise<PaymentStatusProps | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${referenceId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const data = response.data;
      
      // Standardize status
      let normalizedStatus: 'CREATED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED' = 'PENDING';
      if (['SUCCESS', 'COMPLETED', 'SUCCESSFUL'].includes(data.status?.toUpperCase())) {
        normalizedStatus = 'SUCCESSFUL';
      } else if (['FAILED', 'ERROR', 'REJECTED'].includes(data.status?.toUpperCase())) {
        normalizedStatus = 'FAILED';
      }

      return {
        referenceId: data.reference || referenceId,
        status: normalizedStatus,
        financialTransactionId: data.transactionId,
        reason: data.message
      };
    } catch (error: any) {
      this.logger.error(`Error checking PixiPay payment status for ${referenceId}:`, error.response?.data || error.message);
      return null;
    }
  }
}
