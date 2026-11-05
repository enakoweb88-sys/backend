import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function duration(value: string, max: number) {
  const match = /^([1-9][0-9]*)(s|m|h)?$/.exec(value);
  if (!match) throw new ServiceUnavailableException('Invalid authentication duration configuration');
  const seconds = Number(match[1]) * (match[2] === 'h' ? 3600 : match[2] === 'm' ? 60 : 1);
  if (seconds > max) throw new ServiceUnavailableException('Authentication duration exceeds security policy');
  return seconds;
}

export function jwtSettings(config: ConfigService) {
  const access = config.get<string>('JWT_ACCESS_SECRET'), refresh = config.get<string>('JWT_REFRESH_SECRET');
  const issuer = config.get<string>('JWT_ISSUER'), audience = config.get<string>('JWT_AUDIENCE');
  if (!access || !refresh || Buffer.byteLength(access) < 32 || Buffer.byteLength(refresh) < 32 || access === refresh || !issuer || !audience || issuer.length > 512 || audience.length > 256) throw new ServiceUnavailableException('Mandatory JWT security configuration is missing or invalid');
  return { access, refresh, issuer, audience, accessSeconds: duration(config.get<string>('JWT_ACCESS_TTL') || '5m', 900), refreshSeconds: duration(config.get<string>('JWT_REFRESH_TTL') || '2h', 86400) };
}
