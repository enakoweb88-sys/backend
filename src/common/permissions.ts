import { CanActivate, ExecutionContext, ForbiddenException, Global, Injectable, Module, ServiceUnavailableException, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtUser } from './current-user.decorator';

export const OS_PERMISSIONS = ['self', 'finance.read', 'finance.write', 'analytics.read', 'digital.manage', 'bd.manage', 'hr.manage', 'outreach.manage', 'audit.read'] as const;
export type OsPermission = typeof OS_PERMISSIONS[number];
const KEY = 'os:permission';
export const RequirePermission = (permission: OsPermission) => SetMetadata(KEY, permission);

@Injectable()
export class PermissionPolicy {
  constructor(private readonly config: ConfigService) {}
  onModuleInit() { this.permissions({ sub: 'configuration-check', email: '', role: 'EMPLOYEE' }); }
  permissions(user: JwtUser): OsPermission[] {
    const roleDefaults: OsPermission[] = user.role === 'CEO' ? [...OS_PERMISSIONS] : user.role === 'MANAGER' ? OS_PERMISSIONS.filter(p => p !== 'audit.read') : user.role === 'OUTREACH_MANAGER' ? ['outreach.manage'] : [];
    let grants: Record<string, OsPermission[]> = {};
    try {
      const value = JSON.parse(this.config.get<string>('OS_PERMISSION_GRANTS') || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      for (const [id, permissions] of Object.entries(value)) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || !Array.isArray(permissions) || permissions.some(p => !OS_PERMISSIONS.includes(p))) throw new Error();
      }
      grants = value;
    } catch { throw new ServiceUnavailableException('OS permission configuration is invalid'); }
    return [...new Set<OsPermission>([...roleDefaults, 'self', ...(Object.prototype.hasOwnProperty.call(grants, user.sub) ? grants[user.sub] : [])])];
  }
  require(user: JwtUser | undefined, permission: OsPermission) {
    if (!user || !this.permissions(user).includes(permission)) throw new ForbiddenException('Required application permission is missing');
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly policy: PermissionPolicy) {}
  canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<OsPermission>(KEY, [context.getHandler(), context.getClass()]);
    if (!permission) throw new ForbiddenException('Route permission is not configured');
    this.policy.require(context.switchToHttp().getRequest().user, permission);
    return true;
  }
}

@Global()
@Module({ providers: [PermissionPolicy, PermissionsGuard], exports: [PermissionPolicy, PermissionsGuard] })
export class PermissionsModule {}
