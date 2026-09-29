import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RoleName, TaskStatus, TaskPriority } from '@prisma/client';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateTaskCommentDto, CreateTaskDto, UpdateTaskDto } from '../../common/dtos';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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
    const assigneeIds = dto.assigneeIds && dto.assigneeIds.length > 0 
      ? dto.assigneeIds 
      : [dto.assigneeId || user.sub];

    const tasks = [];
    for (const assigneeId of assigneeIds) {
      const task = await this.prisma.task.create({
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? TaskPriority.NORMAL,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          assigneeId,
          creatorId: user.sub,
        },
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          creator: { select: { id: true, fullName: true, email: true } },
        },
      });
      tasks.push(task);

      // Create in-app notification for the assignee
      if (assigneeId !== user.sub) {
        await this.prisma.notification.create({
          data: {
            userId: assigneeId,
            title: 'New Task Assigned',
            body: `You have been assigned a new task: ${task.title}`,
            type: 'INFO',
            link: '/tasks',
          }
        });

        // Dispatch transactional email via Resend (notifications@mail.enakoos.com)
        if (task.assignee?.email) {
          this.mailService
            .sendTaskAssignedAlert({
              toEmail: task.assignee.email,
              assigneeName: task.assignee.fullName || 'Team Member',
              assignerName: task.creator?.fullName || user.email || 'ENAKO Team',
              taskTitle: task.title,
              priority: task.priority,
              dueDate: task.dueDate,
              description: task.description,
            })
            .catch((err) => {
              this.logger.error(`Failed to send task assignment email to ${task.assignee?.email}: ${err?.message}`);
            });
        }
      }
    }

    // Return first task to maintain backward compatibility with any single-task return callers
    return tasks[0];
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
