import {
  BadRequestException,
  Body,
  Controller,
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
import { CreateCashCollectionDto, QueryDto, UpdateCashCollectionStatusDto } from '../../common/dtos';
import { CashCollectionsService } from './cash-collections.service';

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'collections'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `collection-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

@Controller('cash-collections')
export class CashCollectionsController {
  constructor(private readonly cashCollections: CashCollectionsService) {}

  @Get()
  list(
    @Query() query: QueryDto & { status?: string; collectorId?: string },
    @CurrentUser() user?: JwtUser,
  ) {
    return this.cashCollections.list(query, user);
  }

  @Get('stats')
  getStats() {
    return this.cashCollections.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashCollections.findOne(id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only images and PDFs are allowed for deposit receipts'), false);
        }
      },
    }),
  )
  create(
    @Body() dto: CreateCashCollectionDto,
    @CurrentUser() user?: JwtUser,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const receiptUrl = receipt ? `/uploads/collections/${receipt.filename}` : undefined;
    return this.cashCollections.create(dto, user, receiptUrl);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCashCollectionStatusDto) {
    return this.cashCollections.updateStatus(id, dto);
  }

  @Post('send-receipt')
  sendReceipt(@Body() body: {
    toEmail: string;
    clientName: string;
    collectionId: string;
    amount: number;
    currency?: string;
    collectorName?: string;
    location?: string;
    status?: string;
    time?: string;
    depositDestination?: string;
    pdfBase64?: string;
  }) {
    return this.cashCollections.sendReceiptEmail(body);
  }
}
