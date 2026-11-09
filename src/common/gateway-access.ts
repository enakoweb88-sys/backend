import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createPublicKey } from 'crypto';
import axios from 'axios';

export const PublicApi = () => SetMetadata('enako.public-api', true);

@Injectable()
export class GatewayAccess {
  private cache = new Map<string, string>();
  private cachedUntil = 0;
  private retryAfter = 0;
  private loading?: Promise<void>;
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService) {}
  onModuleInit() { this.settings(); }
  private settings() {
    const mode = this.config.get<string>('GATEWAY_ACCESS_MODE');
    if (mode === 'local-only' && this.config.get<string>('NODE_ENV') !== 'production') return { local: true, issuer: '', os: '', cash: '' };
    const issuer = this.config.get<string>('CF_ACCESS_TEAM_DOMAIN') || '';
    const os = this.config.get<string>('CF_ACCESS_OS_AUDIENCE') || '', cash = this.config.get<string>('CF_ACCESS_CASH_AUDIENCE') || '';
    if (mode !== 'required' || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) || !/^[a-f0-9]{64}$/.test(os) || !/^[a-f0-9]{64}$/.test(cash) || os === cash) throw new ServiceUnavailableException('Gateway configuration requires separate OS and Cash Access applications');
    return { local: false, issuer, os, cash };
  }
  async verify(assertion: unknown, app: 'os' | 'cash', remoteAddress?: string) {
    const settings = this.settings();
    if (settings.local) {
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress || '')) throw new UnauthorizedException('Local-only gateway mode accepts loopback connections only');
      return undefined;
    }
    if (typeof assertion !== 'string' || assertion.length > 16384) throw new UnauthorizedException('Verified gateway assertion required');
    const decoded: any = this.jwt.decode(assertion, { complete: true });
    if (decoded?.header?.alg !== 'RS256' || typeof decoded.header.kid !== 'string' || decoded.header.kid.length > 200) throw new UnauthorizedException('Invalid gateway assertion');
    if (Date.now() > this.cachedUntil) await this.loadKeys(settings.issuer);
    const pem = this.cache.get(decoded.header.kid);
    if (!pem) throw new UnauthorizedException('Unknown gateway signing key');
    try {
      const claims = await this.jwt.verifyAsync(assertion, { publicKey: pem, algorithms: ['RS256'], issuer: settings.issuer, audience: settings[app] });
      if (typeof claims.exp !== 'number' || typeof claims.email !== 'string' || !claims.email.includes('@')) throw Error('Missing identity');
      return { email: claims.email.toLowerCase(), expiresAt: claims.exp * 1000 };
    } catch { throw new UnauthorizedException('Invalid gateway assertion'); }
  }
  private async loadKeys(issuer: string) {
    if (this.loading) return this.loading;
    if (Date.now() < this.retryAfter) throw new ServiceUnavailableException('Gateway keys temporarily unavailable');
    this.retryAfter = Date.now() + 30000;
    this.loading = (async () => {
      try {
        const response = await axios.get(issuer + '/cdn-cgi/access/certs', { timeout: 5000, maxRedirects: 0, maxContentLength: 100000 });
        if (!Array.isArray(response.data?.keys) || response.data.keys.length > 20) throw Error();
        const keys = new Map<string, string>();
        for (const key of response.data.keys) if (key.kty === 'RSA' && typeof key.kid === 'string') keys.set(key.kid, createPublicKey({ key, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString());
        if (!keys.size) throw Error();
        this.cache = keys; this.cachedUntil = Date.now() + 5 * 60000;
      } catch { throw new ServiceUnavailableException('Gateway keys temporarily unavailable'); }
    })();
    try { await this.loading; } finally { this.loading = undefined; }
  }
}

@Injectable()
export class GatewayAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly gateway: GatewayAccess) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    if (this.reflector.getAllAndOverride('enako.public-api', [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const app = context.getClass().name.startsWith('Cash') ? 'cash' : 'os';
    req.gatewayIdentity = await this.gateway.verify(req.headers['cf-access-jwt-assertion'], app, req.socket.remoteAddress);
    // OS login binds the verified gateway identity to the authenticated account in AuthService.
    return true;
  }
}
