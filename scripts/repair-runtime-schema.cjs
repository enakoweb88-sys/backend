require('tsx/cjs');
const { PrismaClient } = require('@prisma/client');
const { ensureRuntimeSchema } = require('../src/modules/prisma/runtime-schema.ts');
const prisma = new PrismaClient();
ensureRuntimeSchema(prisma).then(() => console.log('Required schema upgrades applied with access protection; existing application records preserved.'))
  .catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
