import { matchesOsGatewayIdentity } from './os-gateway-identity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../modules/auth/auth.service';
import { CommunicationsGateway } from '../modules/communications/communications.gateway';

const ceo = { sub: 'cmq7v1wl0000byij7abgqap5i', email: 'ceo@enako.com', role: 'CEO' };
const gateway = 'enakocompanyltd@gmail.com';

describe('OS gateway identity binding', () => {
  it('accepts the reviewed CEO alias and normal matching identities', () => {
    expect(matchesOsGatewayIdentity(ceo, gateway)).toBe(true);
    expect(matchesOsGatewayIdentity({ ...ceo, sub: undefined, id: ceo.sub, role: { name: 'CEO' } }, gateway)).toBe(true);
    expect(matchesOsGatewayIdentity({ sub: 'employee', email: 'employee@example.com', role: 'ENGINEER' }, 'EMPLOYEE@example.com')).toBe(true);
  });
  it.each([
    { ...ceo, sub: 'another-account' },
    { ...ceo, email: 'different@example.com' },
    { ...ceo, role: 'ENGINEER' },
    { ...ceo, sub: 'employee', personalEmail: gateway },
  ])('rejects aliases for any different account identity: %j', user => {
    expect(matchesOsGatewayIdentity(user, gateway)).toBe(false);
  });
  it('rejects any other gateway email', () => {
    expect(matchesOsGatewayIdentity(ceo, 'other@example.com')).toBe(false);
  });
  it('permits the verified CEO alias through the HTTP guard and rejects other identities', async () => {
    const guard = new JwtAuthGuard({ validateAccessToken: jest.fn().mockResolvedValue(ceo) } as unknown as AuthService);
    const request = { headers: { authorization: 'Bearer token' }, gatewayIdentity: { email: gateway } };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    request.gatewayIdentity.email = 'other@example.com';
    await expect(guard.canActivate(context)).rejects.toThrow('Gateway identity');
  });
  it('uses the same binding for chat and still enforces gateway expiry', async () => {
    const instance = new CommunicationsGateway({} as any, { validateAccessToken: async () => ceo } as any, {} as any, {} as any, {} as any);
    const socket = { data: { token: 'token', gateway: { email: gateway, expiresAt: Date.now() + 60000 } } };
    await expect((instance as any).principal(socket)).resolves.toEqual(ceo);
    socket.data.gateway.expiresAt = 0;
    await expect((instance as any).principal(socket)).rejects.toThrow('Gateway session expired');
  });
});
