import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  overview() {
    return this.dashboard.getOverview();
  }

  @Get('my-stats')
  myStats(@CurrentUser() user: JwtUser) {
    return this.dashboard.getEmployeeStats(user);
  }

  @Get('charts/transactions')
  transactionChart() {
    return this.dashboard.getTransactionChart();
  }

  @Get('charts/employees')
  employeeBreakdown() {
    return this.dashboard.getEmployeeBreakdown();
  }
}
