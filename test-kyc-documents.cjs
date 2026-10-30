const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, 'src/modules/kyc/kyc.controller.ts');
let downloadPath;
let downloadError = null;
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === '@supabase/supabase-js') return {
    createClient: (url) => {
      assert.equal(url, 'https://current-project.supabase.co');
      return { storage: { from: (bucket) => {
        assert.equal(bucket, 'kyc-documents');
        return { download: async (objectPath) => {
          downloadPath = objectPath;
          return { data: new Blob(['%PDF-test'], { type: 'application/pdf' }), error: downloadError };
        } };
      } } };
    },
  };
  if (request.startsWith('../../common/')) return {
    Roles: () => () => {}, CurrentUser: () => () => {},
    JwtAuthGuard: class {}, RolesGuard: class {},
  };
  if (request === './kyc.service') return { KycService: class {} };
  return originalLoad.call(this, request, ...args);
};
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
try {
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true },
  }).outputText, filename);
} finally {
  Module._load = originalLoad;
}
const { KycController } = compiled.exports;
const document = {
  fileUrl: 'https://unavailable-project.supabase.co/storage/v1/object/public/kyc-documents/folder/report%20one.pdf',
  fileName: 'report one.pdf', mimeType: 'application/pdf',
};
function setup(value = document) {
  const controller = new KycController({ findDocument: async (submissionId, id) => {
    assert.equal(submissionId, 'submission');
    assert.equal(id, 'document');
    return value;
  } }, { get: (key) => ({ SUPABASE_URL: 'https://current-project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' })[key] });
  const headers = {};
  const response = { setHeader: (key, value) => { headers[key] = value; }, send: (bytes) => { response.bytes = bytes; } };
  return { controller, response, headers, run: () => controller.documentFile('submission', 'document', response) };
}
test('legacy links retrieve the object from configured storage and return bytes', async () => {
  const context = setup();
  await context.run();
  assert.equal(downloadPath, 'folder/report one.pdf');
  assert.equal(context.response.bytes.toString(), '%PDF-test');
  assert.equal(context.headers['Cache-Control'], 'private, no-store');
  assert.match(context.headers['Content-Disposition'], /report%20one.pdf/);
});
test('missing document returns 404', async () => {
  await assert.rejects(setup(null).run(), error => error.getStatus() === 404);
});
test('arbitrary URLs and local traversal paths are rejected', async () => {
  for (const fileUrl of ['https://example.com/private', '/uploads/../../secret']) {
    await assert.rejects(setup({ ...document, fileUrl }).run(), error => error.getStatus() === 404);
  }
});
test('storage failure returns an actionable error', async () => {
  downloadError = new Error('Object missing');
  try {
    await assert.rejects(setup().run(), error => error.getStatus() === 503 && /new upload/.test(error.message));
  } finally {
    downloadError = null;
  }
});
test('document endpoint retains authentication and role guards', () => {
  const handler = KycController.prototype.documentFile;
  const guards = Reflect.getMetadata('__guards__', handler);
  assert.equal(guards.length, 2);
});
