import { CashAuthService } from './cash-auth.service';
import * as bcrypt from 'bcryptjs';

describe('Cash identifiers behind verified email gateway', () => {
  const password = 'Synthetic-fixture-password';
  const account = { id: 'cash-only-fixture', email: 'collector@example.invalid', phone: '+237 699 123 456', terminalId: 'TRM-TEST', fullName: 'Fixture', branch: 'Fixture', passwordChangedAt: new Date(0), passwordHash: bcrypt.hashSync(password, 4) };
  function fixture() {
    const tx = { cashSession: { create: jest.fn() }, cashAuditLog: { create: jest.fn() } };
    const prisma = { cashUser: { findMany: async () => [account] }, cashAuditLog: { create: jest.fn() }, $transaction: async (callback: any) => callback(tx) };
    const config = { get: (key: string) => key === 'CASH_JWT_SECRET' ? 'synthetic-cash-secret-32-characters-long' : undefined };
    const auth = new CashAuthService(prisma as any, config as any, { signAsync: async () => 'synthetic-token' } as any, { grants: () => ({ [account.id]: 'operator' }), require: () => 'operator' } as any);
    return { auth, tx };
  }
  it.each(['collector@example.invalid', '+237699123456', '237 699 123 456', 'TRM-TEST'])('accepts %s when Cloudflare verifies the account email', async identifier => {
    const { auth } = fixture();
    await expect(auth.login(identifier, password, account.email)).resolves.toMatchObject({ user: { id: account.id } });
  });
  it('rejects a different verified gateway identity even with the correct phone and password', async () => {
    const { auth, tx } = fixture();
    await expect(auth.login(account.phone, password, 'someone-else@example.invalid')).rejects.toThrow('identities must match');
    expect(tx.cashSession.create).not.toHaveBeenCalled();
  });
  it('still requires the account password', async () => {
    const { auth, tx } = fixture();
    await expect(auth.login(account.terminalId, 'incorrect', account.email)).rejects.toThrow('Invalid cash credentials');
    expect(tx.cashSession.create).not.toHaveBeenCalled();
  });
});
