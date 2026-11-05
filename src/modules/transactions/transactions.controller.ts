import { Headers } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { PermissionsGuard, RequirePermission } from '../../common/permissions';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateTransactionDto, QueryDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance.read')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()

  list(@Query() query: any) {
    return this.transactions.list(query);
  }

  @Post()
  @RequirePermission('finance.write')

  create(@Body() dto: CreateTransactionDto, @CurrentUser() actor: JwtUser, @Headers('idempotency-key') key: string) {
    return this.transactions.create(dto, actor, key);
  }

  @Patch(':id/status/:status')
  @RequirePermission('finance.write')

  setStatus(@Param('id') id: string, @Param('status') status: string, @Body('charges') charges: number, @CurrentUser() actor: JwtUser) {
    return this.transactions.setStatus(id, status as any, charges, actor);
  }

  @Patch(':id/settle')
  @RequirePermission('finance.write')

  settle(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.transactions.setStatus(id, 'SETTLED' as any, 0, actor);
  }

  @Patch(':id/flag')
  @RequirePermission('finance.write')

  flag(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.transactions.setStatus(id, 'FLAGGED' as any, 0, actor);
  }

  @Post('float')
  @RequirePermission('finance.write')

  setFloatBalance(@Body('channel') channel: string, @Body('balance') balance: number, @CurrentUser() actor: JwtUser) {
    return this.transactions.setFloatBalance(channel, balance, actor);
  }

  @Get('exchange-rates')

  getExchangeRates() {
    return this.transactions.getExchangeRates();
  }

  @Post('exchange-rates')
  @RequirePermission('finance.write')

  saveExchangeRates(@Body() body: any) {
    return this.transactions.saveExchangeRates(body);
  }
}
