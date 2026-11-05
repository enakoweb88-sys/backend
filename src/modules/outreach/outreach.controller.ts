import { PublicApi } from '../../common/gateway-access';
import { Headers } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../../common/permissions';
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OutreachService } from './outreach.service';

@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get('admin/search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  adminSearch(@Query('q') query: string) { return this.outreachService.globalSearch(query, true); }

  @Get('admin/events')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  adminEvents() { return this.outreachService.getEvents(true); }

  @Get('admin/posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  adminPosts(@Query('status') status?: string) { return this.outreachService.getPosts(status, true); }

  @Get('search')
  @PublicApi()
  async globalSearch(@Query('q') query: string) {
    return this.outreachService.globalSearch(query);
  }

  @Post('donations')
  @PublicApi()
  async createDonation(@Body() data: any, @Headers('idempotency-key') key?: string) {
    return this.outreachService.createDonation(data, key);
  }

  @Get('donations/status/:uuid')
  @PublicApi()
  async getDonationStatus(
    @Param('uuid') uuid: string,
    @Headers('x-payment-status-token') token: string,
    @Query('donationId') donationId: string
  ) {
    return this.outreachService.getDonationStatus(uuid, token, donationId);
  }

  @Post('donations/webhook/orange')
  @PublicApi()
  async handleOrangeWebhook(@Body() payload: any) {
    return this.outreachService.handleOrangeWebhook(payload);
  }

  @Post('donations/webhook/mtn')
  @PublicApi()
  async handleMtnWebhook(@Body() payload: any) {
    return this.outreachService.handleMtnWebhook(payload);
  }

  @Get('donations')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async getDonations() {
    return this.outreachService.getDonations();
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async getStats() {
    return this.outreachService.getOverviewStats();
  }

  @Post('applications')
  @PublicApi()
  async createApplication(@Body() data: any) {
    return this.outreachService.createApplication(data);
  }

  @Get('applications')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async getApplications() {
    return this.outreachService.getApplications();
  }

  @Post('newsletters/send')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async sendNewsletter(@Body() data: { subject: string; body: string; audience: string }) {
    return this.outreachService.sendNewsletter(data);
  }

  // --- Outreach Events (Scholarships, etc) ---
  @Get('events')
  @PublicApi()
  async getEvents() {
    return this.outreachService.getEvents();
  }

  @Post('events')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async createEvent(@Body() data: any) {
    return this.outreachService.createEvent(data);
  }

  @Post('events/:id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async updateEventStatus(@Param('id') id: string, @Body() data: { status: any; openDate?: string }) {
    return this.outreachService.updateEventStatus(id, data.status, data.openDate);
  }

  // --- Blog Posts ---
  @Get('posts')
  @PublicApi()
  async getPosts(@Query('status') status?: string) {
    return this.outreachService.getPosts(status);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async createPost(@Body() data: any) {
    return this.outreachService.createPost(data);
  }

  @Put('posts/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async updatePost(@Param('id') id: string, @Body() data: any) {
    return this.outreachService.updatePost(id, data);
  }

  @Post('posts/:id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async updatePostStatus(@Param('id') id: string, @Body() data: { status: string }) {
    return this.outreachService.updatePostStatus(id, data.status);
  }

  // --- Analytics & Cookie Tracking ---
  @Post('analytics/consent')
  @PublicApi()
  async recordCookieConsent(@Body() data: { consent: string; userAgent?: string; deviceType?: string; country?: string }) {
    return this.outreachService.recordCookieConsent(data);
  }

  @Post('analytics/event')
  @PublicApi()
  async recordAnalyticsEvent(@Body() data: any) {
    return this.outreachService.recordAnalyticsEvent(data);
  }

  @Get('analytics/insights')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async getWebInsights(@Query('site') site?: string) {
    return this.outreachService.getWebInsights(site);
  }

  // --- Community Projects ---
  @Get('community-projects')
  @PublicApi()
  async getCommunityProjects(@Query('communitySlug') communitySlug?: string) {
    return this.outreachService.getCommunityProjects(communitySlug);
  }

  @Post('community-projects')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async createCommunityProject(@Body() data: any) {
    return this.outreachService.createCommunityProject(data);
  }

  @Put('community-projects/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async updateCommunityProject(@Param('id') id: string, @Body() data: any) {
    return this.outreachService.updateCommunityProject(id, data);
  }

  @Delete('community-projects/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async deleteCommunityProject(@Param('id') id: string) {
    return this.outreachService.deleteCommunityProject(id);
  }

  // --- Public Impact Stats ---
  @Get('public-impact-stats')
  @PublicApi()
  async getPublicImpactStats() {
    return this.outreachService.getPublicImpactStats();
  }

  @Post('public-impact-stats')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async createPublicImpactStat(@Body() data: any) {
    return this.outreachService.createPublicImpactStat(data);
  }

  @Put('public-impact-stats/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async updatePublicImpactStat(@Param('id') id: string, @Body() data: any) {
    return this.outreachService.updatePublicImpactStat(id, data);
  }

  @Delete('public-impact-stats/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('outreach.manage')
  async deletePublicImpactStat(@Param('id') id: string) {
    return this.outreachService.deletePublicImpactStat(id);
  }
}
