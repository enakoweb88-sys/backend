import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateTransactionDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @Roles('CEO', 'MANAGER')
  list(@Query() query: any) {
    return this.transactions.list(query);
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() dto: CreateTransactionDto) {
    return this.transactions.create(dto);
  }

  @Patch(':id/status/:status')
  @Roles('CEO', 'MANAGER')
  setStatus(@Param('id') id: string, @Param('status') status: string, @Body('charges') charges?: number) {
    return this.transactions.setStatus(id, status as any, charges);
  }

  @Patch(':id/settle')
  @Roles('CEO', 'MANAGER')
  settle(@Param('id') id: string) {
    return this.transactions.setStatus(id, 'SETTLED' as any);
  }

  @Patch(':id/flag')
  @Roles('CEO', 'MANAGER')
  flag(@Param('id') id: string) {
    return this.transactions.setStatus(id, 'FLAGGED' as any);
  }

  @Post('float')
  @Roles('CEO', 'MANAGER')
  setFloatBalance(@Body('channel') channel: string, @Body('balance') balance: number) {
    return this.transactions.setFloatBalance(channel, balance);
  }
}
