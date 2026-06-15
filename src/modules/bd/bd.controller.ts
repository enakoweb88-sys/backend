import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { BdService } from './bd.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@Controller('bd')
@UseGuards(JwtAuthGuard)
export class BdController {
  constructor(private readonly bdService: BdService) {}

  @Get('pipeline')
  getPipeline() {
    return this.bdService.getPipeline();
  }

  @Get('leads')
  getLeads() {
    return this.bdService.getLeads();
  }

  @Get('meetings')
  getMeetings() {
    return this.bdService.getMeetings();
  }

  @Get('performance')
  getPerformance() {
    return this.bdService.getPerformance();
  }

  @Get('commission')
  getCommission(@Req() req: any) {
    return this.bdService.getCommission(req.user.id);
  }
}
