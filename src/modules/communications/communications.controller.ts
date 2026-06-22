import { Body, Controller, Get, Post, Delete, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsGateway } from './communications.gateway';
import { CommunicationsService } from './communications.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommunicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CommunicationsGateway,
    private readonly commsService: CommunicationsService,
  ) {}

  // --- Channels Endpoints ---

  @Get('channels')
  async getChannels(@CurrentUser() user: JwtUser) {
    return this.commsService.getAvailableChannels(user.sub);
  }

  @Post('channels')
  async createChannel(
    @Body() body: { name: string; description?: string },
    @CurrentUser() user: JwtUser,
  ) {
    if (user.role !== 'CEO' && user.role !== 'MANAGER') {
      throw new ForbiddenException('Only managers and CEOs can create channels');
    }
    const channel = await this.commsService.createChannel(body.name, body.description);
    // Auto-add creator
    await this.commsService.addMember(body.name, user.sub);
    return channel;
  }

  @Get('channels/:name/members')
  async getMembers(@Param('name') name: string, @CurrentUser() user: JwtUser) {
    const hasAccess = await this.commsService.verifyChannelAccess(name, user.sub);
    if (!hasAccess) throw new ForbiddenException('Access denied');
    return this.commsService.getChannelMembers(name);
  }

  @Post('channels/:name/members')
  async addMember(
    @Param('name') name: string,
    @Body('userId') userId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (user.role !== 'CEO' && user.role !== 'MANAGER') {
      throw new ForbiddenException('Only managers and CEOs can add members');
    }
    return this.commsService.addMember(name, userId);
  }

  @Delete('channels/:name/members/:userId')
  async removeMember(
    @Param('name') name: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (user.role !== 'CEO' && user.role !== 'MANAGER') {
      throw new ForbiddenException('Only managers and CEOs can remove members');
    }
    await this.commsService.removeMember(name, userId);
    return { success: true };
  }

  // --- Messages Endpoints ---

  @Get('messages')
  async list(
    @Query('channel') channel = 'general',
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtUser,
  ) {
    if (!user) throw new ForbiddenException();

    const hasAccess = await this.commsService.verifyChannelAccess(channel, user.sub);
    if (!hasAccess) throw new ForbiddenException('You do not have access to this channel');

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

  @Post('messages')
  async create(
    @Body() body: { channel: string; content: string },
    @CurrentUser() user: JwtUser,
  ) {
    const hasAccess = await this.commsService.verifyChannelAccess(body.channel, user.sub);
    if (!hasAccess) throw new ForbiddenException('You do not have access to this channel');

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

    // Broadcast to WebSocket clients
    // Ideally we broadcast only to those in the channel, but gateway currently uses emit
    this.gateway.server.to(`channel:${body.channel}`).emit('message:created', message);

    return message;
  }
}
