import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { MarketerService } from './marketer.service';

@Controller('marketer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketerController {
  constructor(private readonly marketerService: MarketerService) {}

  // ──────────────────────────── LEADS ────────────────────────────

  @Get('leads')
  listLeads(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('zone') zone?: string,
    @Query('marketerId') marketerId?: string,
  ) {
    return this.marketerService.listLeads(user, { status, zone, marketerId });
  }

  @Post('leads')
  createLead(@Body() body: any, @CurrentUser() user: JwtUser) {
    return this.marketerService.createLead(body, user);
  }

  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtUser) {
    return this.marketerService.updateLead(id, body, user);
  }

  @Delete('leads/:id')
  deleteLead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.marketerService.deleteLead(id, user);
  }

  // ──────────────────────────── TERRITORY ────────────────────────────

  @Get('territory')
  getTerritory(@CurrentUser() user: JwtUser, @Query('marketerId') marketerId?: string) {
    return this.marketerService.getTerritory(user, marketerId);
  }

  @Post('territory/assign')
  @Roles('CEO', 'MANAGER', 'OUTREACH_MANAGER')
  assignTerritory(
    @Body() body: { marketerId: string; zones: { zoneName: string; region?: string; targetAudience?: string; schedule?: string }[] },
    @CurrentUser() user: JwtUser,
  ) {
    return this.marketerService.assignTerritory(body, user);
  }

  // ──────────────────────────── SCORECARD ────────────────────────────

  @Get('scorecard')
  getScorecard(@CurrentUser() user: JwtUser, @Query('marketerId') marketerId?: string) {
    return this.marketerService.getScorecard(user, marketerId);
  }

  // ──────────────────────────── KPI GOALS AUTO-PROVISION ────────────────────────────

  @Post('ensure-kpis')
  ensureKpis(@CurrentUser() user: JwtUser) {
    return this.marketerService.ensureMarketerKpis(user);
  }
}
