/** Cash-only approved identity binding; never inferred from OS users or roles. */
export function matchesCashGatewayIdentity(user: { id?: string; sub?: string; email: string }, gatewayEmail: string): boolean {
  const email = user.email.trim().toLowerCase();
  const gateway = gatewayEmail.trim().toLowerCase();
  return email === gateway || ((user.sub || user.id) === '851e4941-f32e-4aa5-8fcc-43c8414c7fad'
    && email === 'ceo@enako.com' && gateway === 'enakocompanyltd@gmail.com');
}
