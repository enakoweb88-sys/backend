import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateGoalDto, QueryDto, UpdateGoalDto } from '../../common/dtos';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Query() query: QueryDto & { scope?: string; status?: string }) {
    return this.goals.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goals.findOne(id);
  }

  @Post()
  @Roles('CEO', 'MANAGER')
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
    @Body('currentValue') currentValue: number,
    @CurrentUser() user: JwtUser,
  ) {
    return this.goals.updateProgress(id, currentValue, user);
  }

  @Patch(':id/complete')
  @Roles('CEO', 'MANAGER')
  complete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.goals.complete(id, user);
  }

  @Delete(':id')
  @Roles('CEO')
  delete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.goals.delete(id, user);
  }
}
