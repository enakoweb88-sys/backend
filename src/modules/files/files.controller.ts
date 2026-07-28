import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import * as WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { FilesService } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(private readonly files: FilesService, private readonly config: ConfigService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'image/jpeg', 'image/png', 'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${file.mimetype} is not allowed`), false);
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Query('category') category?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileName = `${uniqueSuffix}${extname(file.originalname)}`;
    let fileUrl = '';

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.config.get<string>('SUPABASE_ANON_KEY');
    
    let supabase = null;
    if (supabaseUrl && supabaseKey) {
      try {
        if (!globalThis.WebSocket) {
          (globalThis as any).WebSocket = WebSocket;
        }
        supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
      } catch (err: any) {
        console.error('Supabase Client Error:', err);
      }
      
      try {
        await supabase?.storage.createBucket('general-documents', { public: true });
      } catch {
        // bucket likely already exists
      }
    }

    if (supabase) {
      const { data, error } = await supabase.storage
        .from('general-documents')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
        });
        
      if (!error && data) {
         const { data: publicData } = supabase.storage.from('general-documents').getPublicUrl(fileName);
         fileUrl = publicData.publicUrl;
      } else {
         console.error('Supabase upload error:', error);
      }
    }

    if (!fileUrl) {
      const uploadPath = join(process.cwd(), 'uploads');
      try {
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        fs.writeFileSync(join(uploadPath, fileName), file.buffer);
        fileUrl = `/uploads/${fileName}`;
      } catch (err) {
        console.error('Failed to write file locally:', err);
        throw new BadRequestException('Failed to process file upload');
      }
    }

    return this.files.saveDocument(file, user, fileUrl, fileName, category);
  }

  @Get()
  @Roles('CEO', 'MANAGER')
  list(
    @Query('userId') userId?: string,
    @Query('category') category?: string,
  ) {
    return this.files.listDocuments(userId, category);
  }

  @Delete(':id')
  @Roles('CEO', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.files.deleteDocument(id);
  }
}
