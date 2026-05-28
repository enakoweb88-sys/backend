import { Injectable } from '@nestjs/common';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateTaskDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtUser) {
    return this.prisma.task.findMany({
      where: user.role === 'EMPLOYEE' ? { assigneeId: user.sub } : {},
      include: {
        assignee: { select: { id: true, fullName: true } },
        creator: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  create(dto: CreateTaskDto, user: JwtUser) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'Normal',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId,
        creatorId: user.sub,
      },
    });
  }

  setStatus(id: string, status: any) {
    return this.prisma.task.update({ where: { id }, data: { status } });
  }
}
