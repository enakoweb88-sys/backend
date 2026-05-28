import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Patch(':id/review/:status')
  @Roles('CEO', 'MANAGER')
  review(@Param('id') id: string, @Param('status') status: string) {
    return this.expenses.review(id, status as any);
  }

  @Patch(':id/approve')
  @Roles('CEO', 'MANAGER')
  approve(@Param('id') id: string) {
    return this.expenses.review(id, 'APPROVED' as any);
  }

  @Patch(':id/reject')
  @Roles('CEO', 'MANAGER')
  reject(@Param('id') id: string) {
    return this.expenses.review(id, 'REJECTED' as any);
  }
}
