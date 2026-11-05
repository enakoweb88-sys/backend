import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { SecureFilesService } from './secure-files.service';
import { PrivateFilesController } from './private-files.controller';
@Module({ imports: [PrismaModule], controllers: [FilesController, PrivateFilesController], providers: [FilesService, SecureFilesService], exports: [FilesService, SecureFilesService] })
@Global()
export class FilesModule {}
