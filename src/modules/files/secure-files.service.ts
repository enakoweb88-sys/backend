import { readableDocumentScanStatus, scanDocument } from '../../common/document-scanner';
import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { createConnection } from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { attachmentDisposition, previewMimeType } from '../../common/document-content';
import { Response } from 'express';

import { safeUpload, uploadLimits } from '../../common/upload-validation';
export { safeUpload, uploadLimits } from '../../common/upload-validation';
@Injectable()
export class SecureFilesService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  async prepareBase64(value: unknown, scope: string) {
    if (typeof value !== 'string' || value.length > 14000000) throw new BadRequestException('Invalid document');
    const match = /^data:(application\/pdf|image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new BadRequestException('Upload a PDF or supported image');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.toString('base64') !== match[2]) throw new BadRequestException('Invalid document encoding');
    const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[match[1]];
    return this.prepare({ buffer, size: buffer.length, originalname: 'document.' + extension } as Express.Multer.File, scope, undefined, true);
  }
  async scan(bytes: Buffer) { return scanDocument(bytes, this.config); }
  async prepare(file: Express.Multer.File, scope: string, ownerId?: string, restricted = false) {
    const validated = safeUpload(file, restricted); const scanStatus = await this.scan(file.buffer);
    return { id: randomUUID(), ownerId, scope, fileName: file.originalname, mimeType: validated.mimeType, size: file.size, sha256: createHash('sha256').update(file.buffer).digest('hex'), data: file.buffer, scanStatus, expiresAt: new Date(Date.now() + 86400000) };
  }
  async save(file: Express.Multer.File, scope: string, ownerId: string, restricted = false) {
    const saved = await this.prisma.secureFile.create({ data: await this.prepare(file, scope, ownerId, restricted) });
    return { id: saved.id, url: '/api/v1/files/private/' + saved.id, mimeType: saved.mimeType, fileName: saved.fileName };
  }
  async attach(id: string, parentId: string) { await this.prisma.secureFile.update({ where: { id }, data: { parentId, expiresAt: null } }); }
  async read(id: string, user: { sub: string; role: string; cashLevel?: string }) {
    const file = await this.prisma.secureFile.findUnique({ where: { id } });
    if (!file || !readableDocumentScanStatus(file.scanStatus, this.config) || (file.expiresAt && file.expiresAt <= new Date())) throw new NotFoundException('Document unavailable');
    let allowed = false;
    if (!user.cashLevel && file.scope !== 'cash') allowed = file.scope === 'kyc' ? ['CEO', 'MANAGER'].includes(user.role) : file.scope === 'donation' ? ['CEO', 'MANAGER', 'OUTREACH_MANAGER'].includes(user.role) : file.ownerId === user.sub || ['CEO', 'MANAGER'].includes(user.role);
    if (!allowed) throw new NotFoundException('Document unavailable');
    if (createHash('sha256').update(file.data).digest('hex') !== file.sha256) throw new ServiceUnavailableException('Document integrity check failed');
    return file;
  }
  respond(response: Response, file: { data: Buffer; mimeType: string; fileName: string }) {
    response.setHeader('Content-Type', file.mimeType); response.setHeader('Content-Disposition', attachmentDisposition(file.fileName)); response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'"); response.send(file.data);
  }
}
