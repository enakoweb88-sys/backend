import { PermissionsGuard, RequirePermission } from '../../common/permissions';
import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('self')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('search')
  async globalSearch(@Query('q') query: string, @CurrentUser() user: JwtUser) {
    return this.dashboard.globalSearch(query, user);
  }

  @Get('overview')
  @RequirePermission('analytics.read')
  overview(@CurrentUser() user: JwtUser) {
    return this.dashboard.getOverview(user);
  }

  @Get('my-stats')
  myStats(@CurrentUser() user: JwtUser) {
    return this.dashboard.getEmployeeStats(user);
  }

  @Get('charts/transactions')
  @RequirePermission('finance.read')
  transactionChart() {
    return this.dashboard.getTransactionChart();
  }

  @Get('charts/employees')
  @RequirePermission('hr.manage')
  employeeBreakdown() {
    return this.dashboard.getEmployeeBreakdown();
  }

  @Get('engineering')
  engineeringOverview(@CurrentUser() user: JwtUser) {
    return this.dashboard.getEngineeringOverview(user);
  }
}
