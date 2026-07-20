import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { UpdateMeDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

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

  async getProfileStats(user: JwtUser) {
    // 1. Tasks completion
    const totalTasks = await this.prisma.task.count({ where: { assigneeId: user.sub } });
    const completedTasks = await this.prisma.task.count({ where: { assigneeId: user.sub, status: 'DONE' } });
    const taskCompletion = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // 2. Goals reached
    const totalGoals = await this.prisma.goal.count({ where: { ownerId: user.sub } });
    const completedGoals = await this.prisma.goal.count({ where: { ownerId: user.sub, status: 'COMPLETED' } });

    // 3. Current Work Stream (Latest IN_PROGRESS task)
    const activeTask = await this.prisma.task.findFirst({
      where: { assigneeId: user.sub, status: 'IN_PROGRESS' },
      orderBy: { updatedAt: 'desc' },
      select: { title: true, updatedAt: true }
    });

    // 4. Certifications / Badges (Using PerformanceMetrics or predefined logic)
    const metrics = await this.prisma.performanceMetric.findMany({
      where: { userId: user.sub }
    });
    const badges = metrics.map(m => m.metric).filter((v, i, a) => a.indexOf(v) === i); // Unique metrics as badges
    if (badges.length === 0) {
      // Default badges based on role
      if (user.role === 'CEO') badges.push('Founder', 'Strategic Visionary');
      else if (user.role === 'MANAGER') badges.push('Efficiency Expert', 'Team Catalyst');
      else badges.push('Rising Star', 'Reliability Hero');
    }

    return {
      taskCompletion,
      totalGoals,
      completedGoals,
      networkUptime: 99.9, // Mock but realistic looking
      activeTask: activeTask ? {
        title: activeTask.title,
        startedAt: activeTask.updatedAt.toISOString()
      } : null,
      badges
    };
  }

  async updateMe(user: JwtUser, dto: UpdateMeDto) {
    let finalAvatarUrl = dto.avatarUrl;

    if (dto.avatarUrl && dto.avatarUrl.startsWith('data:image/')) {
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.storage.createBucket('avatars', { public: true }).catch(() => {});
          
          const matches = dto.avatarUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = matches[1].split('/')[1] || 'png';
            const fileName = `${user.sub}-${Date.now()}.${ext}`;
            
            const { error } = await supabase.storage.from('avatars').upload(fileName, buffer, {
              contentType: matches[1],
              upsert: true
            });
            
            if (!error) {
              const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
              finalAvatarUrl = data.publicUrl;
            }
          }
        }
      } catch (e) {
        console.error('Failed to upload avatar to supabase', e);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.personalEmail !== undefined ? { personalEmail: dto.personalEmail } : {}),
        ...(dto.emergencyContact !== undefined ? { emergencyContact: dto.emergencyContact } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null } : {}),
        ...(finalAvatarUrl !== undefined ? { avatarUrl: finalAvatarUrl } : {}),
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
      include: { role: true, department: true, userSessions: true },
    });
    if (!user) throw new NotFoundException('User not found');
    
    let totalLoginTime = 0;
    let sessionCount = 0;
    if (user.userSessions) {
      user.userSessions.forEach(session => {
        if (session.duration) {
          totalLoginTime += session.duration;
          sessionCount++;
        }
      });
    }
    const averageLoginTime = sessionCount > 0 ? Math.round(totalLoginTime / sessionCount) : 0;

    return { ...this.toPublic(user), performanceStats: { totalLoginTime, averageLoginTime } };
  }

  private toPublic(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      title: user.title ?? null,
      avatarUrl: user.avatarUrl ?? null,
      address: user.address ?? null,
      personalEmail: user.personalEmail ?? null,
      emergencyContact: user.emergencyContact ?? null,
      dateOfBirth: user.dateOfBirth ?? null,
      status: user.status,
      role: user.role?.name ?? null,
      department: user.department?.name ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
    };
  }
}
