import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AuditLogsService } from './audit-logs.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CEO')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('actorId') actorId?: string,
    @Query('entity') entity?: string,
  ) {
    return this.auditLogs.list(limit ? Number(limit) : 100, actorId, entity);
  }

  @Get('activity')
  activity(
    @Query('userId') userId?: string,
    @Query('module') module?: string,
  ) {
    return this.auditLogs.getActivityLogs(userId, module);
  }
}
