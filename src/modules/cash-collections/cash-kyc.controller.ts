import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { CurrentUser } from '../../common/current-user.decorator';
import { CashPrincipal, RequireCashPermission } from './cash-access';
import { CashAccessGuard } from './cash-access.guard';
import { CashFilesService } from './cash-files.service';
import { PrismaService } from '../prisma/prisma.service';
import { uploadLimits } from '../../common/upload-validation';
import { PublicApi } from '../../common/gateway-access';
import { Throttle } from '@nestjs/throttler';
import { isEmail } from 'class-validator';

@Controller('cash-collections/documents')
@UseGuards(CashAccessGuard)
export class CashPrivateFilesController {
  constructor(private readonly files: CashFilesService) {}
  @Get(':id') @RequireCashPermission('records.read') async read(@Param('id') id: string, @CurrentUser() user: CashPrincipal, @Res() response: Response) { this.files.respond(response, await this.files.read(id, user)); }
}

@Controller('cash-kyc/submissions')
export class CashKycController {
  constructor(private readonly prisma: PrismaService, private readonly files: CashFilesService) {}
  @Post() @PublicApi()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(AnyFilesInterceptor({ storage: memoryStorage(), limits: uploadLimits }))
  async submit(@Body() body: any, @UploadedFiles() uploads: Express.Multer.File[]) {
    if (!['individual', 'company', 'business'].includes(body.applicantType) || typeof body.applicantName !== 'string' || !body.applicantName.trim() || body.applicantName.length > 200 || !uploads?.length) throw new BadRequestException('Valid Cash applicant details and documents are required');
    if ((body.email !== undefined && (typeof body.email !== 'string' || body.email.length > 254 || !isEmail(body.email))) || (body.phone !== undefined && (typeof body.phone !== 'string' || body.phone.length > 40)) || (body.payload !== undefined && (typeof body.payload !== 'string' || Buffer.byteLength(body.payload) > 128 * 1024))) throw new BadRequestException('Invalid Cash contact or application details');
    let payload: any; try { payload = JSON.parse(body.payload || '{}'); } catch { throw new BadRequestException('Invalid Cash application'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestException('Invalid Cash application');
    const prepared: Array<Awaited<ReturnType<CashFilesService['prepare']>> & { documentType: string }> = [];
    for (const file of uploads) prepared.push({ ...(await this.files.prepare(file, 'kyc')), documentType: file.fieldname.slice(0, 80) });
    const created = await this.prisma.$transaction(async tx => {
      const item = await tx.cashKycSubmission.create({ data: { applicantType: body.applicantType, applicantName: body.applicantName.trim(), email: typeof body.email === 'string' ? body.email.slice(0, 254) : null, phone: typeof body.phone === 'string' ? body.phone.slice(0, 40) : null, payload, documents: prepared.map(file => ({ id: file.id, documentType: file.documentType, fileName: file.fileName, mimeType: file.mimeType, fileUrl: '/api/v1/cash-collections/documents/' + file.id })) } });
      for (const file of prepared) { const { documentType, ...data } = file; await tx.cashDocument.create({ data: { ...data, parentId: item.id, expiresAt: null } }); }
      await tx.cashAuditLog.create({ data: { action: 'CASH_KYC_SUBMITTED', entity: 'cash_kyc', entityId: item.id } }); return item;
    });
    return { id: created.id, status: created.status };
  }
  @Get() @UseGuards(CashAccessGuard) @RequireCashPermission('kyc.manage')
  list(@Query('status') status?: string) {
    if (status && !['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(status)) throw new BadRequestException('Invalid Cash KYC status');
    return this.prisma.cashKycSubmission.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  @Patch(':id/review') @UseGuards(CashAccessGuard) @RequireCashPermission('kyc.manage')
  async review(@Param('id') id: string, @Body() body: { status: string; rejectionReason?: string }, @CurrentUser() user: CashPrincipal) {
    if (!['UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(body.status) || (body.rejectionReason !== undefined && (typeof body.rejectionReason !== 'string' || body.rejectionReason.length > 2000))) throw new BadRequestException('Invalid Cash KYC review');
    return this.prisma.$transaction(async tx => {
      const item = await tx.cashKycSubmission.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Cash KYC submission not found');
      if (item.status === body.status) return item;
      if (item.status === 'APPROVED') throw new BadRequestException('Approved Cash KYC is immutable');
      const updated = await tx.cashKycSubmission.update({ where: { id, status: item.status }, data: { status: body.status, rejectionReason: body.status === 'REJECTED' ? body.rejectionReason : null, reviewedAt: new Date(), reviewedById: user.sub } });
      if (body.status === 'APPROVED') {
        const details = item.payload as Record<string, unknown>;
        await tx.cashClient.upsert({ where: { id: 'C-KYC-' + item.id }, update: {}, create: { id: 'C-KYC-' + item.id, name: item.applicantName, address: String(details?.address || details?.residentialAddress || 'Not provided').slice(0, 300), email: item.email, phone: item.phone, region: typeof details?.country === 'string' ? details.country.slice(0, 100) : 'Not provided' } });
      }
      await tx.cashAuditLog.create({ data: { actorId: user.sub, action: 'CASH_KYC_REVIEWED', entity: 'cash_kyc', entityId: id, metadata: { status: body.status } } }); return updated;
    });
  }
}
