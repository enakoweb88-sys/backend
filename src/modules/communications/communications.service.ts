import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { ensurePrivateConversation } from "./private-chat";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CommunicationsService  {
  constructor(private readonly prisma: PrismaService) {}

  async privateContacts(userId: string) {
    return this.prisma.user.findMany({
      where: { status: "ACTIVE", id: { not: userId } },
      select: { id: true, fullName: true, role: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    });
  }

  async startPrivateConversation(userId: string, recipientId: string) {
    if (!recipientId || recipientId === userId)
      throw new ForbiddenException("Choose another employee");
    const recipient = await this.prisma.user.findFirst({
      where: { id: recipientId, status: "ACTIVE" },
    });
    if (!recipient) throw new NotFoundException("Employee not found");
    return this.prisma.$transaction((tx) =>
      ensurePrivateConversation(tx, userId, recipientId),
    );
  }

  async getAvailableChannels(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, department: true },
    });
    if (!user) return [];

    const channels = await this.prisma.channel.findMany({ include: { members: { include: { user: { select: { id: true, fullName: true } } } } }, orderBy: { name: 'asc' } });
    const allowed = await Promise.all(channels.map(async channel => ({ channel, allowed: await this.verifyChannelAccess(channel.name, userId) })));
    return allowed.filter(item => item.allowed).map(item => item.channel);
  }

  async verifyChannelAccess(
    channelName: string,
    userId: string,
  ): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { name: channelName },
      include: { members: { where: { userId } } },
    });

    if (!channel) return false;
    if (channelName.startsWith("dm:")) return channel.members.length > 0;
    if (channel.members.length) return true;
    // Legacy seed data marked privileged channels general: never trust that flag.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user || user.status !== 'ACTIVE') return false;
    if (['finance', 'management', 'compliance'].includes(channelName)) return ['CEO', 'MANAGER'].includes(user.role.name);
    if (channel.isGeneral) return true;
    return channel.members.length > 0;
  }

  async createChannel(name: string, description?: string, isGeneral = false) {
    if (name.startsWith("dm:"))
      throw new ForbiddenException(
        "Private conversations use the direct chat endpoint",
      );
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
    const channel = await this.prisma.channel.findUnique({
      where: { name: channelName },
    });
    if (!channel) throw new NotFoundException("Channel not found");

    if (channel.isGeneral) {
      // For general channels, ideally everyone is a member, but we can just return all users or indicate it's general
      // For simplicity, let's return all active users
      return this.prisma.user.findMany({
        where: { status: "ACTIVE" },
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

    return members.map((m) => m.user);
  }

  async addMember(channelName: string, userId: string) {
    if (channelName.startsWith("dm:"))
      throw new ForbiddenException(
        "Private conversation membership cannot change",
      );
    const channel = await this.prisma.channel.findUnique({
      where: { name: channelName },
    });
    if (!channel) throw new NotFoundException("Channel not found");

    if (channel.isGeneral) {
      throw new ConflictException(
        "Cannot manually add members to a general channel",
      );
    }

    // Check if user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

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
    if (channelName.startsWith("dm:"))
      throw new ForbiddenException(
        "Private conversation membership cannot change",
      );
    const channel = await this.prisma.channel.findUnique({
      where: { name: channelName },
    });
    if (!channel) throw new NotFoundException("Channel not found");

    if (channel.isGeneral) {
      throw new ConflictException(
        "Cannot remove members from a general channel",
      );
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
