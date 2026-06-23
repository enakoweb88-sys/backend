import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { KycReviewDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('submissions')
  @UseInterceptors(AnyFilesInterceptor({
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  submit(@Body() body: any, @UploadedFiles() files?: Express.Multer.File[]) {
    let payload: Record<string, unknown> = {};
    try {
      payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : (body.payload ?? {});
    } catch {
      payload = body;
    }

    const documents: Array<{ documentType: string; fileName: string; fileUrl: string; mimeType?: string }> = [];

    if (files?.length) {
      files.forEach(file => {
        documents.push({
          documentType: file.fieldname,
          fileName: file.originalname,
          fileUrl: `/uploads/${file.filename || file.originalname}`,
          mimeType: file.mimetype,
        });
      });
    }

    if (body.documentMeta) {
      const metas = Array.isArray(body.documentMeta) ? body.documentMeta : [body.documentMeta];
      metas.forEach((meta: string) => {
        try {
          const parsed = JSON.parse(meta);
          if (!documents.find(d => d.documentType === parsed.documentType)) {
            documents.push({ documentType: parsed.documentType, fileName: parsed.fileName, fileUrl: '' });
          }
        } catch {}
      });
    }

    return this.kyc.submit({
      applicantType: body.applicantType ?? 'individual',
      applicantName: body.applicantName ?? 'Unknown',
      email: body.email || undefined,
      phone: body.phone || undefined,
      payload,
      documents: documents.length ? documents : undefined,
    });
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
