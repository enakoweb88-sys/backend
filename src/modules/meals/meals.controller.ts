import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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

  @Get('providers')
  providers() { return this.meals.providers(); }

  @Post()
  record(@Body() dto: MealDto, @CurrentUser() user: JwtUser) {
    // Non-managers/executives can ONLY log their own personal meals
    const r = (user.role || '').toUpperCase();
    if (r !== 'MANAGER' && r !== 'CEO') {
      dto.employeeId = user.sub;
    }
    dto.price = 1000; // Fixed delivery meal price (1,000 FCFA)
    return this.meals.record(dto, user);
  }

  @Delete(':id')
  @Roles('CEO', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.meals.remove(id);
  }

  @Patch(':id/dispute')
  dispute(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: JwtUser) {
    return this.meals.dispute(id, reason, user);
  }
}
