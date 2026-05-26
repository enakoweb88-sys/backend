import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleName, TransactionStatus } from '@prisma/client';
import { MoneyDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @Roles(RoleName.CEO, RoleName.MANAGER)
  list(@Query() query: QueryDto) {
    return this.transactions.list(query);
  }

  @Post()
  @Roles(RoleName.CEO, RoleName.MANAGER)
  create(@Body() dto: MoneyDto & { entity?: string; type?: string }) {
    return this.transactions.create(dto);
  }

  @Patch(':id/settle')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  settle(@Param('id') id: string) {
    return this.transactions.setStatus(id, TransactionStatus.SETTLED);
  }

  @Patch(':id/flag')
  @Roles(RoleName.CEO, RoleName.MANAGER)
  flag(@Param('id') id: string) {
    return this.transactions.setStatus(id, TransactionStatus.FLAGGED);
  }
}
