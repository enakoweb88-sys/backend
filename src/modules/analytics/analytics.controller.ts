import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() user: JwtUser) {
    return this.analytics.overview(user);
  }

  @Get('health')
  health() {
    return this.analytics.healthScore();
  }

  @Get('marketing')
  marketing() {
    return this.analytics.marketingPerformance();
  }

  @Get('njangi')
  njangi() {
    return this.analytics.njangiAnalysis();
  }

  @Get('app')
  appActivity() {
    return this.analytics.appActivity();
  }
}
