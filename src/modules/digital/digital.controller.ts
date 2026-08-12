import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { DigitalService } from './digital.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@Controller('digital')
@UseGuards(JwtAuthGuard)
export class DigitalController {
  constructor(private readonly digitalService: DigitalService) {}

  @Get('posts')
  getPosts() { return this.digitalService.getPosts(); }

  @Post('posts')
  createPost(@Body() dto: any) { return this.digitalService.createPost(dto); }

  @Patch('posts/:id/status')
  updatePostStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.digitalService.updatePostStatus(id, status);
  }

  @Get('accounts')
  getSocialAccounts() { return this.digitalService.getSocialAccounts(); }

  @Post('accounts')
  linkSocialAccount(@Body() dto: any) { return this.digitalService.linkSocialAccount(dto); }

  @Post('generate-ai-asset')
  generateAiAsset(@Body() dto: { prompt: string; topic: string; type: string }) {
    return this.digitalService.generateAiAsset(dto);
  }

  @Get('campaigns')
  getCampaigns() { return this.digitalService.getCampaigns(); }

  @Post('campaigns')
  createCampaign(@Body() dto: any) { return this.digitalService.createCampaign(dto); }

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
