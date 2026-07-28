import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: JwtUser) {
    return this.adminService.getOverview(user);
  }

  @Post('leaves')
  createLeave(@Body() dto: any, @CurrentUser() user: JwtUser) {
    return this.adminService.createLeave(dto, user);
  }
}
