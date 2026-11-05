import { SecureFilesService, uploadLimits } from '../files/secure-files.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateExpenseDto, QueryDto } from '../../common/dtos';
import { ExpenseStatus } from '@prisma/client';
import { ExpensesService } from './expenses.service';


@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService, private readonly privateFiles: SecureFilesService) {}

  @Get()
  list(@Query() query: QueryDto & { status?: string }, @CurrentUser() user: JwtUser) {
    return this.expenses.list(query, user);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: memoryStorage(),
      limits: { ...uploadLimits, files: 1 },
    }),
  )
  async create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: JwtUser,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const saved = receipt ? await this.privateFiles.save(receipt, 'expense', user.sub, true) : undefined;
    const receiptUrl = saved ? saved.url : undefined;
    const record = await this.expenses.create(dto, user, receiptUrl);
    if (saved) await this.privateFiles.attach(saved.id, record.id);
    return record;
  }

  @Patch(':id/approve')
  @Roles('CEO', 'MANAGER')
  approve(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.expenses.review(id, ExpenseStatus.APPROVED, user.sub);
  }

  @Patch(':id/reject')
  @Roles('CEO', 'MANAGER')
  reject(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.expenses.review(id, ExpenseStatus.REJECTED, user.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.expenses.delete(id, user);
  }
}
