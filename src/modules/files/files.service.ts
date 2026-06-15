import { Injectable } from '@nestjs/common';
import { JwtUser } from '../../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveDocument(
    file: Express.Multer.File,
    user: JwtUser,
    category = 'general',
  ) {
    const url = `/uploads/${file.filename}`;
    const doc = await this.prisma.document.create({
      data: {
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url,
        category,
        uploadedById: user.sub,
      },
    });
    return { ...doc, url };
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
