import { Body, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @UseGuards(JwtAuthGuard)
  @Get('tickets')
  getTickets() {
    return this.supportService.getTickets();
  }

  @Post('tickets/contact')
  async contact(@Body() body: { name: string; email: string; subject: string; message: string }) {
    return this.supportService.createTicket({
      customer: body.name,
      email: body.email,
      subject: body.subject,
      description: body.message
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/reply')
  async reply(@Param('id') id: string, @Body('message') message: string) {
    return this.supportService.addReply(id, message, true);
  }
}
