require('tsx/cjs'); require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CashCollectionsService } = require('../src/modules/cash-collections/cash-collections.service.ts');
test('an unavailable collection database never returns a successful empty snapshot', async () => {
  const unavailable = new Error('Database unavailable');
  const service = new CashCollectionsService({ cashCollection: { findMany: async () => { throw unavailable; }, count: async () => 0 } }, {});
  await assert.rejects(() => service.list({}), error => error === unavailable);
});
test('a genuinely empty collection ledger remains a successful empty snapshot', async () => {
  const service = new CashCollectionsService({ cashCollection: { findMany: async () => [], count: async () => 0 } }, {});
  const result = await service.list({});
  assert.equal(result.total, 0); assert.deepEqual(result.items, []);
});
