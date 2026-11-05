import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CashAccessPolicy, CashPrincipal } from './cash-access';

const ISSUER = 'enako-cash';
const AUDIENCE = 'enako-cash-dashboard';
const TTL_SECONDS = 15 * 60;
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const DUMMY_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

@Injectable()
export class CashAuthService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly jwt: JwtService, private readonly policy: CashAccessPolicy) {}

  onModuleInit() {
    // An unused cash boundary stays disabled; provisioned cash must fail closed.
    if (Object.keys(this.policy.grants()).length) this.secret();
  }

  private secret() {
    const secret = this.config.get<string>('CASH_JWT_SECRET');
    if (!secret || Buffer.byteLength(secret) < 32 || secret === this.config.get<string>('JWT_ACCESS_SECRET') || secret === this.config.get<string>('JWT_REFRESH_SECRET')) {
      throw new ServiceUnavailableException('Cash authentication is not configured');
    }
    return secret;
  }

  async login(identifier: string, password: string, gatewayEmail?: string) {
    const secret = this.secret();
    if (typeof identifier !== 'string' || identifier.length > 254 || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) throw new UnauthorizedException('Invalid cash credentials or access not provisioned');
    const ids = Object.keys(this.policy.grants());
    const candidates = ids.length ? await this.prisma.cashUser.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: { id: true, email: true, phone: true, fullName: true, passwordHash: true, passwordChangedAt: true, terminalId: true, branch: true },
    }) : [];
    const normalized = identifier.trim().toLowerCase();
    const matches = candidates.filter(user => {
      let terminal = '';
      terminal = user.terminalId;
      return user.email.toLowerCase() === normalized || (terminal && terminal.toLowerCase() === normalized) || (user.phone && /^\+?[\d\s()-]+$/.test(normalized) && user.phone.replace(/\D/g, '') === normalized.replace(/\D/g, ''));
    });
    const user = matches.length === 1 ? matches[0] : undefined;
    const strongHash = !!user && /^\$2[aby]\$\d{2}\$/.test(user.passwordHash);
    const valid = await bcrypt.compare(password, strongHash ? user!.passwordHash : DUMMY_HASH);
    if (!user || !strongHash || !valid) {
      await this.prisma.cashAuditLog.create({ data: { action: 'CASH_LOGIN_FAILED', entity: 'cash_session' } });
      throw new UnauthorizedException('Invalid cash credentials or access not provisioned');
    }
    if (gatewayEmail && user.email.toLowerCase() !== gatewayEmail) throw new UnauthorizedException('Gateway and application identities must match');
    const cashLevel = this.policy.require({ sub: user.id }, 'session');
    const sid = randomUUID();
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid, app: 'cash', v: user.passwordChangedAt?.getTime() ?? null }, { secret, algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: TTL_SECONDS });
    await this.prisma.$transaction(async tx => {
      await tx.cashSession.create({ data: { id: sid, cashUserId: user.id, tokenHash: digest(accessToken), expiresAt: new Date(Date.now() + TTL_SECONDS * 1000) } });
      await tx.cashAuditLog.create({ data: { actorId: user.id, action: 'CASH_LOGIN', entity: 'cash_session', entityId: sid } });
    });
    return { accessToken, expiresIn: TTL_SECONDS, user: this.profile(user, cashLevel) };
  }

  private profile(user: { id: string; email: string; fullName: string; branch: string; terminalId: string }, cashLevel: 'operator' | 'administrator') {
    return { id: user.id, name: user.fullName, email: user.email, terminalId: user.terminalId, branch: user.branch, cashLevel };
  }

  async authenticate(token: string): Promise<CashPrincipal> {
    const secret = this.secret();
    let claims: { sub: string; sid: string; app: string; v: number | null };
    try { claims = await this.jwt.verifyAsync(token, { secret, algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE }); }
    catch { throw new UnauthorizedException('Invalid or expired cash session'); }
    if (claims.app !== 'cash' || typeof claims.sid !== 'string' || typeof claims.sub !== 'string') throw new UnauthorizedException('Invalid cash session');
    const session = await this.prisma.cashSession.findFirst({ where: { id: claims.sid, cashUserId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session || session.tokenHash !== digest(token) || session.user.status !== 'ACTIVE' || claims.v !== (session.user.passwordChangedAt?.getTime() ?? null)) throw new UnauthorizedException('Cash session revoked');
    return { sub: session.user.id, email: session.user.email, app: 'cash', cashLevel: this.policy.require({ sub: session.user.id }, 'session'), cashSessionId: session.id };
  }

  async me(user: CashPrincipal) {
    const account = await this.prisma.cashUser.findUniqueOrThrow({ where: { id: user.sub }, select: { id: true, email: true, fullName: true, branch: true, terminalId: true } });
    return this.profile(account, this.policy.require(user, 'session'));
  }

  async logout(user: CashPrincipal) {
    await this.prisma.$transaction(async tx => {
      await tx.cashSession.updateMany({ where: { id: user.cashSessionId, cashUserId: user.sub, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.cashAuditLog.create({ data: { actorId: user.sub, action: 'CASH_LOGOUT', entity: 'cash_session', entityId: user.cashSessionId } });
    });
    return { success: true };
  }
}
