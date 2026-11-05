import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CashCollectionDto {
  @IsOptional() @IsString() @MaxLength(128) id?: string;
  @IsString() @MinLength(1) @MaxLength(200) clientName!: string;
  @IsString() @MinLength(1) @MaxLength(200) location!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amountCollected!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) outstandingBalance?: number;
  @IsOptional() @IsIn(['XAF', 'FCFA', 'USD', 'EUR', 'GBP', 'NGN', 'CAD']) currency?: string;
  @IsOptional() @IsDateString() collectionTime?: string;
  @IsOptional() @IsIn(['COMPLETE', 'PENDING', 'CANCELLED']) status?: 'COMPLETE' | 'PENDING' | 'CANCELLED';
  @IsString() @MaxLength(10000) description!: string;
  // Existing inline receipt images remain compatible; private upload migration is a later batch.
  @IsOptional() @IsString() @MaxLength(14 * 1024 * 1024) receiptUrl?: string;
  @IsOptional() @IsString() @MaxLength(128) collectorId?: string;
}

export class CashStatusDto {
  @IsIn(['COMPLETE', 'CANCELLED']) status!: 'COMPLETE' | 'CANCELLED';
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) actualAmountCollected?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) shortageAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) extraAmount?: number;
  @IsOptional() @IsString() @MaxLength(2000) summaryNote?: string;
}

export class CreateCollectorDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(72) password!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) branch?: string;
  @IsOptional() @IsString() @MaxLength(100) role?: string;
  @IsOptional() @IsString() @MaxLength(128) terminalId?: string;
}

export class DeactivateCollectorDto {
  @IsString() @MaxLength(128) confirmation!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class CashClientDto {
  @IsString() @MinLength(1) @MaxLength(128) id!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @MinLength(1) @MaxLength(300) address!: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) outstandingBalance?: number;
  @IsOptional() @IsString() @MaxLength(100) lastVisit?: string;
}

export class CashReceiptDto {
  @IsString() @MinLength(1) @MaxLength(128) collectionId!: string;
}

export class CashCreateTransactionDto {
  @IsString()
  entity!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amountInXaf?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsString()
  @IsOptional()
  currency?: string = 'XAF';

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  charges?: number = 0;

  @IsString()
  @IsOptional()
  description?: string;
}
