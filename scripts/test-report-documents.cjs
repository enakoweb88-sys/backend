require('tsx/cjs');
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { ReportDocumentsService, previewMimeType, attachmentDisposition, reportDocumentMetadata, REPORT_FILE_LIMIT } = require('../src/modules/reports/report-documents.service.ts');
const { ReportsController } = require('../src/modules/reports/reports.controller.ts');
const user = { sub: 'engineer', role: 'EMPLOYEE' };
const file = (name, bytes = Buffer.from('%PDF-1.7\noriginal binary\0data'), mimetype = 'application/pdf') => ({ originalname: name, buffer: bytes, size: 999999999, mimetype });

function fixture(existing = null) {
  const documents = [], notifications = [], reports = existing ? [existing] : [];
  let sequence = 0;
  const metadata = document => Object.fromEntries(Object.keys(reportDocumentMetadata).map(key => [key, document[key]]));
  const result = report => ({ ...report, documents: documents.filter(document => document.reportId === report.id).map(metadata) });
  const prisma = {
    $executeRawUnsafe: async sql => { assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY')); assert.ok(sql.includes('FROM authenticated')); },
    dailyReport: {
      findFirst: async ({ where }) => { const found = reports.find(report => report.id === where.id && report.userId === where.userId); return found ? result(found) : null; },
      create: async ({ data }) => { const { documents: changes, ...values } = data; const report = { id: 'report', ...values }; reports.push(report); changes.create.forEach(document => documents.push({ id: `doc${++sequence}`, reportId: report.id, ...document })); return result(report); },
      update: async ({ where, data }) => { const report = reports.find(report => report.id === where.id); const { documents: changes, ...values } = data; for (let index = documents.length - 1; index >= 0; index--) if (documents[index].reportId === report.id && !changes.deleteMany.id.notIn.includes(documents[index].id)) documents.splice(index, 1); changes.create.forEach(document => documents.push({ id: `doc${++sequence}`, reportId: report.id, ...document })); Object.assign(report, values); return result(report); },
    },
    reportDocument: { findFirst: async ({ where }) => documents.find(document => document.id === where.id && document.reportId === where.reportId) || null },
  };
  prisma.$transaction = async callback => callback(prisma);
  const reportService = {
    notifyReviewers: async (_tx, report) => notifications.push(report.id),
    findDaily: async (id, caller) => { const report = reports.find(row => row.id === id && (row.userId === caller.sub || ['CEO', 'MANAGER'].includes(caller.role) && row.status !== 'DRAFT')); if (!report) throw new Error('Report not found'); return result(report); },
  };
  return { service: new ReportDocumentsService(prisma, reportService), documents, notifications, reports };
}

test('original binary and metadata are persisted together; report responses exclude bytes', async () => {
  const f = fixture();
  const uploaded = file('Engineering.pdf');
  const saved = await f.service.save({ title: 'Weekly work', type: 'WEEKLY', note: 'Release notes' }, [uploaded], user);
  assert.equal(saved.userId, user.sub); assert.equal(saved.documents.length, 1);
  assert.equal(saved.documents[0].sizeBytes, uploaded.buffer.length); // Ignore forged size metadata.
  assert.equal(saved.documents[0].data, undefined);
  assert.equal(f.documents[0].sha256, createHash('sha256').update(uploaded.buffer).digest('hex'));
  assert.equal(f.notifications.length, 1);
  const downloaded = await f.service.read(saved.id, saved.documents[0].id, { sub: 'boss', role: 'MANAGER' });
  assert.deepEqual(downloaded.data, uploaded.buffer);
});
test('Word, spreadsheets, archives and arbitrary binary formats are accepted without changing original bytes', async () => {
  const f = fixture();
  const files = ['Report.docx', 'Results.xlsx', 'Slides.pptx', 'Evidence.zip', 'Custom.xyz'].map((name, index) => file(name, Buffer.from([0, 255, 5, index]), 'application/octet-stream'));
  const report = await f.service.save({ title: 'Documents' }, files, user);
  assert.equal(report.documents.length, 5);
  for (let index = 0; index < files.length; index++) assert.deepEqual(f.documents[index].data, files[index].buffer);
});
test('draft files are private to the author, and other employees cannot download submitted files', async () => {
  const f = fixture();
  const report = await f.service.save({ title: 'Draft', status: 'DRAFT' }, [file('draft.pdf')], user);
  assert.equal(f.notifications.length, 0);
  await assert.rejects(() => f.service.read(report.id, report.documents[0].id, { sub: 'boss', role: 'CEO' }), /not found/);
  await f.service.save({ title: 'Final', status: 'SUBMITTED' }, [], user, report.id);
  await assert.rejects(() => f.service.read(report.id, report.documents[0].id, { sub: 'other', role: 'EMPLOYEE' }), /not found/);
  assert.ok((await f.service.read(report.id, report.documents[0].id, { sub: 'boss', role: 'CEO' })).data);
});
test('revisions replace selected files and keep ownership and review state consistent', async () => {
  const f = fixture();
  const report = await f.service.save({ title: 'Initial', status: 'DRAFT' }, [file('old.pdf')], user);
  const revised = await f.service.save({ title: 'Corrected', status: 'SUBMITTED', retainedDocumentIds: '[]' }, [file('new.docx')], user, report.id);
  assert.equal(revised.id, report.id); assert.equal(revised.documents.length, 1); assert.equal(revised.documents[0].originalName, 'new.docx');
  await assert.rejects(() => f.service.save({ title: 'Forged', retainedDocumentIds: '["someone-else-document"]' }, [], user, report.id), /does not belong/);
  await assert.rejects(() => f.service.save({ title: 'Forged' }, [file('other.pdf')], { sub: 'other', role: 'EMPLOYEE' }, report.id), /not found/);
});
test('files cannot be selected from a different report, and corrupted stored content is rejected', async () => {
  const f = fixture();
  const one = await f.service.save({ title: 'One' }, [file('one.pdf')], user);
  const secondUser = { sub: 'another', role: 'EMPLOYEE' };
  // A mismatched report ID fails access before looking up any binary.
  await assert.rejects(() => f.service.read('missing', one.documents[0].id, secondUser), /not found/);
  f.documents[0].data = Buffer.from('corrupted');
  await assert.rejects(() => f.service.read(one.id, one.documents[0].id, user), /could not be verified/);
});
test('server enforces attachment count, size, title and retained-document validation', async () => {
  const f = fixture();
  await assert.rejects(() => f.service.save({ title: 'Empty' }, [], user), /between 1 and 5/);
  await assert.rejects(() => f.service.save({ title: 'Too many' }, Array.from({ length: 6 }, () => file('a.pdf')), user), /up to 5/);
  await assert.rejects(() => f.service.save({ title: 'Too large' }, [file('a.pdf', Buffer.alloc(REPORT_FILE_LIMIT + 1))], user), /20 MB/);
  await assert.rejects(() => f.service.save({ title: 'Empty file' }, [file('a.pdf', Buffer.alloc(0))], user), /non-empty/);
  await assert.rejects(() => f.service.save({ title: '' }, [file('a.pdf')], user), /title/);
  await assert.rejects(() => f.service.save({ title: 'Invalid', retainedDocumentIds: '{}' }, [file('a.pdf')], user), /Invalid/);
});
test('untrusted MIME and HTML do not become browser-executable previews', () => {
  assert.equal(previewMimeType('fake.pdf', Buffer.from('<script>alert(1)</script>')), 'application/octet-stream');
  assert.equal(previewMimeType('page.html', Buffer.from('<script>alert(1)</script>')), 'application/octet-stream');
  assert.equal(previewMimeType('real.pdf', Buffer.from('%PDF-1.7\n')), 'application/pdf');
  assert.equal(previewMimeType('notes.txt', Buffer.from('Plain text')), 'text/plain;charset=utf-8');
  assert.equal(previewMimeType('image.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])), 'image/png');
  assert.ok(!attachmentDisposition('bad\r\nname".pdf').includes('\r'));
});
test('download controller returns original bytes with private authenticated response headers', async () => {
  const f = fixture();
  const saved = await f.service.save({ title: 'PDF' }, [file('Original.pdf')], user);
  const controller = new ReportsController(null, f.service);
  const headers = {}; let bytes;
  const response = { setHeader: (name, value) => { headers[name] = value; }, send: value => { bytes = value; } };
  await controller.file(saved.id, saved.documents[0].id, undefined, user, response);
  assert.deepEqual(bytes, f.documents[0].data); assert.equal(headers['Content-Type'], 'application/octet-stream');
  assert.equal(headers['Cache-Control'], 'private, no-store'); assert.ok(headers['Content-Disposition'].includes('Original.pdf'));
  await controller.file(saved.id, saved.documents[0].id, '1', user, response);
  assert.equal(headers['Content-Type'], 'application/pdf');
});
test('startup applies row-level security for document binary storage', async () => {
  await fixture().service.onModuleInit();
});
