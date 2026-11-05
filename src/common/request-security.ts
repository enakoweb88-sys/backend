import { ConfigService } from '@nestjs/config';
import { isIP } from 'net';

export function trustedProxies(config: ConfigService): string[] | false {
  const values = (config.get<string>('TRUSTED_PROXY_CIDRS') || '').split(',').map(v => v.trim()).filter(Boolean);
  for (const value of values) {
    const [ip, prefix] = value.split('/');
    const version = isIP(ip), max = version === 4 ? 32 : 128;
    if (!version || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > max))) throw new Error('TRUSTED_PROXY_CIDRS must contain explicit trusted addresses/CIDRs, never a wildcard or hop count');
  }
  return values.length ? values : false;
}
export function corsAllowlist(config: ConfigService) {
  const origins = (config.get<string>('CORS_ORIGIN') || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!origins.length) throw new Error('CORS_ORIGIN must explicitly list the approved frontend origins');
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin || url.username || url.password || (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Invalid CORS origin');
  }
  return origins;
}
