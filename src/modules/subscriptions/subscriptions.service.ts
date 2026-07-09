import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../../common/current-user.decorator';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from '../../common/dtos';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  list(user: JwtUser) {
    const isEmployee = user.role === 'EMPLOYEE';
    return this.prisma.subscription.findMany({
      where: isEmployee ? { addedById: user.sub } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { addedBy: { select: { fullName: true } } }
    });
  }

  create(dto: CreateSubscriptionDto, user: JwtUser) {
    return this.prisma.subscription.create({
      data: {
        name: dto.name,
        cost: dto.cost,
        cycle: dto.cycle,
        status: 'Active',
        startDate: new Date(dto.startDate),
        nextBilling: new Date(dto.nextBilling),
        receiptUrl: dto.receiptUrl,
        addedById: user.sub
      }
    });
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');

    return this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.cost !== undefined ? { cost: dto.cost } : {}),
        ...(dto.cycle ? { cycle: dto.cycle } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.nextBilling ? { nextBilling: new Date(dto.nextBilling) } : {}),
        ...(dto.receiptUrl !== undefined ? { receiptUrl: dto.receiptUrl } : {})
      }
    });
  }
}
