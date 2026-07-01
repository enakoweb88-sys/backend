import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { UpdateMeDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: JwtUser) {
    const found = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        role: true,
        department: true,
      },
    });
    if (!found) throw new NotFoundException('User not found');
    return this.toPublic(found);
  }

  async updateMe(user: JwtUser, dto: UpdateMeDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
      include: { role: true, department: true },
    });
    return this.toPublic(updated);
  }

  async deleteMe(user: JwtUser) {
    // Only allow deletion if not CEO to prevent lockout
    if (user.role === 'CEO') {
      throw new BadRequestException('CEO account cannot be deleted for safety.');
    }
    await this.prisma.user.delete({ where: { id: user.sub } });
    return { ok: true, message: 'Account deleted' };
  }

  async getPreferences(user: JwtUser) {
    let prefs = await this.prisma.userPreference.findUnique({ where: { userId: user.sub } });
    if (!prefs) {
      prefs = await this.prisma.userPreference.create({ data: { userId: user.sub } });
    }
    return prefs;
  }

  async updatePreferences(user: JwtUser, dto: any) {
    let prefs = await this.prisma.userPreference.findUnique({ where: { userId: user.sub } });
    if (!prefs) {
      prefs = await this.prisma.userPreference.create({ data: { userId: user.sub } });
    }
    
    return this.prisma.userPreference.update({
      where: { userId: user.sub },
      data: {
        ...(dto.analytics !== undefined ? { analytics: dto.analytics } : {}),
        ...(dto.mfa !== undefined ? { mfa: dto.mfa } : {}),
        ...(dto.aiWorkspace !== undefined ? { aiWorkspace: dto.aiWorkspace } : {}),
        ...(dto.emailNotif !== undefined ? { emailNotif: dto.emailNotif } : {}),
        ...(dto.pushNotif !== undefined ? { pushNotif: dto.pushNotif } : {}),
        ...(dto.smsNotif !== undefined ? { smsNotif: dto.smsNotif } : {}),
        ...(dto.slackConnected !== undefined ? { slackConnected: dto.slackConnected } : {}),
        ...(dto.awsConnected !== undefined ? { awsConnected: dto.awsConnected } : {}),
      }
    });
  }

  async changePassword(user: JwtUser, currentPw: string, newPw: string) {
    const found = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!found) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPw, found.passwordHash);
    if (!valid) throw new BadRequestException('Incorrect current password');

    const newHash = await bcrypt.hash(newPw, 12);
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { passwordHash: newHash }
    });
    return { ok: true };
  }

  async exportData(user: JwtUser) {
    const found = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        role: true,
        department: true,
        preference: true,
        activityLogs: { take: 10, orderBy: { createdAt: 'desc' } }
      },
    });
    if (!found) throw new NotFoundException('User not found');
    
    // Clean up sensitive data before exporting
    const { passwordHash, ...cleanData } = found;
    return {
      type: 'Archive',
      timestamp: new Date(),
      data: cleanData
    };
  }

  async listAll(search?: string) {
    return this.prisma.user.findMany({
      where: {
        status: { not: UserStatus.DELETED },
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        title: true,
        phone: true,
        status: true,
        role: { select: { name: true } },
        department: { select: { name: true } },
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, department: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  private toPublic(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      title: user.title ?? null,
      avatarUrl: user.avatarUrl ?? null,
      status: user.status,
      role: user.role?.name ?? null,
      department: user.department?.name ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
    };
  }
}
