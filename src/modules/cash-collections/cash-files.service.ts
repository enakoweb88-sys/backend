import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { safeUpload } from '../../common/upload-validation';
import { readableDocumentScanStatus, scanDocument } from '../../common/document-scanner';
import { CashPrincipal } from './cash-access';
import { Response } from 'express';
import { attachmentDisposition } from '../../common/document-content';

@Injectable()
export class CashFilesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  async prepare(file: Express.Multer.File, scope: string, ownerId?: string) {
    const validated = safeUpload(file, true); const scanStatus = await scanDocument(file.buffer, this.config);
    return { id: randomUUID(), scope, ownerId, fileName: file.originalname, mimeType: validated.mimeType, size: file.size, data: file.buffer, sha256: createHash('sha256').update(file.buffer).digest('hex'), scanStatus, expiresAt: new Date(Date.now() + 86400000) };
  }
  async save(file: Express.Multer.File, scope: string, ownerId: string, _restricted = true) {
    const stored = await this.prisma.cashDocument.create({ data: await this.prepare(file, scope, ownerId) });
    return { id: stored.id, url: '/api/v1/cash-collections/documents/' + stored.id };
  }
  async attach(id: string, parentId: string) { await this.prisma.cashDocument.update({ where: { id }, data: { parentId, expiresAt: null } }); }
  async read(id: string, user: CashPrincipal) {
    const file = await this.prisma.cashDocument.findUnique({ where: { id } });
    if (!file || !readableDocumentScanStatus(file.scanStatus, this.config) || (file.expiresAt && file.expiresAt <= new Date()) || (user.cashLevel !== 'administrator' && file.ownerId !== user.sub)) throw new NotFoundException('Cash document unavailable');
    if (createHash('sha256').update(file.data).digest('hex') !== file.sha256) throw new ServiceUnavailableException('Cash document integrity check failed');
    return file;
  }
  respond(response: Response, file: { data: Buffer; fileName: string; mimeType: string }) {
    response.setHeader('Content-Type', file.mimeType); response.setHeader('Content-Disposition', attachmentDisposition(file.fileName)); response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'"); response.send(file.data);
  }
}
