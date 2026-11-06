import { existsSync } from 'fs';
import { resolve } from 'path';

export function secureDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid database connection configuration'); }
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.com')) {
    const certificate = resolve(__dirname, '../../config/supabase-ca.crt');
    if (!existsSync(certificate)) throw new Error('Database trust certificate is missing');
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
    url.searchParams.delete('sslrootcert');
    url.searchParams.set('sslcert', certificate);
  }
  return url.toString();
}
