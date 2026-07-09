import { Injectable, OnModuleInit, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunicationsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedInitialChannels();
  }

  private async seedInitialChannels() {
    const defaultChannels = [
      { name: 'general', isGeneral: true },
      { name: 'operations', isGeneral: true },
      { name: 'compliance', isGeneral: true },
      { name: 'finance', isGeneral: true },
      { name: 'management', isGeneral: true },
      { name: 'announcements', isGeneral: true },
    ];

    for (const ch of defaultChannels) {
      await this.prisma.channel.upsert({
        where: { name: ch.name },
        update: { isGeneral: ch.isGeneral },
        create: {
          name: ch.name,
          isGeneral: ch.isGeneral,
          description: `Default ${ch.name} channel`,
        },
      });
    }
  }

  async getAvailableChannels(userId: string) {
    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      include: { role: true, department: true }
    });
    if (!user) return [];

    if (user.role?.name === 'CEO' || user.role?.name === 'MANAGER') {
      return this.prisma.channel.findMany({ orderBy: { name: 'asc' } });
    }

    const deptName = user.department?.name?.toLowerCase();

    return this.prisma.channel.findMany({
      where: {
        OR: [
          { isGeneral: true },
          { members: { some: { userId } } },
          deptName ? { name: deptName } : { id: 'impossible-match' },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async verifyChannelAccess(channelName: string, userId: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { name: channelName },
      include: { members: { where: { userId } } },
    });

    if (!channel) return false;
    if (channel.isGeneral) return true;
    return channel.members.length > 0;
  }

  async createChannel(name: string, description?: string, isGeneral = false) {
    const existing = await this.prisma.channel.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException(`Channel ${name} already exists`);
    }

    return this.prisma.channel.create({
      data: {
        name,
        description,
        isGeneral,
      },
    });
  }

  async getChannelMembers(channelName: string) {
    const channel = await this.prisma.channel.findUnique({ where: { name: channelName } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.isGeneral) {
      // For general channels, ideally everyone is a member, but we can just return all users or indicate it's general
      // For simplicity, let's return all active users
      return this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: { select: { name: true } },
          avatarUrl: true,
        },
      });
    }

    const members = await this.prisma.channelMember.findMany({
      where: { channelId: channel.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: { select: { name: true } },
            avatarUrl: true,
          },
        },
      },
    });

    return members.map(m => m.user);
  }

  async addMember(channelName: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { name: channelName } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.isGeneral) {
      throw new ConflictException('Cannot manually add members to a general channel');
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: channel.id,
          userId,
        },
      },
    });

    if (existing) return existing;

    return this.prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId,
      },
    });
  }

  async removeMember(channelName: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { name: channelName } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.isGeneral) {
      throw new ConflictException('Cannot remove members from a general channel');
    }

    try {
      await this.prisma.channelMember.delete({
        where: {
          channelId_userId: {
            channelId: channel.id,
            userId,
          },
        },
      });
    } catch (e) {
      // Ignored if member doesn't exist
    }
  }
}
