import { secureDatabaseUrl } from './database-connection';

describe('database transport configuration', () => {
  it('requires authenticated TLS for Supabase even when the input disables verification', () => {
    const url = new URL(secureDatabaseUrl('postgresql://fixture@fixture.pooler.supabase.com:6543/postgres?sslmode=disable&sslaccept=accept_invalid_certs&pgbouncer=true')!);
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('sslaccept')).toBe('strict');
    expect(url.searchParams.get('sslcert')).toMatch(/supabase-ca\.crt$/);
    expect(url.searchParams.get('pgbouncer')).toBe('true');
  });

  it('keeps isolated loopback fixtures unchanged', () => {
    const url = 'postgresql://fixture:synthetic@127.0.0.1:5432/postgres';
    expect(secureDatabaseUrl(url)).toBe(url);
  });

  it('does not interpret lookalike hosts as Supabase', () => {
    const url = new URL(secureDatabaseUrl('postgresql://fixture@supabase.com.attacker.invalid/postgres')!);
    expect(url.searchParams.has('sslcert')).toBe(false);
  });

  it('does not echo malformed connection input in its error', () => {
    expect(() => secureDatabaseUrl('private-invalid-value')).toThrow('Invalid database connection configuration');
    expect(secureDatabaseUrl(undefined)).toBeUndefined();
  });
});
