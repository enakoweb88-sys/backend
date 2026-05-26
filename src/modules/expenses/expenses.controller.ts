import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ExpenseStatus, RoleName } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { MoneyDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Query() query: QueryDto, @CurrentUser() user: JwtUser) {
    return this.expenses.list(query, user);
  }

  @Post()
  create(@Body() dto: MoneyDto, @CurrentUser() user: JwtUser) {
    return this.expenses.create(dto, user);
  }

  @Patch(':id/approve')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  approve(@Param('id') id: string) {
    return this.expenses.review(id, ExpenseStatus.APPROVED);
  }

  @Patch(':id/reject')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  reject(@Param('id') id: string) {
    return this.expenses.review(id, ExpenseStatus.REJECTED);
  }
}
