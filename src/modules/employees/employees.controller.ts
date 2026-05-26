import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
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
  @Roles(RoleName.CEO, RoleName.MANAGER)
  list(@Query() query: QueryDto) {
    return this.employees.list(query);
  }

  @Post()
  @Roles(RoleName.CEO, RoleName.MANAGER)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  suspend(@Param('id') id: string) {
    return this.employees.suspend(id);
  }

  @Patch(':id/activate')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  activate(@Param('id') id: string) {
    return this.employees.activate(id);
  }

  @Delete(':id')
  @Roles(RoleName.CEO)
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }
}
