/** Reviewed OS identity binding. Never derive gateway aliases from editable profile fields. */
export function matchesOsGatewayIdentity(user: { id?: string; sub?: string; email: string; role: string | { name: string } }, gatewayEmail: string): boolean {
  const email = user.email.trim().toLowerCase();
  const gateway = gatewayEmail.trim().toLowerCase();
  if (email === gateway) return true;
  return (user.sub || user.id) === 'cmq7v1wl0000byij7abgqap5i'
    && email === 'ceo@enako.com'
    && (typeof user.role === 'string' ? user.role : user.role.name) === 'CEO'
    && gateway === 'enakocompanyltd@gmail.com';
}
