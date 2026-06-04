import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { RoleName } from '../../enums';

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
