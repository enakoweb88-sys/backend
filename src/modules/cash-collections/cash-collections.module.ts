import { CashTransactionsController } from './cash-transactions.controller';
import { CashTransactionsService } from './cash-transactions.service';
import { CashFilesService } from './cash-files.service';
import { CashKycController, CashPrivateFilesController } from './cash-kyc.controller';
import { CashMailService } from './cash-mail.service';
import { Module } from '@nestjs/common';
import { CashCollectionsController } from './cash-collections.controller';
import { CashCollectionsService } from './cash-collections.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CashAccessPolicy } from './cash-access';
import { CashAccessGuard } from './cash-access.guard';
import { CashAuthService } from './cash-auth.service';
import { CashAuthController } from './cash-auth.controller';

@Module({
  imports: [PrismaModule, ConfigModule, JwtModule.register({})],
  controllers: [CashCollectionsController, CashAuthController, CashTransactionsController, CashKycController, CashPrivateFilesController],
  providers: [CashFilesService, CashTransactionsService, CashMailService, CashCollectionsService, CashAccessPolicy, CashAccessGuard, CashAuthService],
  exports: [CashCollectionsService, CashAuthService, CashAccessPolicy, CashAccessGuard],
})
export class CashCollectionsModule {}
