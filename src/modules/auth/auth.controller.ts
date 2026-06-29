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
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.connection.remoteAddress;
    const device = req.headers['user-agent'];
    return this.auth.login(dto, ip, device);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const ip = req.ip || req.connection.remoteAddress;
    const device = req.headers['user-agent'];
    return this.auth.refresh(dto.refreshToken, ip, device);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: JwtUser) {
    return this.auth.logout(user.sub);
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
