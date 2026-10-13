import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { SubmitKpiScoreDto, UpdateEmployeeKpiScoreDto } from '../../common/dtos';
import { KpisService } from './kpis.service';

@Controller('kpis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpisController {
  constructor(private readonly kpis: KpisService) {}

  @Get('me')
  mine(@CurrentUser() user: JwtUser, @Query('period') period?: string) {
    return this.kpis.getMine(user.sub, period);
  }

  @Put('me')
  submitMine(@CurrentUser() user: JwtUser, @Body() dto: SubmitKpiScoreDto) {
    return this.kpis.submitMine(user.sub, dto);
  }

  @Get('employees/:id')
  @Roles('CEO', 'MANAGER')
  employeeScores(@Param('id') id: string, @Query('period') period?: string) {
    return this.kpis.getEmployeeScores(id, period);
  }

  @Put('employees/:id')
  @Roles('CEO', 'MANAGER')
  updateEmployeeScore(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateEmployeeKpiScoreDto,
  ) {
    return this.kpis.updateEmployeeScore(id, user.sub, dto);
  }
}
