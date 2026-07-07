import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async getTickets() {
    const items = await this.prisma.supportTicket.findMany({ 
      orderBy: { createdAt: 'desc' },
      include: { replies: { orderBy: { createdAt: 'asc' } } }
    });
    
    return {
      counts: {
        new: items.filter(t => t.status === 'New').length,
        inProgress: items.filter(t => t.status === 'In Progress').length,
        resolved: items.filter(t => t.status === 'Resolved').length,
        escalated: items.filter(t => t.status === 'Escalated').length,
      },
      items
    };
  }

  async createTicket(data: { customer: string; email: string; subject: string; description: string }) {
    return this.prisma.supportTicket.create({
      data: {
        customer: data.customer,
        clientEmail: data.email,
        subject: data.subject,
        description: data.description,
        status: 'New'
      }
    });
  }

  async addReply(ticketId: string, message: string, isAdmin: boolean) {
    const reply = await this.prisma.supportTicketReply.create({
      data: {
        ticketId,
        message,
        isAdmin
      }
    });

    if (isAdmin) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'Resolved' } // Auto resolve on admin reply for simplicity
      });
    }

    return reply;
  }
}
