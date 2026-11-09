import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.connection.remoteAddress;
    const device = req.headers['user-agent'];
    return this.auth.login(dto, ip, device, (req as any).gatewayIdentity?.email);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const ip = req.ip || req.connection.remoteAddress;
    const device = req.headers['user-agent'];
    return this.auth.refresh(dto.refreshToken, ip, device, (req as any).gatewayIdentity?.email);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: JwtUser) {
    return this.auth.logout(user.sub, user.sid);
  }

  @Post('end-session')
  @UseGuards(JwtAuthGuard)
  endSession(@Body('sessionId') sessionId: string, @CurrentUser() user: JwtUser) {
    if (!sessionId) return { ok: false };
    return this.auth.endSession(sessionId, user.sub);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  getSessions(@CurrentUser() user: JwtUser) {
    return this.auth.getSessions(user.sub);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  revokeSession(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.auth.revokeSession(id, user.sub);
  }
}
