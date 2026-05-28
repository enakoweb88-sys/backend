import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.announcement.findMany({
      include: { author: { select: { fullName: true, role: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() body: { title: string; content: string; tag?: string }, @CurrentUser() user: JwtUser) {
    return this.prisma.announcement.create({
      data: { title: body.title, content: body.content, tag: body.tag, authorId: user.sub },
    });
  }
}
