import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { UpdateMeDto } from '../../common/dtos';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.users.getMe(user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user, dto);
  }

  @Get()
  @Roles('CEO', 'MANAGER')
  listAll(@Query('search') search?: string) {
    return this.users.listAll(search);
  }

  @Get(':id')
  @Roles('CEO', 'MANAGER')
  getById(@Param('id') id: string) {
    return this.users.getById(id);
  }
}
