import { MealsService } from './meals.service';

describe('catering providers and fixed meal costs', () => {
  const actor = { sub: 'manager', email: 'manager@example.invalid', role: 'MANAGER' } as any;
  const dto = { employeeId: 'employee', date: '2026-11-10', status: 'ATE', vendor: ' Mami   Joy ', mealName: ' Eru ', price: 1, companyAmount: 999 } as any;
  function fixture() {
    const tx = { mealRecord: { create: jest.fn().mockImplementation(async ({ data }) => data) } };
    const prisma = { $transaction: async (fn: any) => fn(tx), mealRecord: { findMany: jest.fn().mockResolvedValue([{ vendor: 'mami chop' }, { vendor: ' Mami   Chop ' }, { vendor: 'Mami Joy' }, { vendor: 'Other' }]) } };
    return { service: new MealsService(prisma as any), tx, prisma };
  }
  it('lists reusable provider names without exposing employee meal records', async () => {
    const f = fixture(); const names = await f.service.providers();
    expect(names).toHaveLength(2); expect(names).toContain('Mami Joy');
    expect(f.prisma.mealRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { vendor: true }, distinct: ['vendor'] }));
  });
  it('normalizes food and provider names and ignores client supplied pricing', async () => {
    const f = fixture(); const saved = await f.service.record(dto, actor);
    expect(saved).toMatchObject({ vendor: 'Mami Joy', mealName: 'Eru', totalAmount: 1000, companyAmount: 500, employeeAmount: 500 });
  });
  it.each([' ', 'Other', 'x'.repeat(101)])('rejects invalid provider %s', async vendor => {
    const f = fixture(); await expect(f.service.record({ ...dto, vendor }, actor)).rejects.toThrow('provider');
    expect(f.tx.mealRecord.create).not.toHaveBeenCalled();
  });
  it('rejects blank custom food and preserves zero charges for skipped meals', async () => {
    const f = fixture(); await expect(f.service.record({ ...dto, mealName: ' ' }, actor)).rejects.toThrow('food');
    const saved = await f.service.record({ ...dto, status: 'DID_NOT_EAT', vendor: undefined, mealName: undefined }, actor);
    expect(saved).toMatchObject({ vendor: null, totalAmount: 0, companyAmount: 0, employeeAmount: 0 });
  });
});
