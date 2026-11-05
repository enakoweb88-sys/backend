import { uploadLimits } from '../../common/upload-validation';
import { CashFilesService } from './cash-files.service';
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
import { CurrentUser } from '../../common/current-user.decorator';
import { QueryDto } from '../../common/dtos';
import { CashCollectionsService } from './cash-collections.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CashAccessGuard } from './cash-access.guard';
import { CashPrincipal, RequireCashPermission } from './cash-access';
import { CashClientDto, CashCollectionDto, CashReceiptDto, CashStatusDto, CreateCollectorDto, DeactivateCollectorDto } from './cash.dto';
import { CashResponseInterceptor } from './cash-response.interceptor';


@Controller('cash-collections')
@UseGuards(CashAccessGuard)
@UseInterceptors(CashResponseInterceptor)
export class CashCollectionsController {
  constructor(private readonly cashCollections: CashCollectionsService, private readonly privateFiles: CashFilesService) {}

  @Get()
  @RequireCashPermission('records.read')
  list(
    @Query() query: QueryDto & { status?: string; collectorId?: string },
    @CurrentUser() user: CashPrincipal,
  ) {
    return this.cashCollections.list(query, user);
  }

  @Get('stats')
  @RequireCashPermission('records.read')
  getStats(@CurrentUser() user: CashPrincipal) {
    return this.cashCollections.getStats(user);
  }

  @Get('collectors')
  @RequireCashPermission('collectors.manage')
  listCollectors(@CurrentUser() user: CashPrincipal) {
    return this.cashCollections.listCollectors(user);
  }

  @Get('clients')
  @RequireCashPermission('clients.read')
  listClients(@CurrentUser() user: CashPrincipal) {
    return this.cashCollections.listClients(user);
  }

  @Post('clients')
  @RequireCashPermission('clients.create')
  createClient(@Body() dto: CashClientDto, @CurrentUser() user: CashPrincipal) {
    return this.cashCollections.createClient(dto, user);
  }

  @Post('collectors')
  @RequireCashPermission('collectors.manage')
  createCollector(@Body() dto: CreateCollectorDto, @CurrentUser() user: CashPrincipal) {
    return this.cashCollections.createCollector(dto, user);
  }

  @Delete('collectors/:id')
  @RequireCashPermission('collectors.manage')
  deleteCollector(@Param('id') id: string, @Body() body: DeactivateCollectorDto, @CurrentUser() user: CashPrincipal) {
    return this.cashCollections.deleteCollector(id, body, user);
  }

  @Delete('collectors')
  @RequireCashPermission('collectors.manage')
  deleteAllCollectors(@CurrentUser() user: CashPrincipal) {
    return this.cashCollections.deleteAllCollectors(user);
  }

  @Get(':id')
  @RequireCashPermission('records.read')
  findOne(@Param('id') id: string, @CurrentUser() user: CashPrincipal) {
    return this.cashCollections.findOne(id, user);
  }

  @Post()
  @RequireCashPermission('records.create')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: memoryStorage(),
      limits: { ...uploadLimits, files: 1 },
    }),
  )
  async create(
    @Body() dto: CashCollectionDto,
    @CurrentUser() user: CashPrincipal,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const saved = receipt ? await this.privateFiles.save(receipt, 'cash', user.sub, true) : undefined;
    const receiptUrl = saved ? '/api/v1/cash-collections/documents/' + saved.id : undefined;
    const record = await this.cashCollections.create(dto, user, receiptUrl);
    if (saved) await this.privateFiles.attach(saved.id, record.id);
    return record;
  }

  @Patch(':id/status')
  @RequireCashPermission('records.update')
  updateStatus(@Param('id') id: string, @Body() dto: CashStatusDto, @CurrentUser() user: CashPrincipal) {
    return this.cashCollections.updateStatus(id, dto, user);
  }

  @Post(':id/receipt')
  @RequireCashPermission('records.update')
  @UseInterceptors(FileInterceptor('receipt', { storage: memoryStorage(), limits: { ...uploadLimits, files: 1 } }))
  async attachReceipt(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: CashPrincipal) {
    await this.cashCollections.findOne(id, user);
    const stored = await this.privateFiles.save(file, 'cash', user.sub, true);
    const url = '/api/v1/cash-collections/documents/' + stored.id;
    const result = await this.cashCollections.attachReceipt(id, url, user);
    await this.privateFiles.attach(stored.id, id);
    return result;
  }

  @Post('send-receipt')
  @RequireCashPermission('receipts.send')
  sendReceipt(@Body() body: CashReceiptDto, @CurrentUser() user: CashPrincipal) {
    return this.cashCollections.sendReceiptEmail(body, user);
  }
}
