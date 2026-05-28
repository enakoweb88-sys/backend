import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { CreateTaskDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.tasks.list(user);
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtUser) {
    return this.tasks.create(dto, user);
  }

  @Patch(':id/status/:status')
  setStatus(@Param('id') id: string, @Param('status') status: string) {
    return this.tasks.setStatus(id, status as any);
  }
}
