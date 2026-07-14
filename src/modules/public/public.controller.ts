import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('impact')
  async getImpactData() {
    return this.publicService.getImpactData();
  }

  @Get('scholarships')
  async getScholarships() {
    return this.publicService.getScholarships();
  }

  @Get('scholarships/:id')
  async getScholarshipById(@Param('id') id: string) {
    return this.publicService.getScholarshipById(id);
  }

  @Get('events')
  async getEvents(@Query('type') type?: string) {
    return this.publicService.getEvents(type);
  }

  @Get('events/:id')
  async getEventById(@Param('id') id: string) {
    return this.publicService.getEventById(id);
  }
}
