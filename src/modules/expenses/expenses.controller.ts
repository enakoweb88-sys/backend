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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CreateExpenseDto, QueryDto } from '../../common/dtos';
import { ExpenseStatus } from '@prisma/client';
import { ExpensesService } from './expenses.service';

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'receipts'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `receipt-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  list(@Query() query: QueryDto & { status?: string }, @CurrentUser() user: JwtUser) {
    return this.expenses.list(query, user);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only images and PDFs are allowed for receipts'), false);
        }
      },
    }),
  )
  create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: JwtUser,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const receiptUrl = receipt ? `/uploads/receipts/${receipt.filename}` : undefined;
    return this.expenses.create(dto, user, receiptUrl);
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
