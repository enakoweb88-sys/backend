import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateTaskCommentDto, CreateTaskDto, UpdateTaskDto } from '../../common/dtos';
import { TasksService } from './tasks.service';
import { TaskStatus } from '@prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.tasks.list(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasks.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasks.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasks.update(id, dto, user);
  }

  @Patch(':id/status/:status')
  setStatus(
    @Param('id') id: string,
    @Param('status') status: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasks.setStatus(id, status as TaskStatus, user);
  }

  @Delete(':id')
  @Roles('CEO', 'MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tasks.deleteTask(id, user);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasks.addComment(taskId, dto, user);
  }

  @Get(':id/comments')
  getComments(@Param('id') taskId: string) {
    return this.tasks.getComments(taskId);
  }
}
