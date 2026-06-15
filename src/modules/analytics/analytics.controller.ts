import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analytics.overview();
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
