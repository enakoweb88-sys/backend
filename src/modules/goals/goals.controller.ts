import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('goals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.goal.findMany({ include: { department: true }, orderBy: { createdAt: 'desc' } });
  }

  @Post()
  @Roles('CEO', 'MANAGER')
  create(@Body() body: { title: string; description?: string; targetValue?: number; unit?: string; dueDate?: string }) {
    return this.prisma.goal.create({
      data: {
        title: body.title,
        description: body.description,
        targetValue: body.targetValue,
        unit: body.unit,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      },
    });
  }
}
