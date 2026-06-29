import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Delete('me')
  deleteMe(@CurrentUser() user: JwtUser) {
    return this.users.deleteMe(user);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: JwtUser) {
    return this.users.getPreferences(user);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.users.updatePreferences(user, dto);
  }

  @Post('change-password')
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: any) {
    return this.users.changePassword(user, dto.currentPassword, dto.newPassword);
  }

  @Post('export')
  exportData(@CurrentUser() user: JwtUser) {
    return this.users.exportData(user);
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
