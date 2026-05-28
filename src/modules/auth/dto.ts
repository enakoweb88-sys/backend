import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

enum RoleName {
  CEO = 'CEO',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(RoleName)
  role!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
