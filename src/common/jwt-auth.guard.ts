import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../modules/auth/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = /^Bearer ([^\s]+)$/.exec(request.headers.authorization || '')?.[1];
    if (!token) throw new UnauthorizedException('Authentication required');
    request.user = request.osPrincipal || await this.auth.validateAccessToken(token);
    if (request.gatewayIdentity?.email && request.gatewayIdentity.email.toLowerCase() !== request.user.email.toLowerCase()) throw new UnauthorizedException('Gateway identity does not match the application account');
    return true;
  }
}
