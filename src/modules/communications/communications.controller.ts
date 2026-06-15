import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsGateway } from './communications.gateway';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class CommunicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CommunicationsGateway,
  ) {}

  @Get()
  async list(
    @Query('channel') channel = 'operations',
    @Query('limit') limit?: string,
  ) {
    return this.prisma.message.findMany({
      where: { channel },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit ? Number(limit) : 100,
    });
  }

  @Post()
  async create(
    @Body() body: { channel: string; content: string },
    @CurrentUser() user: JwtUser,
  ) {
    const message = await this.prisma.message.create({
      data: {
        channel: body.channel,
        content: body.content,
        senderId: user.sub,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    // Broadcast to WebSocket clients in the channel
    this.gateway.broadcastAll('message:created', message);

    return message;
  }
}
