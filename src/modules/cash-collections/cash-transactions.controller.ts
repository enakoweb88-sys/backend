import { Headers } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import { CashPrincipal, RequireCashPermission } from './cash-access';
import { CashAccessGuard } from './cash-access.guard';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CashCreateTransactionDto } from './cash.dto';
import { CashTransactionsService } from './cash-transactions.service';

@Controller('cash-transactions')
@UseGuards(CashAccessGuard)
@RequireCashPermission('finance.manage')
export class CashTransactionsController {
  constructor(private readonly transactions: CashTransactionsService) {}

  @Get()

  list(@Query() query: any) {
    return this.transactions.list(query);
  }

  @Post()
  @RequireCashPermission('finance.manage')

  create(@Body() dto: CashCreateTransactionDto, @CurrentUser() actor: CashPrincipal, @Headers('idempotency-key') key: string) {
    return this.transactions.create(dto, actor, key);
  }

  @Patch(':id/status/:status')
  @RequireCashPermission('finance.manage')

  setStatus(@Param('id') id: string, @Param('status') status: string, @Body('charges') charges: number, @CurrentUser() actor: CashPrincipal) {
    return this.transactions.setStatus(id, status as any, charges, actor);
  }

  @Patch(':id/settle')
  @RequireCashPermission('finance.manage')

  settle(@Param('id') id: string, @CurrentUser() actor: CashPrincipal) {
    return this.transactions.setStatus(id, 'SETTLED' as any, 0, actor);
  }

  @Patch(':id/flag')
  @RequireCashPermission('finance.manage')

  flag(@Param('id') id: string, @CurrentUser() actor: CashPrincipal) {
    return this.transactions.setStatus(id, 'FLAGGED' as any, 0, actor);
  }

  @Post('float')
  @RequireCashPermission('finance.manage')

  setFloatBalance(@Body('channel') channel: string, @Body('balance') balance: number, @CurrentUser() actor: CashPrincipal) {
    return this.transactions.setFloatBalance(channel, balance, actor);
  }

  @Get('exchange-rates')

  getExchangeRates() {
    return this.transactions.getExchangeRates();
  }

  @Post('exchange-rates')
  @RequireCashPermission('finance.manage')

  saveExchangeRates(@Body() body: any) {
    return this.transactions.saveExchangeRates(body);
  }
}
