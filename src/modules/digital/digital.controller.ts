import { Controller, Get, UseGuards } from '@nestjs/common';
import { DigitalService } from './digital.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@Controller('digital')
@UseGuards(JwtAuthGuard)
export class DigitalController {
  constructor(private readonly digitalService: DigitalService) {}

  @Get('calendar')
  getCalendar() { return this.digitalService.getCalendar(); }

  @Get('tasks')
  getTasks() { return this.digitalService.getTasks(); }

  @Get('approvals')
  getApprovals() { return this.digitalService.getApprovals(); }

  @Get('social')
  getSocial() { return this.digitalService.getSocial(); }

  @Get('top-posts')
  getTopPosts() { return this.digitalService.getTopPosts(); }

  @Get('ads')
  getAds() { return this.digitalService.getAds(); }

  @Get('content-types')
  getContentTypes() { return this.digitalService.getContentTypes(); }

  @Get('website')
  getWebsite() { return this.digitalService.getWebsite(); }
}
