import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { UpdateMeDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import { STAFF_DIRECTORY_SELECT, StaffDirectoryResponseDto, safeResponsibilities } from '../../common/staff-response.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { safeUpload } from '../../common/upload-validation';
import { scanDocument } from '../../common/document-scanner';
import { ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

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

    return {
      taskCompletion,
      totalGoals,
      completedGoals,
      networkUptime: null,
      activeTask: activeTask ? {
        title: activeTask.title,
        startedAt: activeTask.updatedAt.toISOString()
      } : null,
      badges
    };
  }

  async updateMe(user: JwtUser, dto: UpdateMeDto) {
    if (dto.email && dto.email.toLowerCase() !== user.email.toLowerCase()) throw new BadRequestException('Corporate login email changes require approved administration');
    let finalAvatarUrl = dto.avatarUrl;

    if (dto.avatarUrl?.startsWith('data:')) {
      const matches = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dto.avatarUrl);
      if (!matches || matches[2].length > 1400000) throw new BadRequestException('Avatar must be a PNG, JPEG or WebP image under 1 MB');
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.toString('base64') !== matches[2] || buffer.length > 1024 * 1024) throw new BadRequestException('Invalid avatar image');
      const file = safeUpload({ buffer, size: buffer.length, originalname: 'avatar.' + matches[1] } as Express.Multer.File, true);
      if (!file.mimeType.startsWith('image/')) throw new BadRequestException('Invalid avatar image');
      await scanDocument(buffer, this.config);
      const supabaseUrl = this.config.get<string>('SUPABASE_URL'), supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseKey) throw new ServiceUnavailableException('Avatar storage is not configured');
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.storage.from('avatars').upload(file.fileName, buffer, { contentType: file.mimeType, upsert: false });
      if (error) throw new ServiceUnavailableException('Avatar could not be saved');
      finalAvatarUrl = supabase.storage.from('avatars').getPublicUrl(file.fileName).data.publicUrl;
    } else if (dto.avatarUrl) {
      let url: URL; try { url = new URL(dto.avatarUrl); } catch { throw new BadRequestException('Invalid avatar URL'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw new BadRequestException('Invalid avatar URL');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        ...(dto.email ? { email: dto.email } : {}),
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
    if (!newPw || newPw.length < 12 || Buffer.byteLength(newPw) > 72) throw new BadRequestException('Password must be at least 12 characters and at most 72 UTF-8 bytes');
    const found = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!found) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPw, found.passwordHash);
    if (!valid) throw new BadRequestException('Incorrect current password');

    const newHash = await bcrypt.hash(newPw, 12);
    await this.prisma.$transaction(async tx => {
      const changed = await tx.user.updateMany({ where: { id: user.sub, passwordHash: found.passwordHash, status: 'ACTIVE' }, data: { passwordHash: newHash, passwordChangedAt: new Date() } });
      if (changed.count !== 1) throw new BadRequestException('Account changed; sign in again');
      await tx.authSession.updateMany({ where: { userId: user.sub, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId: user.sub, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: user.sub, action: 'PASSWORD_CHANGED', entity: 'user', entityId: user.sub } });
    });

    // Dispatch security alert email via Resend (security@mail.enakoos.com)
    if (found.email) {
      this.mailService
        .sendPasswordChangedAlert(found.email, found.fullName)
        .catch((err) => {
          this.logger.error(`Failed to send password change alert to ${found.email}: ${err?.message}`);
        });
    }

    return { ok: true, message: 'Password updated successfully' };
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
    
    return {
      type: 'Archive',
      timestamp: new Date(),
      data: {
        ...this.toPublic(found), employmentType: found.employmentType, salary: found.salary,
        hireDate: found.hireDate, responsibilities: safeResponsibilities(found.responsibilities),
        goals: found.goalsText,
        activityLogs: found.activityLogs.map(log => ({ action: log.action, module: log.module, createdAt: log.createdAt })),
      }
    };
  }

  async listAll(search?: string) {
    const users = await this.prisma.user.findMany({
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
      select: STAFF_DIRECTORY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(user => new StaffDirectoryResponseDto(user));
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, department: true, userSessions: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toEmployee(user);
  }

  async toEmployee(user: any) {
    let totalLoginTime = 0;
    let sessionCount = 0;
    if (user.userSessions) {
      user.userSessions.forEach((session: any) => {
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
      passwordChangedAt: user.passwordChangedAt ?? user.createdAt,
      createdAt: user.createdAt,
    };
  }
}
