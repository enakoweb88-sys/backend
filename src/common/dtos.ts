import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RoleName, MealStatus, KycStatus } from '../enums';

// Re-export enums for backward compatibility
export { RoleName, MealStatus, KycStatus };

export class QueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 25;
}

export class CreateEmployeeDto {
  @IsString()
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(RoleName)
  role!: RoleName;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  password!: string;
}

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(RoleName)
  @IsOptional()
  role?: RoleName;

  @IsString()
  @IsOptional()
  department?: string;
}

export class MoneyDto {
  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  priority?: string;
}

export class MealDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(MealStatus)
  status!: MealStatus;
}

export class KycReviewDto {
  @IsEnum(KycStatus)
  status!: KycStatus;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
