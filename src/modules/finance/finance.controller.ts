import { Controller, Get, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('banking')
  getBanking() {
    return this.financeService.getBanking();
  }

  @Get('budget')
  getBudget() {
    return this.financeService.getBudget();
  }

  @Get('cash-position')
  getCashPosition() {
    return this.financeService.getCashPosition();
  }

  @Get('invoices')
  getInvoices() {
    return this.financeService.getInvoices();
  }

  @Get('accounts-summary')
  getAccountsSummary() {
    return this.financeService.getAccountsSummary();
  }
}
