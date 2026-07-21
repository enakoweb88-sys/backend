import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvestmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.investment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(data: any) {
    return this.prisma.investment.create({
      data: {
        title: data.title,
        category: data.category,
        amount: data.amount,
        weight: data.weight,
        color: data.color || 'bg-primary'
      }
    });
  }

  async update(id: string, data: any) {
    return this.prisma.investment.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    return this.prisma.investment.delete({
      where: { id }
    });
  }
}
