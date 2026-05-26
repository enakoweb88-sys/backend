import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.prisma.notification.findMany({ where: { userId: user.sub }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Patch(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.prisma.notification.update({ where: { id, userId: user.sub }, data: { readAt: new Date() } });
  }
}
