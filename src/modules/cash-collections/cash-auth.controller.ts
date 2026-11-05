import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/current-user.decorator';
import { CashPrincipal, RequireCashPermission } from './cash-access';
import { CashAccessGuard } from './cash-access.guard';
import { CashAuthService } from './cash-auth.service';
import { CashResponseInterceptor } from './cash-response.interceptor';

export class CashLoginDto {
  @IsString() @MinLength(1) @MaxLength(254) identifier!: string;
  @IsString() @MinLength(1) @MaxLength(72) password!: string;
}

@Controller('cash-auth')
@UseInterceptors(CashResponseInterceptor)
export class CashAuthController {
  constructor(private readonly auth: CashAuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() body: CashLoginDto, @Req() request: any) { return this.auth.login(body.identifier, body.password, request.gatewayIdentity?.email); }

  @Get('me')
  @UseGuards(CashAccessGuard)
  @RequireCashPermission('session')
  me(@CurrentUser() user: CashPrincipal) { return this.auth.me(user); }

  @Post('logout')
  @UseGuards(CashAccessGuard)
  @RequireCashPermission('session')
  logout(@CurrentUser() user: CashPrincipal) { return this.auth.logout(user); }
}
