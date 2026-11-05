import { SecureFilesService, uploadLimits } from './secure-files.service';
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
  constructor(private readonly files: FilesService, private readonly privateFiles: SecureFilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: uploadLimits,
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtUser,
    @Query('category') category?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const saved = await this.privateFiles.save(file, 'general', user.sub);
    const document = await this.files.saveDocument({ ...file, mimetype: saved.mimeType }, user, saved.url, saved.fileName, category);
    await this.privateFiles.attach(saved.id, document.id);
    return document;
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
