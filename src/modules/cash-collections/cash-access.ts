import { ForbiddenException, Injectable, ServiceUnavailableException, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type CashLevel = 'operator' | 'administrator';
export type CashPermission = 'session' | 'records.read' | 'records.create' | 'records.update' | 'clients.read' | 'clients.create' | 'collectors.manage' | 'receipts.send' | 'finance.manage' | 'kyc.manage';
export type CashPrincipal = { sub: string; email: string; app: 'cash'; cashLevel: CashLevel; cashSessionId: string };
export const CASH_PERMISSION = 'cash:permission';
const PERMISSIONS: CashPermission[] = ['session', 'records.read', 'records.create', 'records.update', 'clients.read', 'clients.create', 'collectors.manage', 'receipts.send', 'finance.manage', 'kyc.manage'];
export const RequireCashPermission = (permission: CashPermission) => SetMetadata(CASH_PERMISSION, permission);

// Independent of OS role, job title, browser state and user-editable metadata.
@Injectable()
export class CashAccessPolicy {
  constructor(private readonly config: ConfigService) {}

  grants(): Record<string, CashLevel> {
    const raw = this.config.get<string>('CASH_ACCESS_GRANTS');
    if (!raw) return {};
    try {
      const value = JSON.parse(raw);
      if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length > 1000) throw new Error();
      for (const [id, level] of Object.entries(value)) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || !['operator', 'administrator'].includes(String(level))) throw new Error();
      }
      return value;
    } catch {
      throw new ServiceUnavailableException('Cash access configuration is invalid');
    }
  }

  require(user: Pick<CashPrincipal, 'sub'> | undefined, permission: CashPermission): CashLevel {
    if (!PERMISSIONS.includes(permission)) throw new ForbiddenException('Unknown cash permission');
    const grants = this.grants();
    const level = user && Object.prototype.hasOwnProperty.call(grants, user.sub) ? grants[user.sub] : undefined;
    if (!level || (['collectors.manage', 'clients.create', 'receipts.send', 'finance.manage', 'kyc.manage'].includes(permission) && level !== 'administrator')) {
      throw new ForbiddenException('Cash permission required');
    }
    return level;
  }

  scope(user: Pick<CashPrincipal, 'sub'>) {
    return this.require(user, 'records.read') === 'administrator' ? { cashUserId: { not: null } } : { cashUserId: user.sub };
  }
}
