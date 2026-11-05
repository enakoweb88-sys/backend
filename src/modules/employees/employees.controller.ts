import { Throttle } from '@nestjs/throttler';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateEmployeeDto, QueryDto, UpdateEmployeeDto } from '../../common/dtos';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@Query() query: QueryDto, @CurrentUser() user: JwtUser) {
    return this.employees.list(query, user);
  }

  @Get(':id')
  @Roles('CEO', 'MANAGER')
  getById(@Param('id') id: string) {
    return this.employees.getById(id);
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtUser) {
    return this.employees.create(dto, user);
  }

  @Patch(':id')
  @Roles('CEO', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: JwtUser) {
    return this.employees.update(id, dto, user);
  }

  @Patch(':id/suspend')
  @Roles('CEO', 'MANAGER')
  suspend(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.employees.suspend(id, user);
  }

  @Patch(':id/activate')
  @Roles('CEO', 'MANAGER')
  activate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.employees.activate(id, user);
  }

  @Delete(':id')
  @Roles('CEO')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.employees.remove(id, user);
  }

  @Patch(':id/reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Roles('CEO', 'MANAGER')
  resetPassword(@Param('id') id: string, @Body('password') password: string, @CurrentUser() user: JwtUser) {
    return this.employees.resetPassword(id, password, user);
  }
}
