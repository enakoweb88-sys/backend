require('tsx/cjs');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CommunicationsService } = require('../src/modules/communications/communications.service.ts');
const { CommunicationsController } = require('../src/modules/communications/communications.controller.ts');
const { CommunicationsGateway } = require('../src/modules/communications/communications.gateway.ts');
const { privateChannelName } = require('../src/modules/communications/private-chat.ts');

test('private conversations are stable pairs and membership cannot be expanded', async () => {
  const channel = privateChannelName('ceo', 'engineer');
  assert.equal(channel, privateChannelName('engineer', 'ceo'));
  assert.notEqual(channel, privateChannelName('ceo', 'another'));
  const prisma = {
    user: { findFirst: async () => ({ id: 'engineer' }) },
    channel: { upsert: async input => input.create, findUnique: async ({ include }) => ({ isGeneral: false, members: include?.members.where.userId === 'engineer' ? [{}] : [] }) },
  };
  prisma.$transaction = callback => callback(prisma);
  const service = new CommunicationsService(prisma);
  const created = await service.startPrivateConversation('ceo', 'engineer');
  assert.equal(created.isGeneral, false);
  assert.deepEqual(created.members.create.map(member => member.userId), ['ceo', 'engineer']);
  assert.equal(await service.verifyChannelAccess(channel, 'engineer'), true);
  assert.equal(await service.verifyChannelAccess(channel, 'manager'), false);
  await assert.rejects(() => service.addMember(channel, 'manager'), /cannot change/);
  await assert.rejects(() => service.removeMember(channel, 'engineer'), /cannot change/);
  await assert.rejects(() => service.createChannel(channel), /direct chat/);
});

test('management directory cannot list unrelated private conversations', async () => {
  const records = [{ name: 'general', members: [] }, { name: 'dm:own', members: [{ userId: 'ceo' }] }, { name: 'dm:others', members: [{ userId: 'someone' }] }];
  const prisma = { user: { findUnique: async () => ({ status: 'ACTIVE', role: { name: 'CEO' } }) }, channel: { findMany: async () => records, findUnique: async ({ where, include }) => { const row = records.find(r => r.name === where.name); return row ? { ...row, isGeneral: row.name === 'general', members: row.members.filter(m => m.userId === include.members.where.userId) } : null; } } };
  assert.deepEqual((await new CommunicationsService(prisma).getAvailableChannels('ceo')).map(item => item.name), ['general', 'dm:own']);
});

test('private REST replies notify only the other participant and never broadcast', async () => {
  const messages = [], alerts = [], broadcasts = [];
  const prisma = {
    message: { create: async ({ data }) => { messages.push(data); return data; } },
    channelMember: { findMany: async ({ where }) => { assert.equal(where.userId.not, 'engineer'); return [{ userId: 'ceo' }]; } },
  };
  prisma.$transaction = callback => callback(prisma);
  const gateway = { server: { to: () => ({ emit: (...args) => broadcasts.push(args) }) } };
  const controller = new CommunicationsController(prisma, gateway, { verifyChannelAccess: async (_, user) => user === 'engineer' }, { enqueue: async (_, data) => alerts.push(...data) });
  await controller.create({ channel: 'dm:pair', content: 'Thank you, I will follow up' }, { sub: 'engineer' });
  assert.equal(messages[0].senderId, 'engineer');
  assert.equal(alerts.length, 1); assert.equal(alerts[0].userId, 'ceo');
  assert.equal(broadcasts.length, 0);
  await assert.rejects(() => controller.create({ channel: 'dm:pair', content: 'Unrelated viewer' }, { sub: 'manager' }), /access/);
  await assert.rejects(() => controller.list('dm:pair', undefined, { sub: 'manager' }), /access/);
  assert.equal(messages.length, 1);
});

test('unauthenticated websocket clients cannot join or write private conversations', async () => {
  const joins = [], writes = [];
  const gateway = new CommunicationsGateway({ message: { create: async data => writes.push(data) } });
  const socket = { data: {}, rooms: new Set(), join: value => joins.push(value), emit: () => {}, disconnect: () => {} };
  assert.ok((await gateway.handleJoin('dm:pair', socket)).error);
  assert.ok((await gateway.handleMessage({ channel: 'dm:pair', senderId: 'ceo', content: 'Forged' }, socket)).error);
  assert.equal(joins.length, 0); assert.equal(writes.length, 0);
});
