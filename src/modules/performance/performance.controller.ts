import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreatePerformanceMetricDto } from '../../common/dtos';
import { PerformanceService } from './performance.service';

@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get()
  @Roles('CEO', 'MANAGER')
  list(
    @Query('userId') userId?: string,
    @Query('period') period?: string,
  ) {
    return this.performance.list(userId, period);
  }

  @Get(':userId')
  @Roles('CEO', 'MANAGER')
  findForUser(@Param('userId') userId: string) {
    return this.performance.findForUser(userId);
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() dto: CreatePerformanceMetricDto, @CurrentUser() actor: JwtUser) {
    return this.performance.create(dto, actor);
  }

  @Delete(':id')
  @Roles('CEO')
  delete(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.performance.delete(id, actor);
  }
}
