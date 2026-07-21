import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { MealDto } from '../../common/dtos';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { MealsService } from './meals.service';

@Controller('meals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.meals.list(user);
  }

  @Post()
  record(@Body() dto: MealDto) {
    return this.meals.record(dto);
  }

  @Patch(':id/dispute')
  dispute(@Param('id') id: string, @Body('reason') reason: string) {
    return this.meals.dispute(id, reason);
  }
}
