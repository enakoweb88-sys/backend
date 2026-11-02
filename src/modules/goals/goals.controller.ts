import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateGoalDto, GoalQueryDto, GoalReportQueryDto, GoalProgressDto, UpdateGoalDto } from '../../common/dtos';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Query() query: GoalQueryDto, @CurrentUser() user: JwtUser) {
    return this.goals.list(query, user);
  }

  @Get('report')
  report(@Query() query: GoalReportQueryDto, @CurrentUser() user: JwtUser) {
    return this.goals.report(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.goals.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateGoalDto, @CurrentUser() user: JwtUser) {
    return this.goals.create(dto, user);
  }

  @Patch(':id')
  @Roles('CEO', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: JwtUser) {
    return this.goals.update(id, dto, user);
  }

  @Patch(':id/progress')
  updateProgress(
    @Param('id') id: string,
    @Body() dto: GoalProgressDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.goals.updateProgress(id, dto.currentValue, user);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.goals.complete(id, user);
  }

  @Delete(':id')
  @Roles('CEO')
  delete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.goals.delete(id, user);
  }
}
