import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class CommunicationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('channel') channel = 'operations') {
    return this.prisma.message.findMany({
      where: { channel },
      include: { sender: { select: { fullName: true, role: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  @Post()
  create(@Body() body: { channel: string; content: string }, @CurrentUser() user: JwtUser) {
    return this.prisma.message.create({ data: { channel: body.channel, content: body.content, senderId: user.sub } });
  }
}
