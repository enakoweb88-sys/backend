import { leaveDates, leaveToday } from './leave-dates';
import { AdminService } from './admin.service';
import { LeaveLifecycleService } from './leave-lifecycle.service';

describe('dated employee leave', () => {
  const ceo = { sub: 'ceo', role: 'CEO', email: 'ceo@example.invalid' } as any;
  const dto = { employeeId: 'employee', type: 'Annual', startDate: '2026-11-10', endDate: '2026-11-12' };
  function fixture() {
    const saved = { id: 'leave', employeeId: 'employee', type: 'Annual', ...leaveDates(dto.startDate, dto.endDate), status: 'Approved' };
    const tx = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'employee', fullName: 'Fixture', status: 'ACTIVE' }) }, leaveRequest: { create: jest.fn().mockResolvedValue(saved), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ ...saved, status: 'Pending' }) }, auditLog: { create: jest.fn() } };
    const prisma = { ...tx, leaveRequest: { ...tx.leaveRequest, findMany: jest.fn().mockResolvedValue([saved]) }, $transaction: async (fn: any) => fn(tx) };
    const alerts = { enqueue: jest.fn() };
    return { saved, tx, prisma, alerts, service: new AdminService(prisma as any, alerts as any) };
  }
  it('calculates inclusive calendar days including leap days', () => {
    expect(leaveDates('2028-02-28', '2028-03-01').duration).toBe('3 days');
    expect(leaveDates('2026-11-10', '2026-11-10').duration).toBe('1 days');
  });
  it.each([['', '2026-11-10'], ['2026-02-30', '2026-03-03'], ['2026-11-12', '2026-11-10']])('rejects invalid dates %s %s', (a, b) => {
    expect(() => leaveDates(a, b)).toThrow();
  });
  it('uses Cameroon midnight rather than server midnight', () => {
    expect(leaveToday(new Date('2026-11-12T23:00:00Z')).toISOString()).toBe('2026-11-13T00:00:00.000Z');
  });
  it('assigns the selected account and queues an email and inbox notification containing both dates', async () => {
    const f = fixture(); await f.service.createLeave(dto, ceo);
    expect(f.tx.leaveRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ employeeId: 'employee', status: 'Approved' }) }));
    expect(f.alerts.enqueue).toHaveBeenCalledWith(f.tx, [expect.objectContaining({ userId: 'employee', body: expect.stringContaining('2026-11-10 to 2026-11-12') })]);
  });
  it('prevents employees assigning leave to others', async () => {
    const f = fixture(); await expect(f.service.createLeave(dto, { ...ceo, sub: 'other', role: 'EMPLOYEE' })).rejects.toThrow('Only the CEO');
    expect(f.tx.leaveRequest.create).not.toHaveBeenCalled();
  });
  it('keeps employee requests pending and scopes their history', async () => {
    const f = fixture(); f.tx.leaveRequest.create.mockResolvedValueOnce({ ...f.saved, status: 'Pending' });
    const employee = { ...ceo, sub: 'employee', role: 'EMPLOYEE' };
    await f.service.createLeave(dto, employee); expect(f.alerts.enqueue).not.toHaveBeenCalled();
    await f.service.listLeaves(employee);
    expect(f.prisma.leaveRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: 'employee' } }));
  });
  it('queues completion atomically and does not duplicate a claim won by another worker', async () => {
    const f = fixture(); const worker = new LeaveLifecycleService(f.prisma as any, f.alerts as any);
    await worker.finishDueLeaves(); expect(f.alerts.enqueue).toHaveBeenCalledTimes(1);
    expect(f.tx.leaveRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'Completed' }) }));
    f.tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
    await worker.finishDueLeaves(); expect(f.alerts.enqueue).toHaveBeenCalledTimes(1);
  });
  it('rejects repeated decisions without sending another notification', async () => {
    const f = fixture(); f.tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.reviewLeave('leave', 'Approved', ceo)).rejects.toThrow('already been reviewed');
    expect(f.alerts.enqueue).not.toHaveBeenCalled();
  });
});
