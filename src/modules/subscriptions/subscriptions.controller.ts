import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from '../../common/dtos';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.subscriptionsService.list(user);
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: JwtUser) {
    return this.subscriptionsService.create(dto, user);
  }

  @Patch(':id')
  @Roles('CEO', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(id, dto);
  }
}
