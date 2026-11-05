import { Injectable, ServiceUnavailableException } from '@nestjs/common';
@Injectable()
export class PixiPayService {
  async requestToPay(_input: unknown): Promise<{ uuid?: string; error?: string }> { throw new ServiceUnavailableException('Orange/PixiPay contract verification is required'); }
  async checkPaymentStatus(_reference: string): Promise<null> { throw new ServiceUnavailableException('Orange/PixiPay contract verification is required'); }
}
