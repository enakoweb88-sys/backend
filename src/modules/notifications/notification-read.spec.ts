import { NotificationsService } from './notifications.service';

describe('notification read persistence', () => {
  it('keeps the original read timestamp and scopes repeated reads to the owner', async () => {
    const readAt = new Date('2026-11-01');
    const prisma = { notification: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'alert', userId: 'owner', readAt }) } };
    const service = new NotificationsService(prisma as any, {} as any);
    expect((await service.markRead('alert', 'owner')).readAt).toEqual(readAt);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'alert', userId: 'owner', readAt: null }, data: { readAt: expect.any(Date) } });
  });
  it('does not confirm reads for somebody else\'s notification', async () => {
    const prisma = { notification: { updateMany: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new NotificationsService(prisma as any, {} as any).markRead('alert', 'outsider')).rejects.toThrow('Notification not found');
  });
});
