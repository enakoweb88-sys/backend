import { matchesCashGatewayIdentity } from './cash-gateway-identity';

describe('independent Cash gateway alias', () => {
  const owner = { id: '851e4941-f32e-4aa5-8fcc-43c8414c7fad', email: 'ceo@enako.com' };
  it('accepts the specifically provisioned Cash account', () => {
    expect(matchesCashGatewayIdentity(owner, 'enakocompanyltd@gmail.com')).toBe(true);
    expect(matchesCashGatewayIdentity({ sub: owner.id, email: owner.email }, 'enakocompanyltd@gmail.com')).toBe(true);
  });
  it('rejects the OS account and all other Cash accounts using the alias', () => {
    for (const id of ['cmq7v1wl0000byij7abgqap5i', 'another-cash-account']) {
      expect(matchesCashGatewayIdentity({ ...owner, id }, 'enakocompanyltd@gmail.com')).toBe(false);
    }
  });
  it('rejects changed canonical emails and unrelated gateway emails', () => {
    expect(matchesCashGatewayIdentity({ ...owner, email: 'other@example.invalid' }, 'enakocompanyltd@gmail.com')).toBe(false);
    expect(matchesCashGatewayIdentity(owner, 'other@example.invalid')).toBe(false);
  });
  it('retains normal same-email login', () => {
    expect(matchesCashGatewayIdentity({ id: 'collector', email: 'collector@example.invalid' }, 'COLLECTOR@example.invalid')).toBe(true);
  });
});
