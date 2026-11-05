import { PublicApi } from '../../common/gateway-access';
import { Throttle } from '@nestjs/throttler';
import { SecureFilesService, uploadLimits } from '../files/secure-files.service';
import { BadRequestException } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFiles, HttpException, NotFoundException, ServiceUnavailableException, Res } from '@nestjs/common';
import { Response } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import * as WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { KycReviewDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService, private config: ConfigService, private readonly privateFiles: SecureFilesService) {}

  @Get('submissions/:submissionId/documents/:documentId/file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'MANAGER')
  async documentFile(
    @Param('submissionId') submissionId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document = await this.kyc.findDocument(submissionId, documentId);
    if (!document?.fileUrl) throw new NotFoundException('This document has no stored file. Please request a new upload.');

    if (document.fileUrl.startsWith('/api/v1/files/private/')) {
      const file = await this.privateFiles.read(document.fileUrl.split('/').pop()!, { sub: '', role: 'MANAGER' });
      this.privateFiles.respond(response, file); return;
    }
    let bytes: Buffer;
    let mimeType = 'application/octet-stream';
    if (document.fileUrl.startsWith('/uploads/')) {
      const name = document.fileUrl.slice('/uploads/'.length);
      if (!/^[\w.-]+$/.test(name)) throw new NotFoundException('Invalid document path.');
      try {
        bytes = await fs.promises.readFile(join(process.cwd(), 'uploads', name));
      } catch {
        throw new NotFoundException('The stored file is missing. Please request a new upload.');
      }
    } else {
      // Resolve legacy project URLs by object path against the configured storage project.
      let path: string;
      try {
        const url = new URL(document.fileUrl);
        const prefix = '/storage/v1/object/public/kyc-documents/';
        if (!url.pathname.startsWith(prefix)) throw new Error('Unsupported storage URL');
        path = decodeURIComponent(url.pathname.slice(prefix.length));
        if (!path || path.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid path');
      } catch {
        throw new NotFoundException('This document has an unsupported storage link. Please request a new upload.');
      }
      const storageUrl = this.config.get<string>('SUPABASE_URL');
      const storageKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!storageUrl || !storageKey) throw new ServiceUnavailableException('Document storage is not configured. Please contact the administrator.');
      try {
        const storage = createClient(storageUrl, storageKey, { auth: { persistSession: false } });
        const { data, error } = await storage.storage.from('kyc-documents').download(path);
        if (error || !data) throw new Error('Storage download failed');
        bytes = Buffer.from(await data.arrayBuffer());
        mimeType = data.type || mimeType;
      } catch {
        throw new ServiceUnavailableException('The document could not be retrieved from storage. Please retry or request a new upload if the file is missing.');
      }
    }
    const contentType = document.mimeType || mimeType;
    const previewTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'text/plain'];
    response.setHeader('Content-Type', previewTypes.includes(contentType) ? contentType : 'application/octet-stream');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(bytes);
  }

  @Post('submissions')
  @PublicApi()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(AnyFilesInterceptor({ storage: memoryStorage(), limits: uploadLimits }))
  async submit(@Body() body: any, @UploadedFiles() files?: Express.Multer.File[]) {
    if (!['individual', 'business', 'company', 'corporate'].includes(body.applicantType) || typeof body.applicantName !== 'string' || !body.applicantName.trim() || body.applicantName.length > 200 || (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) || (body.phone && (typeof body.phone !== 'string' || body.phone.length > 40))) throw new BadRequestException('Invalid applicant details');
    let payload: Record<string, unknown>;
    try { payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : body.payload; } catch { throw new BadRequestException('Invalid application details'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || JSON.stringify(payload).length > 128 * 1024) throw new BadRequestException('Invalid application details');
    if (!files?.length) throw new BadRequestException('Attach your verification documents');
    const prepared = [];
    for (const file of files) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(file.fieldname)) throw new BadRequestException('Invalid document field');
      prepared.push({ ...(await this.privateFiles.prepare(file, 'kyc', undefined, true)), documentType: file.fieldname });
    }
    const submission = await this.kyc.submit({ applicantType: body.applicantType, applicantName: body.applicantName.trim(), email: body.email, phone: body.phone, payload }, prepared);
    return { id: submission.id, status: submission.status, createdAt: submission.createdAt };
  }

  @Get('submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'MANAGER')
  list(@Query() query: QueryDto) {
    return this.kyc.list(query);
  }

  @Patch('submissions/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CEO', 'MANAGER')
  review(@Param('id') id: string, @Body() dto: KycReviewDto, @CurrentUser() user: JwtUser) {
    return this.kyc.review(id, dto, user);
  }
}
