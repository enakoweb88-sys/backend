import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CASH_PERMISSION, CashAccessPolicy, CashPermission } from './cash-access';
import { CashAuthService } from './cash-auth.service';
import { matchesCashGatewayIdentity } from './cash-gateway-identity';

@Injectable()
export class CashAccessGuard implements CanActivate {
  constructor(private readonly auth: CashAuthService, private readonly policy: CashAccessPolicy, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const match = /^Bearer ([^\s]+)$/.exec(request.headers.authorization || '');
    if (!match) throw new UnauthorizedException('Cash authentication required');
    request.user = request.cashPrincipal || await this.auth.authenticate(match[1]);
    if (request.gatewayIdentity?.email && !matchesCashGatewayIdentity(request.user, request.gatewayIdentity.email)) throw new UnauthorizedException('Gateway identity does not match the cash account');
    const permission = this.reflector.getAllAndOverride<CashPermission>(CASH_PERMISSION, [context.getHandler(), context.getClass()]);
    if (!permission) throw new UnauthorizedException('Cash route permission is not configured');
    this.policy.require(request.user, permission);
    return true;
  }
}
