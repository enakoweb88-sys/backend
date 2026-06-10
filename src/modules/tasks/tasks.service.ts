import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName, TaskStatus, TaskPriority } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateTaskCommentDto, CreateTaskDto, UpdateTaskDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: JwtUser) {
    const where = user.role === RoleName.EMPLOYEE ? { assigneeId: user.sub } : {};
    return this.prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, fullName: true, email: true, role: { select: { name: true } } } },
        creator: { select: { id: true, fullName: true, email: true } },
        _count: { select: { comments: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, fullName: true, email: true, role: { select: { name: true } } } },
        creator: { select: { id: true, fullName: true, email: true } },
        comments: {
          include: { author: { select: { id: true, fullName: true, role: { select: { name: true } } } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(dto: CreateTaskDto, user: JwtUser) {
    if (user.role === RoleName.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot create tasks');
    }
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? TaskPriority.NORMAL,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId,
        creatorId: user.sub,
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } },
      },
    });
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, user: JwtUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (user.role === RoleName.EMPLOYEE && task.assigneeId !== user.sub) {
      throw new ForbiddenException('You can only update your own tasks');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.assigneeId !== undefined && user.role !== RoleName.EMPLOYEE ? { assigneeId: dto.assigneeId } : {}),
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        creator: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async setStatus(id: string, status: TaskStatus, user: JwtUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (user.role === RoleName.EMPLOYEE && task.assigneeId !== user.sub) {
      throw new ForbiddenException('You can only update your assigned tasks');
    }

    return this.prisma.task.update({ where: { id }, data: { status } });
  }

  async addComment(taskId: string, dto: CreateTaskCommentDto, user: JwtUser) {
    await this.findOne(taskId);
    return this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: user.sub,
        content: dto.content,
      },
      include: {
        author: { select: { id: true, fullName: true, role: { select: { name: true } } } },
      },
    });
  }

  async getComments(taskId: string) {
    await this.findOne(taskId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, fullName: true, role: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteTask(id: string, user: JwtUser) {
    if (user.role === RoleName.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot delete tasks');
    }
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.task.delete({ where: { id } });
  }
}
