import { CommunicationsService } from './communications.service';

describe('persistent message read state', () => {
  function fixture() {
    const tx = { message: { findMany: jest.fn().mockResolvedValue([{ id: 'message', senderId: 'sender' }]) }, messageReadReceipt: { createMany: jest.fn() } };
    const prisma = { $transaction: async (fn: any) => fn(tx), message: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CommunicationsService(prisma as any);
    jest.spyOn(service, 'verifyChannelAccess').mockResolvedValue(true);
    jest.spyOn(service, 'getAvailableChannels').mockResolvedValue([{ name: 'general' }] as any);
    return { service, tx, prisma };
  }
  it('saves an idempotent receipt for the authenticated recipient', async () => {
    const f = fixture(); await f.service.markMessagesRead('recipient', 'general', ['message', 'message']);
    expect(f.tx.messageReadReceipt.createMany).toHaveBeenCalledWith({ data: [{ userId: 'recipient', messageId: 'message' }], skipDuplicates: true });
  });
  it('rejects inaccessible private conversations', async () => {
    const f = fixture(); jest.mocked(f.service.verifyChannelAccess).mockResolvedValue(false);
    await expect(f.service.markMessagesRead('outsider', 'dm:private', ['message'])).rejects.toThrow('Access denied');
    expect(f.tx.message.findMany).not.toHaveBeenCalled();
  });
  it('rejects messages injected from another channel', async () => {
    const f = fixture(); f.tx.message.findMany.mockResolvedValue([]);
    await expect(f.service.markMessagesRead('recipient', 'general', ['private-message'])).rejects.toThrow('selected channel');
    expect(f.tx.messageReadReceipt.createMany).not.toHaveBeenCalled();
  });
  it('limits read updates to explicitly supplied IDs', async () => {
    const f = fixture(); await expect(f.service.markMessagesRead('recipient', 'general', Array(201).fill('message'))).rejects.toThrow();
  });
  it('filters unread messages by allowed channels, current user and saved receipts', async () => {
    const f = fixture(); await f.service.unreadMessages('recipient');
    expect(f.prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { channel: { in: ['general'] }, senderId: { not: 'recipient' }, readReceipts: { none: { userId: 'recipient' } } } }));
  });
});
