import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { PermissionsGuard, RequirePermission } from '../../common/permissions';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-logs')
  @UseGuards(PermissionsGuard)
  @RequirePermission('audit.read')
  auditLogs() {
    return this.adminService.auditLogs();
  }

  @Get('overview')
  @Roles('CEO', 'MANAGER')
  getOverview(@CurrentUser() user: JwtUser) {
    return this.adminService.getOverview(user);
  }

  @Post('leaves')
  createLeave(@Body() dto: any, @CurrentUser() user: JwtUser) {
    return this.adminService.createLeave(dto, user);
  }

  @Get('leaves')
  listLeaves(@CurrentUser() user: JwtUser) { return this.adminService.listLeaves(user); }

  @Patch('leaves/:id')
  @Roles('CEO')
  reviewLeave(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: JwtUser) {
    return this.adminService.reviewLeave(id, status, user);
  }
}
