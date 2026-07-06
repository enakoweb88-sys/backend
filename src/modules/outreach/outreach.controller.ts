import { Controller, Get, Post, Body } from '@nestjs/common';
import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Post('donations')
  async createDonation(@Body() data: any) {
    return this.outreachService.createDonation(data);
  }

  @Get('donations')
  async getDonations() {
    return this.outreachService.getDonations();
  }

  @Get('stats')
  async getStats() {
    return this.outreachService.getOverviewStats();
  }
}
