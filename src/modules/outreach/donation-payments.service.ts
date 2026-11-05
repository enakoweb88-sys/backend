import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { serializable } from '../../common/serializable';
import { PrismaService } from '../prisma/prisma.service';
import { MtnService } from './mtn.service';
import { SecureFilesService } from '../files/secure-files.service';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class DonationPaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly mtn: MtnService, private readonly files: SecureFilesService) {}

  async create(data: any, headerKey?: string) {
    const key = headerKey || data.clientRequestId;
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw new BadRequestException('Stable donation request ID required');
    if (typeof data.statusToken !== 'string' || !/^[a-f0-9]{64}$/.test(data.statusToken)) throw new BadRequestException('Client-generated status capability required');
    let amount: Prisma.Decimal;
    try { amount = new Prisma.Decimal(String(data.amount)); } catch { throw new BadRequestException('Invalid donation amount'); }
    if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2 || amount.gt('999999999999.99')) throw new BadRequestException('Invalid donation amount');
    if (!['MTN', 'BANK', 'ORANGE'].includes(data.method) || !['ONE_TIME', 'MONTHLY'].includes(data.frequency)) throw new BadRequestException('Invalid payment method or frequency');
    if (data.method === 'ORANGE') throw new ServiceUnavailableException('Orange provider contract verification is required before enabling this integration');
    if (!/^[A-Z]{3}$/.test(data.currency || 'XAF') || typeof data.fullName !== 'string' || data.fullName.length > 200 || !data.fullName.trim() || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || typeof data.phone !== 'string' || data.phone.length > 40 || typeof data.sector !== 'string' || data.sector.length > 100) throw new BadRequestException('Invalid donation details');
    if (data.documentBase64 || (data.documents && (!Array.isArray(data.documents) || data.documents.length > 3))) throw new BadRequestException('Attach up to three documents');
    const statusLookupHash = hash(data.statusToken);
    const payload = { amount: amount.toFixed(2), sector: data.sector, frequency: data.frequency, method: data.method, fullName: data.fullName.trim(), email: data.email.trim().toLowerCase(), phone: data.phone, currency: data.currency || 'XAF' };
    const requestHash = hash(JSON.stringify({ ...payload, documents: (data.documents || []).map((value: unknown) => { if (typeof value !== 'string') throw new BadRequestException('Invalid document'); return hash(value); }) })), idempotencyKey = hash('donation|' + key);
    const prior = await this.prisma.donation.findUnique({ where: { idempotencyKey } });
    const prepared: Array<Awaited<ReturnType<SecureFilesService['prepareBase64']>>> = [];
    if (!prior) for (const value of data.documents || []) prepared.push(await this.files.prepareBase64(value, 'donation'));
    const result = await serializable(this.prisma, async tx => {
      const existing = await tx.donation.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (existing.requestHash !== requestHash || existing.statusLookupHash !== statusLookupHash) throw new ConflictException('Donation request ID already used');
        return { donation: existing, created: false };
      }
      const donation = await tx.donation.create({ data: { ...payload, frequency: data.frequency, method: data.method, amount, status: 'PENDING', documents: [], idempotencyKey, requestHash, statusLookupHash, providerReference: randomUUID() } });
      for (const file of prepared) await tx.secureFile.create({ data: { ...file, parentId: donation.id, expiresAt: null } });
      if (prepared.length) await tx.donation.update({ where: { id: donation.id }, data: { documents: prepared.map(file => '/api/v1/files/private/' + file.id) } });
      await tx.auditLog.create({ data: { action: 'DONATION_INITIATED', entity: 'donation', entityId: donation.id } });
      return { donation, created: true };
    });
    if (result.created && result.donation.method === 'MTN') {
      const response = await this.mtn.requestToPay({ amount: amount.toFixed(2), currency: payload.currency, externalId: result.donation.id, referenceId: result.donation.providerReference!, phone: payload.phone, payerMessage: 'Donation', payeeMessage: 'Donation' });
      if (response.error || response.uuid !== result.donation.providerReference) throw new ServiceUnavailableException('Payment initiation is unconfirmed; retain your request ID and check status');
    }
    // paymentToken is now a limited status capability, NEVER a provider bearer token.
    return { donation: { id: result.donation.id, amount: result.donation.amount, currency: result.donation.currency }, paymentUuid: result.donation.providerReference, paymentToken: data.statusToken, status: result.donation.status };
  }

  async status(uuid: string, token: string | undefined, id: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ForbiddenException('Payment status capability required');
    const donation = await this.prisma.donation.findUnique({ where: { id } });
    if (!donation?.statusLookupHash || donation.providerReference !== uuid || !timingSafeEqual(Buffer.from(donation.statusLookupHash, 'hex'), Buffer.from(hash(token), 'hex'))) throw new NotFoundException('Payment not found');
    if (donation.method === 'BANK' || donation.status !== 'PENDING') return { status: donation.status };
    return this.confirmMtn(donation);
  }

  private async confirmMtn(donation: any) {
    if (donation.method !== 'MTN') throw new ServiceUnavailableException('Provider verification unavailable');
    const claim = await this.prisma.donation.updateMany({ where: { id: donation.id, status: 'PENDING', OR: [{ providerCheckedAt: null }, { providerCheckedAt: { lt: new Date(Date.now() - 10000) } }] }, data: { providerCheckedAt: new Date() } });
    if (!claim.count) return { status: 'PENDING' };
    // Authenticated GET confirmation, never callback-supplied status or client credentials.
    const result = await this.mtn.checkPaymentStatus(donation.providerReference);
    if (!result) return { status: 'PENDING' };
    let matches = false;
    try { matches = new Prisma.Decimal(String(result.amount)).equals(new Prisma.Decimal(String(donation.amount))); } catch {}
    if (result.referenceId !== donation.id || result.currency !== donation.currency || !matches) throw new ConflictException('Provider payment identity or amount mismatch');
    if (!['SUCCESSFUL', 'FAILED'].includes(result.status)) return { status: 'PENDING' };
    if (result.status === 'SUCCESSFUL' && (!result.financialTransactionId || result.financialTransactionId.length > 128)) throw new ConflictException('Provider transaction reference required');
    const status = result.status === 'SUCCESSFUL' ? 'SETTLED' : 'FAILED';
    return serializable(this.prisma, async tx => {
      const changed = await tx.donation.updateMany({ where: { id: donation.id, providerReference: donation.providerReference, status: 'PENDING' }, data: { status, ...(status === 'SETTLED' ? { providerTransactionId: result.financialTransactionId } : {}) } });
      if (changed.count) await tx.auditLog.create({ data: { action: 'DONATION_PROVIDER_CONFIRMED', entity: 'donation', entityId: donation.id, metadata: { status } } });
      const current = await tx.donation.findUniqueOrThrow({ where: { id: donation.id } });
      return { status: current.status };
    });
  }

  async callback(payload: any) {
    if (typeof payload?.externalId !== 'string' || payload.externalId.length > 128) throw new BadRequestException('Invalid callback reference');
    const donation = await this.prisma.donation.findUnique({ where: { id: payload.externalId } });
    if (donation?.method === 'MTN' && donation.providerReference && donation.status === 'PENDING') await this.confirmMtn(donation);
    return { received: true };
  }
}
