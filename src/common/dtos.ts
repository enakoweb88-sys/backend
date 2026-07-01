import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { RoleName, MealStatus, KycStatus, TaskPriority, GoalScope } from '@prisma/client';

// Re-export enums for backward compatibility
export { RoleName, MealStatus, KycStatus, TaskPriority, GoalScope };

// ─── Query / Pagination ───────────────────────────────────────────────────────

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

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// ─── Employees ────────────────────────────────────────────────────────────────

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
  @MinLength(8)
  password!: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEmail()
  @IsOptional()
  personalEmail?: string;

  @IsString()
  @IsOptional()
  employmentType?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ledDepartments?: string[];
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

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEmail()
  @IsOptional()
  personalEmail?: string;

  @IsString()
  @IsOptional()
  employmentType?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ledDepartments?: string[];
}

// ─── Users (Self) ─────────────────────────────────────────────────────────────

export class UpdateMeDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export class CreateTransactionDto {
  @IsString()
  entity!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string = 'XAF';

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export class CreateExpenseDto {
  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string = 'XAF';

  @IsString()
  @IsOptional()
  category?: string;
}

// ─── MoneyDto (backward compat) ──────────────────────────────────────────────

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

  @IsString()
  @IsOptional()
  entity?: string;

  @IsString()
  @IsOptional()
  type?: string;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

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

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority = TaskPriority.NORMAL;
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;
}

export class CreateTaskCommentDto {
  @IsString()
  content!: string;
}

// ─── Meals ────────────────────────────────────────────────────────────────────

export class MealDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(MealStatus)
  status!: MealStatus;
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export class KycReviewDto {
  @IsEnum(KycStatus)
  status!: KycStatus;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export class CreateGoalDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  currentValue?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsEnum(GoalScope)
  @IsOptional()
  scope?: GoalScope = GoalScope.COMPANY;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class UpdateGoalDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  currentValue?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

// ─── Announcements ────────────────────────────────────────────────────────────

export class CreateAnnouncementDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean = false;
}

export class UpdateAnnouncementDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;
}

// ─── Performance ─────────────────────────────────────────────────────────────

export class CreatePerformanceMetricDto {
  @IsString()
  userId!: string;

  @IsString()
  metric!: string;

  @Type(() => Number)
  @IsNumber()
  value!: number;

  @IsString()
  period!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export class CreateSubscriptionDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  cost!: number;

  @IsString()
  cycle!: string;

  @IsString()
  nextBilling!: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class UpdateSubscriptionDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  cost?: number;

  @IsString()
  @IsOptional()
  cycle?: string;

  @IsString()
  @IsOptional()
  nextBilling?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}
