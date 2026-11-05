import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { LoginDto } from './dto';
import { isCashOnlyAccount } from '../../common/application-boundary';
import { jwtSettings } from '../../common/security-config';
import { serializable } from '../../common/serializable';
import { PermissionPolicy } from '../../common/permissions';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);
const userInclude = { role: true, department: true, ledDepartments: true } as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService, private readonly security: SecurityService, private readonly permissions: PermissionPolicy) {}
  onModuleInit() { jwtSettings(this.config); }

  private accountValid(user: any) { return !!user && user.status === 'ACTIVE' && !isCashOnlyAccount(user.responsibilities); }
  private version(value: Date | null | undefined) { return value?.getTime() ?? null; }

  async login(dto: LoginDto, ip?: string, device?: string) {
    const found = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, include: userInclude });
    const valid = await bcrypt.compare(dto.password, found?.passwordHash?.startsWith('$2') ? found.passwordHash : dummyHash);
    if (!this.accountValid(found) || !valid || Buffer.byteLength(dto.password) > 72) {
      await this.prisma.auditLog.create({ data: { action: 'AUTH_LOGIN_FAILED', entity: 'auth' } });
      throw new UnauthorizedException('Invalid credentials');
    }
    const settings = jwtSettings(this.config);
    return serializable(this.prisma, async tx => {
      const user = await tx.user.findUnique({ where: { id: found!.id }, include: userInclude });
      if (!this.accountValid(user) || user!.passwordHash !== found!.passwordHash) throw new UnauthorizedException('Invalid credentials');
      const session = await tx.authSession.create({ data: { id: randomUUID(), userId: user!.id, roleAtIssue: user!.role.name, passwordVersion: user!.passwordChangedAt, expiresAt: new Date(Date.now() + settings.refreshSeconds * 1000), device: device?.slice(0, 200), ipAddress: ip?.slice(0, 100) } });
      await tx.user.update({ where: { id: user!.id }, data: { lastLoginAt: new Date() } });
      await tx.userSession.create({ data: { id: session.id, userId: user!.id } });
      const tokens = await this.issue(tx, user!, session);
      await tx.auditLog.create({ data: { actorId: user!.id, action: 'AUTH_LOGIN', entity: 'auth_session', entityId: session.id } });
      return { user: this.publicUser(user), sessionId: session.id, ...tokens };
    });
  }

  private async issue(tx: Prisma.TransactionClient, user: any, session: any) {
    const settings = jwtSettings(this.config), id = randomUUID();
    const remaining = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    if (remaining < 1) throw new UnauthorizedException('Session expired');
    const common = { sub: user.id, sid: session.id, app: 'os' };
    const accessToken = await this.jwt.signAsync({ ...common, email: user.email, role: user.role.name }, { secret: settings.access, algorithm: 'HS256', issuer: settings.issuer, audience: settings.audience, expiresIn: Math.min(settings.accessSeconds, remaining), jwtid: randomUUID() });
    const refreshToken = await this.jwt.signAsync({ ...common, use: 'refresh' }, { secret: settings.refresh, algorithm: 'HS256', issuer: settings.issuer, audience: settings.audience, expiresIn: remaining, jwtid: id });
    await tx.refreshToken.create({ data: { id, userId: user.id, authSessionId: session.id, tokenHash: digest(refreshToken), expiresAt: session.expiresAt, device: 'os-refresh-v2' } });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string, _ip?: string, _device?: string, gatewayEmail?: string) {
    const settings = jwtSettings(this.config);
    let claims: any;
    try { claims = await this.jwt.verifyAsync(refreshToken, { secret: settings.refresh, algorithms: ['HS256'], issuer: settings.issuer, audience: settings.audience }); }
    catch { throw new UnauthorizedException('Invalid refresh token; reauthentication required'); }
    if (claims.app !== 'os' || claims.use !== 'refresh' || typeof claims.jti !== 'string' || typeof claims.sid !== 'string') throw new UnauthorizedException('Legacy session requires reauthentication under the approved cutover plan');
    const result = await serializable(this.prisma, async tx => {
      const record = await tx.refreshToken.findUnique({ where: { id: claims.jti }, include: { authSession: { include: { user: { include: userInclude } } } } });
      if (!record || record.tokenHash !== digest(refreshToken) || record.userId !== claims.sub || record.authSessionId !== claims.sid) return { error: true };
      const session = record.authSession, user = session?.user;
      if (gatewayEmail && user?.email.toLowerCase() !== gatewayEmail.toLowerCase()) return { error: true };
      if (record.usedAt) {
        await tx.authSession.updateMany({ where: { id: claims.sid }, data: { revokedAt: new Date() } });
        await tx.refreshToken.updateMany({ where: { authSessionId: claims.sid, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: record.userId, action: 'AUTH_REFRESH_REUSE_DETECTED', entity: 'auth_session', entityId: claims.sid } });
        return { error: true };
      }
      if (record.revokedAt || record.expiresAt <= new Date() || !session || session.revokedAt || session.expiresAt <= new Date() || !this.accountValid(user) || session.roleAtIssue !== user!.role.name || this.version(session.passwordVersion) !== this.version(user!.passwordChangedAt)) return { error: true };
      const consumed = await tx.refreshToken.updateMany({ where: { id: record.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date(), revokedAt: new Date() } });
      if (consumed.count !== 1) return { error: true };
      const tokens = await this.issue(tx, user!, session);
      const replacement: any = this.jwt.decode(tokens.refreshToken);
      await tx.refreshToken.update({ where: { id: record.id }, data: { replacedById: replacement.jti } });
      await tx.auditLog.create({ data: { actorId: user!.id, action: 'AUTH_REFRESH_ROTATED', entity: 'auth_session', entityId: session.id } });
      return { user: this.publicUser(user), ...tokens };
    });
    if ('error' in result) throw new UnauthorizedException('Refresh rejected; reauthentication required');
    return result;
  }

  async validateClaims(claims: any) {
    if (claims.app !== 'os' || typeof claims.sid !== 'string' || typeof claims.sub !== 'string') throw new UnauthorizedException('Invalid or legacy access session');
    const session = await this.prisma.authSession.findFirst({ where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: { include: userInclude } } });
    const user = session?.user;
    if (!session || !this.accountValid(user) || session.roleAtIssue !== user!.role.name || this.version(session.passwordVersion) !== this.version(user!.passwordChangedAt)) throw new UnauthorizedException('Session revoked or account unavailable');
    return { sub: user!.id, sid: session.id, email: user!.email, role: user!.role.name, departmentId: user!.departmentId || undefined, permissions: this.permissions.permissions({ sub: user!.id, email: user!.email, role: user!.role.name }) };
  }

  async validateAccessToken(token: string) {
    const settings = jwtSettings(this.config);
    try { return await this.validateClaims(await this.jwt.verifyAsync(token, { secret: settings.access, algorithms: ['HS256'], issuer: settings.issuer, audience: settings.audience })); }
    catch { throw new UnauthorizedException('Invalid or revoked access session'); }
  }

  async logout(userId: string, sid?: string) {
    await serializable(this.prisma, async tx => {
      await tx.authSession.updateMany({ where: { userId, ...(sid ? { id: sid } : {}), revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.refreshToken.updateMany({ where: { userId, ...(sid ? { authSessionId: sid } : {}), revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'AUTH_SESSION_REVOKED', entity: 'auth_session', entityId: sid } });
    });
    return { ok: true };
  }
  async endSession(id: string, userId: string) {
    await this.revokeSession(id, userId);
    return { ok: true };
  }
  getSessions(userId: string) {
    return this.prisma.authSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, select: { id: true, device: true, ipAddress: true, createdAt: true, expiresAt: true } });
  }
  async revokeSession(id: string, userId: string) {
    const session = await this.prisma.authSession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException('Session not found');
    return this.logout(userId, id);
  }
  private publicUser(user: any) {
    return { id: user.id, email: user.email, fullName: user.fullName, title: user.title ?? null, personalEmail: user.personalEmail ?? null, role: user.role.name, department: user.department?.name ?? null, ledDepartments: user.ledDepartments?.map((d: any) => d.name) || [], permissions: this.permissions.permissions({ sub: user.id, email: user.email, role: user.role.name }) };
  }
}
