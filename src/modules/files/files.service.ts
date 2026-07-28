import { Injectable } from '@nestjs/common';
import { JwtUser } from '../../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(
    file: Express.Multer.File,
    user: JwtUser,
    fileUrl: string,
    fileName: string,
    category = 'general',
  ) {
    const doc = await this.prisma.document.create({
      data: {
        fileName: fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url: fileUrl,
        category,
        uploadedById: user.sub,
      },
    });
    return { ...doc, url: fileUrl };
  }

  listDocuments(userId?: string, category?: string) {
    return this.prisma.document.findMany({
      where: {
        ...(userId ? { uploadedById: userId } : {}),
        ...(category ? { category } : {}),
      },
      include: {
        uploadedBy: { select: { fullName: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteDocument(id: string) {
    return this.prisma.document.delete({ where: { id } });
  }
}
