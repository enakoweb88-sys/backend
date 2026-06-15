import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateAnnouncementDto, QueryDto, UpdateAnnouncementDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: QueryDto) {
    return this.prisma.announcement.findMany({
      where: query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { content: { contains: query.search, mode: 'insensitive' } },
              { tag: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {},
      include: {
        author: { select: { fullName: true, role: { select: { name: true } } } },
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 50,
    });
  }

  async findOne(id: string) {
    const a = await this.prisma.announcement.findUnique({
      where: { id },
      include: { author: { select: { fullName: true, role: { select: { name: true } } } } },
    });
    if (!a) throw new NotFoundException('Announcement not found');
    return a;
  }

  create(dto: CreateAnnouncementDto, user: JwtUser) {
    return this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        tag: dto.tag,
        pinned: dto.pinned ?? false,
        authorId: user.sub,
      },
      include: {
        author: { select: { fullName: true, role: { select: { name: true } } } },
      },
    });
  }

  async update(id: string, dto: UpdateAnnouncementDto, user: JwtUser) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Announcement not found');
    if (a.authorId !== user.sub && user.role !== RoleName.CEO) {
      throw new ForbiddenException('Only the author or CEO can edit this announcement');
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.content ? { content: dto.content } : {}),
        ...(dto.tag !== undefined ? { tag: dto.tag } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
      },
      include: {
        author: { select: { fullName: true, role: { select: { name: true } } } },
      },
    });
  }

  async delete(id: string, user: JwtUser) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Announcement not found');
    if (a.authorId !== user.sub && user.role !== RoleName.CEO) {
      throw new ForbiddenException('Only the author or CEO can delete this announcement');
    }
    return this.prisma.announcement.delete({ where: { id } });
  }
}
