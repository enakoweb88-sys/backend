import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateAnnouncementDto, QueryDto, UpdateAnnouncementDto } from '../../common/dtos';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@Query() query: QueryDto) {
    return this.announcements.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.announcements.findOne(id);
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: JwtUser) {
    return this.announcements.create(dto, user);
  }

  @Patch(':id')
  @Roles('CEO', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: JwtUser) {
    return this.announcements.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('CEO', 'MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.announcements.delete(id, user);
  }
}
