import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage, ThrottlerException } from '@nestjs/throttler';
import { createHmac } from 'crypto';
import { AuthService } from '../modules/auth/auth.service';
import { CashAuthService } from '../modules/cash-collections/cash-auth.service';

@Injectable()
export class HttpRateLimitGuard extends ThrottlerGuard {
  constructor(@InjectThrottlerOptions() options: ThrottlerModuleOptions, @InjectThrottlerStorage() storage: ThrottlerStorage, reflector: Reflector, private readonly config: ConfigService, private readonly auth: AuthService, private readonly cash: CashAuthService) { super(options, storage, reflector); }
  async onModuleInit() { this.hash('startup-check'); await super.onModuleInit(); }
  private hash(value: string) {
    const secret = this.config.get<string>('RATE_LIMIT_HASH_SECRET');
    if (!secret || Buffer.byteLength(secret) < 32) throw new ServiceUnavailableException('Rate-limit security configuration is missing');
    return createHmac('sha256', secret).update(value).digest('hex');
  }
  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true; // WebSockets have their own authenticated event limits.
    // Readiness must reach its bounded probe even when the PostgreSQL limiter is down.
    if (this.reflector.getAllAndOverride<boolean>('enako.health-check', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const budget = Number(this.config.get<string>('RATE_LIMIT_IP_BUDGET') || 6000);
    if (!Number.isInteger(budget) || budget < 120 || budget > 60000) throw new ServiceUnavailableException('Invalid rate-limit IP budget');
    const result = await this.storageService.increment(this.hash('ip|' + req.ip), 60000);
    if (result.totalHits > budget) throw new ThrottlerException();
    const guards: any[] = [...(Reflect.getMetadata('__guards__', context.getClass()) || []), ...(Reflect.getMetadata('__guards__', context.getHandler()) || [])];
    const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    if (token && guards.some(g => g.name === 'CashAccessGuard')) req.cashPrincipal = req.user = await this.cash.authenticate(token);
    else if (token && guards.some(g => g.name === 'JwtAuthGuard')) req.osPrincipal = req.user = await this.auth.validateAccessToken(token);
    req.rateLimitController = context.getClass().name;
    req.rateLimitHandler = context.getHandler().name;
    return super.canActivate(context);
  }
  protected async getTracker(req: Record<string, any>) {
    if (['AuthController', 'CashAuthController'].includes(req.rateLimitController) && req.rateLimitHandler === 'login') {
      const identifier = String(req.body?.email || req.body?.identifier || '').trim().toLowerCase().slice(0, 254);
      return this.hash('login|' + identifier);
    }
    if (req.osPrincipal) return this.hash('os|' + req.osPrincipal.sub);
    if (req.cashPrincipal) return this.hash('cash|' + req.cashPrincipal.sub);
    return this.hash('anonymous|' + req.ip);
  }
}
