import { Body, Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @UseGuards(JwtAuthGuard)
  @Get('tickets')
  getTickets(@CurrentUser() user: JwtUser) {
    return this.supportService.getTickets(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/contact')
  async contact(@Body() body: { subject: string; description: string; priority?: string }, @CurrentUser() user: JwtUser) {
    return this.supportService.createTicket({
      customer: user.email.split('@')[0],
      email: user.email,
      subject: body.subject,
      description: body.description
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/reply')
  async reply(@Param('id') id: string, @Body('message') message: string, @CurrentUser() user: JwtUser) {
    const isAdmin = user.role === 'CEO' || user.role === 'MANAGER' || user.role === 'SUPPORT';
    return this.supportService.addReply(id, message, isAdmin);
  }
}
