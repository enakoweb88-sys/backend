import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { KycReviewDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService, private config: ConfigService) {}

  @Post('submissions')
  @UseInterceptors(AnyFilesInterceptor({
    storage: memoryStorage(),
  }))
  async submit(@Body() body: any, @UploadedFiles() files?: Express.Multer.File[]) {
    let payload: Record<string, unknown> = {};
    try {
      payload = typeof body.payload === 'string' ? JSON.parse(body.payload) : (body.payload ?? {});
    } catch {
      payload = body;
    }

    const documents: Array<{ documentType: string; fileName: string; fileUrl: string; mimeType?: string }> = [];

    if (files?.length) {
      const supabaseUrl = this.config.get<string>('SUPABASE_URL');
      const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.config.get<string>('SUPABASE_ANON_KEY');
      
      let supabase = null;
      if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
      }

      for (const file of files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `${uniqueSuffix}${extname(file.originalname)}`;
        let fileUrl = '';

        if (supabase) {
          const { data, error } = await supabase.storage
            .from('kyc-documents')
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
            });
            
          if (!error && data) {
             const { data: publicData } = supabase.storage.from('kyc-documents').getPublicUrl(fileName);
             fileUrl = publicData.publicUrl;
          } else {
             console.error('Supabase upload error:', error);
          }
        }

        if (!fileUrl) {
          const uploadPath = join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
          fs.writeFileSync(join(uploadPath, fileName), file.buffer);
          fileUrl = `/uploads/${fileName}`;
        }

        documents.push({
          documentType: file.fieldname,
          fileName: file.originalname,
          fileUrl,
          mimeType: file.mimetype,
        });
      }
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
