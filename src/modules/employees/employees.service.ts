import { Injectable, NotFoundException } from '@nestjs/common';
import { RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { CreateEmployeeDto, QueryDto, UpdateEmployeeDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { title: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...where, status: { not: UserStatus.DELETED } },
        include: { role: true, department: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: { ...where, status: { not: UserStatus.DELETED } } }),
    ]);

    return { items: items.map(this.toEmployee), total, page, limit };
  }

  async create(dto: CreateEmployeeDto) {
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
      },
      include: { role: true, department: true },
    });
    return this.toEmployee(user);
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');

    const role = dto.role
      ? await this.prisma.role.upsert({ where: { name: dto.role as RoleName }, update: {}, create: { name: dto.role as RoleName } })
      : null;
    const department = dto.department
      ? await this.prisma.department.upsert({ where: { name: dto.department }, update: {}, create: { name: dto.department } })
      : null;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        title: dto.title,
        ...(role ? { roleId: role.id } : {}),
        ...(department ? { departmentId: department.id } : {}),
      },
      include: { role: true, department: true },
    });
    return this.toEmployee(user);
  }

  suspend(id: string) { return this.setStatus(id, UserStatus.SUSPENDED); }
  activate(id: string) { return this.setStatus(id, UserStatus.ACTIVE); }
  remove(id: string) { return this.setStatus(id, UserStatus.DELETED); }

  private async setStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      include: { role: true, department: true },
    });
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
      createdAt: user.createdAt,
    };
  }
}
