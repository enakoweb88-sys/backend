import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertRoleGrant } from '../../common/role-grants';
import { isCashOnlyAccount } from '../../common/application-boundary';
import { RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateEmployeeDto, QueryDto, UpdateEmployeeDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtUser } from '../../common/current-user.decorator';
import { EmployeeDirectoryResponseDto, STAFF_DIRECTORY_SELECT, STAFF_HR_SELECT, safeResponsibilities } from '../../common/staff-response.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async list(query: QueryDto, viewer?: JwtUser) {
    const hrAccess = viewer && ['CEO', 'MANAGER'].includes(viewer.role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: any = {
      status: { not: UserStatus.DELETED },
    };

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { title: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }

    if (query.department) {
      where.department = {
        name: { equals: query.department, mode: 'insensitive' as const }
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...where, status: { not: UserStatus.DELETED } },
        select: hrAccess ? STAFF_HR_SELECT : STAFF_DIRECTORY_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: { ...where, status: { not: UserStatus.DELETED } } }),
    ]);

    return { items: items.map(item => hrAccess ? this.toEmployee(item) : new EmployeeDirectoryResponseDto(item)), total, page, limit };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, status: { not: UserStatus.DELETED } },
      include: { role: true, department: true, ledDepartments: true },
    });
    if (!user) throw new NotFoundException('Employee not found');
    return this.toEmployee(user);
  }

  async create(dto: CreateEmployeeDto, actor: JwtUser) {
    assertRoleGrant(actor, dto.role);
    if (!dto.password || dto.password.length < 12 || Buffer.byteLength(dto.password) > 72) throw new BadRequestException('Password must be at least 12 characters and at most 72 UTF-8 bytes');
    if (isCashOnlyAccount(dto.responsibilities)) throw new ForbiddenException('Dedicated cash identities must use cash administration');
    const creatorId = actor.sub;
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });
    if (existingEmail) {
      throw new BadRequestException(`An account already exists with corporate email "${dto.email}". Please use a different corporate email address.`);
    }

    const role = await this.prisma.role.upsert({
      where: { name: dto.role as RoleName },
      update: {},
      create: { name: dto.role as RoleName },
    });
    const department = dto.department
      ? await this.prisma.department.upsert({ where: { name: dto.department }, update: {}, create: { name: dto.department } })
      : null;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        phone: dto.phone,
        title: dto.title,
        roleId: role.id,
        departmentId: department?.id,
        passwordHash: await bcrypt.hash(dto.password, 12),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        address: dto.address,
        personalEmail: dto.personalEmail,
        employmentType: dto.employmentType,
        salary: dto.salary,
        emergencyContact: dto.emergencyContact,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        responsibilities: dto.responsibilities,
        goalsText: dto.goals,
        ...(dto.ledDepartments && dto.ledDepartments.length > 0 ? {
          ledDepartments: {
            connectOrCreate: dto.ledDepartments.map(name => ({
              where: { name },
              create: { name }
            }))
          }
        } : {})
      },
      include: { role: true, department: true, ledDepartments: true },
    });

    const assignedKpis = (dto.kpis ?? []).filter((kpi) => kpi?.title?.trim());
    if (assignedKpis.length) {
      await this.prisma.goal.createMany({
        data: assignedKpis.map((kpi) => ({
          title: kpi.title.trim(),
          description: kpi.description?.trim() || null,
          targetValue: kpi.targetValue === undefined || kpi.targetValue === null ? null : Number(kpi.targetValue),
          currentValue: 0,
          unit: kpi.unit?.trim() || null,
          dueDate: kpi.dueDate ? new Date(kpi.dueDate) : null,
          scope: 'PERSONAL',
          ownerId: user.id,
          creatorId,
        })),
      });
    }

    // Send welcome onboarding email asynchronously (non-blocking for fast UI response)
    this.mail.sendWelcomeEmail({
      toEmail: dto.email.toLowerCase(),
      fullName: dto.fullName,
      department: dto.department || 'General',
      position: dto.title || 'Team Member',
      loginEmail: dto.email.toLowerCase(),
      responsibilities: dto.responsibilities,
      goals: dto.goals,
    }).then(sent => {
      if (sent) console.log(`✅ Onboarding email successfully sent to ${dto.email}`);
      else console.warn(`⚠️ Onboarding email was not sent to ${dto.email}`);
    }).catch(err => console.error('❌ Welcome email dispatch failed:', err));

    return this.toEmployee(user);
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: JwtUser) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new NotFoundException('Employee not found');
    assertRoleGrant(actor, dto.role || existing.role.name, existing);
    this.requireIdentityAdministration(actor, existing);
    if (isCashOnlyAccount(dto.responsibilities)) throw new ForbiddenException('Cannot change application membership through HR');

    if (dto.email && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { email: dto.email.toLowerCase(), id: { not: id } }
      });
      if (emailTaken) {
        throw new BadRequestException('Another user account is already using this corporate email address.');
      }
    }

    const role = dto.role
      ? await this.prisma.role.upsert({ where: { name: dto.role as RoleName }, update: {}, create: { name: dto.role as RoleName } })
      : null;
    const department = dto.department
      ? await this.prisma.department.upsert({ where: { name: dto.department }, update: {}, create: { name: dto.department } })
      : null;

    const user = await this.prisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id, roleId: existing.roleId, status: existing.status, updatedAt: existing.updatedAt },
      data: {
        ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(role ? { roleId: role.id } : {}),
        ...(department ? { departmentId: department.id } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.personalEmail !== undefined ? { personalEmail: dto.personalEmail } : {}),
        ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
        ...(dto.salary !== undefined ? { salary: dto.salary } : {}),
        ...(dto.emergencyContact !== undefined ? { emergencyContact: dto.emergencyContact } : {}),
        ...(dto.hireDate !== undefined ? { hireDate: dto.hireDate ? new Date(dto.hireDate) : null } : {}),
        ...(dto.responsibilities !== undefined ? { responsibilities: dto.responsibilities } : {}),
        ...(dto.goals !== undefined ? { goalsText: dto.goals } : {}),
        ...(dto.ledDepartments !== undefined ? {
          ledDepartments: {
            set: [], // clear existing
            connectOrCreate: dto.ledDepartments.map(name => ({
              where: { name },
              create: { name }
            }))
          }
        } : {})
      },
      include: { role: true, department: true, ledDepartments: true },
    });

    if (dto.role || dto.email) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await tx.auditLog.create({ data: { actorId: actor.sub, action: dto.role ? 'EMPLOYEE_ROLE_CHANGED' : 'EMPLOYEE_UPDATED', entity: 'user', entityId: id } });
    return updated;
    }).catch(error => { if (error?.code === 'P2025') throw new ConflictException('Employee changed during this operation. Refresh and try again.'); throw error; });
    // If corporate email changed, notify employee at their new email
    if (dto.email && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      this.mail.sendCorporateEmailUpdated(
        dto.email.toLowerCase(),
        existing.fullName,
        existing.email,
      ).catch(err => console.error('Corporate email update notification failed:', err));
    }

    return this.toEmployee(user);
  }

  suspend(id: string, actor: JwtUser) { return this.setStatus(id, UserStatus.SUSPENDED, actor); }
  activate(id: string, actor: JwtUser) { return this.setStatus(id, UserStatus.ACTIVE, actor); }
  remove(id: string, actor: JwtUser) { return this.setStatus(id, UserStatus.DELETED, actor); }

  async resetPassword(id: string, newPassword: string, actor: JwtUser) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new NotFoundException('Employee not found');
    assertRoleGrant(actor, existing.role.name, existing);
    this.requireIdentityAdministration(actor, existing);
    if (!newPassword || newPassword.length < 12 || Buffer.byteLength(newPassword) > 72) throw new BadRequestException('Password must be 12 characters minimum and 72 UTF-8 bytes maximum');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id, roleId: existing.roleId, status: existing.status, updatedAt: existing.updatedAt },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: actor.sub, action: 'EMPLOYEE_PASSWORD_RESET', entity: 'user', entityId: id } });
    }).catch(error => { if (error?.code === 'P2025') throw new ConflictException('Employee changed during this operation. Refresh and try again.'); throw error; });

    // Notify employee of administrative password reset via Resend (security@mail.enakoos.com)
    if (existing.email) {
      this.mail
        .sendPasswordChangedAlert(existing.email, existing.fullName)
        .catch((err) => {
          console.error(`Failed to send password reset alert email to ${existing.email}:`, err);
        });
    }

    return { ok: true };
  }

  private requireIdentityAdministration(actor: JwtUser, target: { id: string; responsibilities: string | null }) {
    if (isCashOnlyAccount(target.responsibilities)) throw new ForbiddenException('Use dedicated cash administration');

  }

  private async setStatus(id: string, status: UserStatus, actor: JwtUser) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existing) throw new NotFoundException('Employee not found');
    assertRoleGrant(actor, existing.role.name, existing);
    this.requireIdentityAdministration(actor, existing);
    if (id === actor.sub || existing.role.name === 'CEO') throw new ForbiddenException('Executive/self status changes require a separate recovery workflow');
    const user = await this.prisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id, roleId: existing.roleId, status: existing.status, updatedAt: existing.updatedAt },
      data: { status },
      include: { role: true, department: true, ledDepartments: true },
    });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: actor.sub, action: 'EMPLOYEE_' + status, entity: 'user', entityId: id } });
    return updated;
    }).catch(error => { if (error?.code === 'P2025') throw new ConflictException('Employee changed during this operation. Refresh and try again.'); throw error; });
    return this.toEmployee(user);
  }

  private toEmployee(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      title: user.title,
      status: user.status,
      role: user.role.name,
      department: user.department?.name ?? null,
      dateOfBirth: user.dateOfBirth,
      address: user.address,
      personalEmail: user.personalEmail,
      employmentType: user.employmentType,
      salary: user.salary ? Number(user.salary) : null,
      emergencyContact: user.emergencyContact,
      hireDate: user.hireDate,
      avatarUrl: user.avatarUrl,
      responsibilities: safeResponsibilities(user.responsibilities),
      goals: user.goalsText ?? null,
      ledDepartments: user.ledDepartments?.map((d: any) => d.name) || [],
      createdAt: user.createdAt,
    };
  }

}
