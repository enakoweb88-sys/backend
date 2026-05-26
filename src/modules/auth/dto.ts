import { RoleName } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(RoleName)
  role!: RoleName;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
