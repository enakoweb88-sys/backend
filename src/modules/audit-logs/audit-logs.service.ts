import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(limit = 100, actorId?: string, entity?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(actorId ? { actorId } : {}),
        ...(entity ? { entity } : {}),
      },
      include: {
        actor: { select: { fullName: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async log(data: {
    actorId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        metadata: data.metadata as any,
        ipAddress: data.ipAddress,
      },
    });
  }

  async logActivity(data: {
    userId: string;
    action: string;
    module: string;
    details?: string;
    ipAddress?: string;
  }) {
    return this.prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        module: data.module,
        details: data.details,
        ipAddress: data.ipAddress,
      },
    });
  }

  getActivityLogs(userId?: string, module?: string) {
    return this.prisma.activityLog.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(module ? { module } : {}),
      },
      include: {
        user: { select: { fullName: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
