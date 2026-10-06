import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { MailService } from '../mail/mail.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: JwtUser) {
    return this.notifications.findAll(user.sub);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  unreadCount(@CurrentUser() user: JwtUser) {
    return this.notifications.getUnreadCount(user.sub);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  markRead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.notifications.markRead(id, user.sub);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  markAllRead(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user.sub);
  }

  @Delete('clear-read')
  @UseGuards(JwtAuthGuard)
  clearRead(@CurrentUser() user: JwtUser) {
    return this.notifications.deleteRead(user.sub);
  }

  @Post('email')
  async sendEmailNotification(@Body() body: {
    to: string;
    subject?: string;
    collectionId?: string;
    clientName?: string;
    amount?: number;
    currency?: string;
    collectorName?: string;
    location?: string;
    status?: string;
    time?: string;
    depositDestination?: string;
    html?: string;
    text?: string;
  }) {
    if (body.collectionId) {
      return this.mail.sendCollectionReceiptAlert({
        toEmail: body.to,
        clientName: body.clientName || 'Valued Client',
        collectionId: body.collectionId,
        amount: Number(body.amount || 0),
        currency: body.currency || 'FCFA',
        collectorName: body.collectorName || 'Field Cash Collector',
        location: body.location || 'Douala Field Sector',
        status: body.status || 'PENDING',
        time: body.time || new Date().toLocaleString(),
        depositDestination: body.depositDestination,
      });
    }

    return this.mail.sendEmail({
      to: body.to,
      subject: body.subject || '[ENAKO OS] Notification Alert',
      html: body.html || `<p>${body.text || body.subject}</p>`,
      text: body.text || body.subject,
      senderType: 'NOTIFICATIONS',
    });
  }
}
