import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async getTickets() {
    const items = await this.prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' } });
    
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
}
