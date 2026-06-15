import { Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { UpdateMeDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

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
      },
      include: { role: true, department: true },
    });
    return this.toPublic(updated);
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
