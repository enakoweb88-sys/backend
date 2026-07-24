import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get('search')
  async globalSearch(@Query('q') query: string) {
    return this.outreachService.globalSearch(query);
  }

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

  @Post('applications')
  async createApplication(@Body() data: any) {
    return this.outreachService.createApplication(data);
  }

  @Get('applications')
  async getApplications() {
    return this.outreachService.getApplications();
  }

  @Post('newsletters/send')
  async sendNewsletter(@Body() data: { subject: string; body: string; audience: string }) {
    return this.outreachService.sendNewsletter(data);
  }

  // --- Outreach Events (Scholarships, etc) ---
  @Get('events')
  async getEvents() {
    return this.outreachService.getEvents();
  }

  @Post('events')
  async createEvent(@Body() data: any) {
    return this.outreachService.createEvent(data);
  }

  @Post('events/:id/status')
  async updateEventStatus(@Body() data: { id: string; status: any }) {
    return this.outreachService.updateEventStatus(data.id, data.status);
  }

  // --- Blog Posts ---
  @Get('posts')
  async getPosts(@Query('status') status?: string) {
    return this.outreachService.getPosts(status);
  }

  @Post('posts')
  async createPost(@Body() data: any) {
    return this.outreachService.createPost(data);
  }

  @Put('posts/:id')
  async updatePost(@Param('id') id: string, @Body() data: any) {
    return this.outreachService.updatePost(id, data);
  }

  @Post('posts/:id/status')
  async updatePostStatus(@Param('id') id: string, @Body() data: { status: string }) {
    return this.outreachService.updatePostStatus(id, data.status);
  }

  // --- Analytics & Cookie Tracking ---
  @Post('analytics/consent')
  async recordCookieConsent(@Body() data: { consent: string; userAgent?: string; deviceType?: string; country?: string }) {
    return this.outreachService.recordCookieConsent(data);
  }

  @Post('analytics/event')
  async recordAnalyticsEvent(@Body() data: any) {
    return this.outreachService.recordAnalyticsEvent(data);
  }

  @Get('analytics/insights')
  async getWebInsights() {
    return this.outreachService.getWebInsights();
  }

  // --- Community Projects ---
  @Get('community-projects')
  async getCommunityProjects(@Query('communitySlug') communitySlug?: string) {
    return this.outreachService.getCommunityProjects(communitySlug);
  }

  @Post('community-projects')
  async createCommunityProject(@Body() data: any) {
    return this.outreachService.createCommunityProject(data);
  }

  @Put('community-projects/:id')
  async updateCommunityProject(@Param('id') id: string, @Body() data: any) {
    return this.outreachService.updateCommunityProject(id, data);
  }

  @Delete('community-projects/:id')
  async deleteCommunityProject(@Param('id') id: string) {
    return this.outreachService.deleteCommunityProject(id);
  }
}
