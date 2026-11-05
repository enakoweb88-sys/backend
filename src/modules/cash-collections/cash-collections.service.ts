import { BadRequestException, ConflictException, ForbiddenException, Injectable, MethodNotAllowedException, NotFoundException } from '@nestjs/common';
import { CashCollectionStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CashMailService } from './cash-mail.service';
import { QueryDto } from '../../common/dtos';
import { CashAccessPolicy, CashPrincipal } from './cash-access';
import { CashClientDto, CashCollectionDto, CashReceiptDto, CashStatusDto, CreateCollectorDto, DeactivateCollectorDto } from './cash.dto';

const collectorSelect = { id: true, fullName: true, email: true, phone: true, jobLabel: true, branch: true, terminalId: true, createdAt: true, status: true } as const;
const collectionInclude = { collector: { select: { id: true, fullName: true } } } as const;
const metadata = (value: string | null): Record<string, any> => { try { const data = JSON.parse(value || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; } catch { return {}; } };
const money = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

// Allowlisted output only: legacy metadata is never returned wholesale.
export function collectorResponse(user: any) {

  const names = user.fullName.trim().split(/\s+/);
  return { id: user.id, firstName: names[0] || '', lastName: names.slice(1).join(' '), fullName: user.fullName, email: user.email, phone: user.phone || '', branch: user.branch || '', role: user.jobLabel || 'Cash Collector', terminalId: user.terminalId || '', status: user.status, createdAt: user.createdAt.toISOString() };
}

@Injectable()
export class CashCollectionsService {
  constructor(private readonly prisma: PrismaService, private readonly mail: CashMailService, private readonly access: CashAccessPolicy) {}

  private audit(tx: Prisma.TransactionClient, actor: CashPrincipal, action: string, entityId: string, details: Record<string, string> = {}) {
    return tx.cashAuditLog.create({ data: { actorId: actor.sub, action, entity: 'cash', entityId, metadata: details } });
  }

  async list(query: QueryDto & { status?: string; collectorId?: string }, user: CashPrincipal) {
    const scope = this.access.scope(user);
    const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    if (typeof scope.cashUserId === 'string' && query.collectorId && query.collectorId !== user.sub) throw new ForbiddenException('Cannot access another collector');
    const where: Prisma.CashCollectionWhereInput = { ...scope, ...(query.collectorId ? { cashUserId: query.collectorId } : {}) };
    if (query.status) {
      if (!['COMPLETE', 'PENDING', 'CANCELLED'].includes(query.status)) throw new BadRequestException('Invalid cash status');
      where.status = query.status as CashCollectionStatus;
    }
    if (query.search) where.OR = [{ clientName: { contains: query.search, mode: 'insensitive' } }, { location: { contains: query.search, mode: 'insensitive' } }];
    const [items, total] = await Promise.all([this.prisma.cashCollection.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { collectionTime: 'desc' }, include: collectionInclude }), this.prisma.cashCollection.count({ where })]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, user: CashPrincipal) {
    const item = await this.prisma.cashCollection.findFirst({ where: { id, ...this.access.scope(user) }, include: collectionInclude });
    if (!item) throw new NotFoundException('Cash collection not found');
    return item;
  }

  async create(dto: CashCollectionDto, user: CashPrincipal, receiptUrl?: string) {
    const level = this.access.require(user, 'records.create');
    const collectorId = dto.collectorId || user.sub;
    if (level !== 'administrator' && collectorId !== user.sub) throw new ForbiddenException('Cannot assign another collector');
    this.access.require({ sub: collectorId }, 'records.create');
    const collector = await this.prisma.cashUser.findFirst({ where: { id: collectorId, status: 'ACTIVE' }, select: { id: true, fullName: true } });
    if (!collector) throw new BadRequestException('Active cash collector required');
    // The real FK, never descriptive JSON, determines authorization and assignment.
    const raw = metadata(dto.description);
    const description = JSON.stringify({ type: raw.type === 'PAYOUT' ? 'PAYOUT' : 'COLLECTING', notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '', assignedCollectorId: collectorId, assignedCollectorName: collector.fullName, targetAmount: money(raw.targetAmount, dto.amountCollected), actualAmountCollected: money(raw.actualAmountCollected, dto.status === 'COMPLETE' ? dto.amountCollected : 0), shortageAmount: money(raw.shortageAmount), extraAmount: money(raw.extraAmount), summaryNote: typeof raw.summaryNote === 'string' ? raw.summaryNote.slice(0, 2000) : '', depositDestination: typeof raw.depositDestination === 'string' ? raw.depositDestination.slice(0, 100) : undefined, receiptName: typeof raw.receiptName === 'string' ? raw.receiptName.slice(0, 200) : undefined });
    if (!(dto.amountCollected > 0) || !Number.isFinite(dto.amountCollected)) throw new BadRequestException('Positive amount required');
    if (level !== 'administrator' && dto.status && dto.status !== 'PENDING') throw new ForbiddenException('Collectors must create pending records');
    return this.prisma.$transaction(async tx => {
      const item = await tx.cashCollection.create({ data: { id: dto.id || undefined, cashUserId: collectorId, clientName: dto.clientName, location: dto.location, amountCollected: dto.amountCollected, outstandingBalance: dto.outstandingBalance ?? 0, currency: dto.currency || 'XAF', collectionTime: dto.collectionTime ? new Date(dto.collectionTime) : new Date(), status: dto.status || 'PENDING', description, receiptUrl: receiptUrl || dto.receiptUrl }, include: collectionInclude });
      await this.audit(tx, user, 'CASH_RECORD_CREATED', item.id);
      return item;
    });
  }

  async updateStatus(id: string, dto: CashStatusDto, user: CashPrincipal) {
    this.access.require(user, 'records.update');
    if (!['COMPLETE', 'CANCELLED'].includes(dto.status)) throw new BadRequestException('Invalid final cash status');
    return this.prisma.$transaction(async tx => {
      const where = { id, ...this.access.scope(user), status: CashCollectionStatus.PENDING };
      const current = await tx.cashCollection.findFirst({ where });
      if (!current) throw new ConflictException('Cash record is inaccessible or no longer pending');
      const details = metadata(current.description);
      const description = JSON.stringify({ ...details, ...(dto.actualAmountCollected !== undefined ? { actualAmountCollected: dto.actualAmountCollected } : {}), ...(dto.shortageAmount !== undefined ? { shortageAmount: dto.shortageAmount } : {}), ...(dto.extraAmount !== undefined ? { extraAmount: dto.extraAmount } : {}), ...(dto.summaryNote !== undefined ? { summaryNote: dto.summaryNote } : {}) });
      const changed = await tx.cashCollection.updateMany({ where, data: { status: dto.status, description } });
      if (changed.count !== 1) throw new ConflictException('Cash record is inaccessible or no longer pending');
      await this.audit(tx, user, 'CASH_STATUS_CHANGED', id, { status: dto.status });
      return tx.cashCollection.findUniqueOrThrow({ where: { id }, include: collectionInclude });
    });
  }

  async attachReceipt(id: string, receiptUrl: string, user: CashPrincipal) {
    this.access.require(user, 'records.update');
    return this.prisma.$transaction(async tx => {
      const changed = await tx.cashCollection.updateMany({ where: { id, ...this.access.scope(user), status: 'PENDING' }, data: { receiptUrl } });
      if (changed.count !== 1) throw new ConflictException('Only an accessible pending collection can receive a new receipt');
      await this.audit(tx, user, 'CASH_RECEIPT_ATTACHED', id);
      return tx.cashCollection.findUniqueOrThrow({ where: { id }, include: collectionInclude });
    });
  }

  async listCollectors(user: CashPrincipal) {
    this.access.require(user, 'collectors.manage');
    const users = await this.prisma.cashUser.findMany({ where: { status: 'ACTIVE' }, select: collectorSelect, orderBy: { createdAt: 'desc' } });
    return users.map(collectorResponse);
  }

  async listClients(user: CashPrincipal) {
    this.access.require(user, 'clients.read');
    const clients = await this.prisma.cashClient.findMany({ orderBy: { createdAt: 'desc' } });
    return clients.map(client => ({ ...client, outstandingBalance: Number(client.outstandingBalance) }));
  }

  async createClient(data: CashClientDto, user: CashPrincipal) {
    this.access.require(user, 'clients.create');
    if (!data.id?.trim() || !data.name?.trim() || !data.address?.trim()) throw new BadRequestException('Client ID, name and address required');
    return this.prisma.$transaction(async tx => {
      const client = await tx.cashClient.create({ data: { id: data.id.trim(), name: data.name.trim(), address: data.address.trim(), region: data.region || 'Cameroon', phone: data.phone || null, email: data.email?.trim().toLowerCase() || null, outstandingBalance: data.outstandingBalance ?? 0, lastVisit: data.lastVisit || 'Never' } });
      await this.audit(tx, user, 'CASH_CLIENT_CREATED', client.id);
      return { ...client, outstandingBalance: Number(client.outstandingBalance) };
    });
  }

  async deleteCollector(id: string, confirmation: DeactivateCollectorDto, user: CashPrincipal) {
    this.access.require(user, 'collectors.manage');
    if (id === user.sub || confirmation.confirmation !== id || !confirmation.reason || confirmation.reason.trim().length < 10) throw new BadRequestException('Confirm target collector ID and provide a reason');
    return this.prisma.$transaction(async tx => {
      const target = await tx.cashUser.findUnique({ where: { id },  });
      // Never suspend an unrelated/shared OS identity through cash administration.
      if (!target) throw new ForbiddenException('Cash collector not found');
      await tx.cashUser.update({ where: { id }, data: { status: 'SUSPENDED' } });
      await tx.cashSession.updateMany({ where: { cashUserId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit(tx, user, 'CASH_COLLECTOR_DEACTIVATED', id, { reasonProvided: 'true' });
      return { success: true, message: 'Collector deactivated; collection history retained' };
    });
  }

  async deleteAllCollectors(user: CashPrincipal): Promise<never> {
    this.access.require(user, 'collectors.manage');
    throw new MethodNotAllowedException('Bulk deletion is disabled; deactivate individual dedicated accounts');
  }

  async createCollector(data: CreateCollectorDto, user: CashPrincipal) {
    this.access.require(user, 'collectors.manage');
    if (!data.password || data.password.length < 12 || Buffer.byteLength(data.password, 'utf8') > 72) throw new BadRequestException('Password must be at least 12 characters and at most 72 UTF-8 bytes');
    const email = data.email.trim().toLowerCase();
    if (await this.prisma.cashUser.findUnique({ where: { email }, select: { id: true } })) throw new ConflictException('Account already exists; no account information returned');
    const fullName = (data.fullName || [data.firstName, data.lastName].filter(Boolean).join(' ')).trim();
    if (!fullName) throw new BadRequestException('Collector name required');
    const passwordHash = await bcrypt.hash(data.password, 12);
    const terminalId = 'TRM-' + randomUUID().slice(0, 13).toUpperCase();
    return this.prisma.$transaction(async tx => {
      const created = await tx.cashUser.create({ data: { fullName, email, passwordHash, passwordChangedAt: new Date(), jobLabel: 'Cash Collector', phone: data.phone, branch: data.branch || '', terminalId }, select: collectorSelect });
      await this.audit(tx, user, 'CASH_COLLECTOR_CREATED', created.id);
      return { ...collectorResponse(created), accessPendingApproval: true };
    });
  }

  async sendReceiptEmail(body: CashReceiptDto, user: CashPrincipal) {
    this.access.require(user, 'receipts.send');
    const record = await this.findOne(body.collectionId, user);
    // Never send arbitrary user-supplied content, PDFs or recipient addresses.
    const clients = await this.prisma.cashClient.findMany({ where: { name: record.clientName }, take: 2 });
    if (clients.length !== 1 || !clients[0].email) throw new BadRequestException('A unique registered cash client email is required');
    await this.prisma.cashAuditLog.create({ data: { actorId: user.sub, action: 'CASH_RECEIPT_REQUESTED', entity: 'cash', entityId: record.id } });
    return this.mail.sendCollectionReceiptAlert({ toEmail: clients[0].email, clientName: record.clientName, collectionId: record.id, amount: Number(record.amountCollected), currency: record.currency, collectorName: record.collector?.fullName || 'Cash collector', location: record.location, status: record.status });
  }

  async getStats(user: CashPrincipal) {
    const scope = this.access.scope(user), today = new Date(); today.setHours(0, 0, 0, 0);
    const [todayAgg, pendingAgg, totalAgg] = await Promise.all([
      this.prisma.cashCollection.aggregate({ where: { ...scope, collectionTime: { gte: today }, status: 'COMPLETE' }, _sum: { amountCollected: true }, _count: true }),
      this.prisma.cashCollection.aggregate({ where: { ...scope, status: 'PENDING' }, _sum: { amountCollected: true }, _count: true }),
      this.prisma.cashCollection.aggregate({ where: scope, _sum: { amountCollected: true, outstandingBalance: true }, _count: true }),
    ]);
    return { todayCollected: todayAgg._sum.amountCollected || 0, todayCount: todayAgg._count, pendingAmount: pendingAgg._sum.amountCollected || 0, pendingCount: pendingAgg._count, totalCollected: totalAgg._sum.amountCollected || 0, totalOutstanding: totalAgg._sum.outstandingBalance || 0, totalRecords: totalAgg._count };
  }
}
