import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles('CEO', 'MANAGER', 'OUTREACH_MANAGER')
  list() {
    return this.reportsService.list();
  }

  @Post()
  @Roles('CEO', 'MANAGER', 'OUTREACH_MANAGER')
  generate(@Body() body: { title: string; type: string }, @CurrentUser() user: JwtUser) {
    return this.reportsService.generate(body.title, body.type, user);
  }

  @Get('daily')
  listDaily(@CurrentUser() user: JwtUser) {
    return this.reportsService.listDaily(user);
  }

  @Post('daily')
  createDaily(@Body() body: { content: string; loginTime?: string; logoutTime?: string; pdfUrl?: string }, @CurrentUser() user: JwtUser) {
    return this.reportsService.createDaily(body, user);
  }
}
