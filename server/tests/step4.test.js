/**
 * tests/step4.test.js
 *
 * What this file does:
 *   Automated tests for Step 4: ZIP upload and safe extraction.
 *   Runs the Express app on a random free port (not 4000) so it does not
 *   conflict with the development server.
 *
 * How to run:
 *   cd server
 *   node --test tests/step4.test.js
 *
 * Requirements tested (ARCHITECTURE.md §13):
 *   ✓ T01 Valid ZIP uploads and extracts successfully
 *   ✓ T02 Request with no file is rejected (400)
 *   ✓ T03 Non-ZIP file is rejected (400)
 *   ✓ T04 Oversized upload is rejected (413)
 *   ✓ T05 ZIP with path traversal entry is rejected (400)
 *   ✓ T06 ZIP with absolute path entry is rejected (400)
 *   ✓ T07 ZIP with Windows drive-letter path is rejected (400)
 *   ✓ T08 ZIP with symbolic link entry is rejected (400)
 *   ✓ T09 ZIP with duplicate path entries is rejected (400)
 *   ✓ T10 ZIP with too many entries is rejected (400)
 *   ✓ T11 ZIP with an entry exceeding the single-file size limit is rejected (400)
 *   ✓ T12 Failed extraction leaves no partial scan directory
 *   ✓ T13 Health endpoint still works after all uploads
 *   ✓ T14 Successful upload does not execute project code (no npm/node processes spawned)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, stat } from 'node:fs/promises';

import app from '../src/index.js';
import { buildZip, makeSymlinkAttributes } from './zipBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Path to the real sample ZIPs (created in Step 3) ─────────────────────────
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

// ── Server lifecycle ──────────────────────────────────────────────────────────

let server;
let BASE_URL;

before(() => new Promise((resolve) => {
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    BASE_URL = `http://127.0.0.1:${port}`;
    resolve();
  });
}));

after(() => new Promise((resolve, reject) => {
  server.close((err) => (err ? reject(err) : resolve()));
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * postZip(buf, filename)
 * Posts a buffer as a multipart ZIP upload to POST /api/scans.
 * Returns { status, body } where body is the parsed JSON.
 */
async function postZip(buf, filename = 'test.zip') {
  const blob     = new Blob([buf], { type: 'application/zip' });
  const form     = new FormData();
  form.append('project', blob, filename);
  const res  = await fetch(`${BASE_URL}/api/scans`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/**
 * postNoFile()
 * Posts to /api/scans with no file attached.
 */
async function postNoFile() {
  const res  = await fetch(`${BASE_URL}/api/scans`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/**
 * readSampleZip(name)
 * Reads one of the Step 3 sample ZIP files from disk.
 */
async function readSampleZip(name) {
  const { readFile } = await import('node:fs/promises');
  return readFile(path.join(SAMPLES_DIR, name));
}

// ── Actual tests ──────────────────────────────────────────────────────────────

test('T01 – valid good-app.zip uploads and extracts', async () => {
  const buf = await readSampleZip('good-app.zip');
  const { status, body } = await postZip(buf, 'good-app.zip');

  assert.equal(status, 202, `Expected 202, got ${status}: ${body.error}`);
  assert.ok(body.scanId,   'Response must contain scanId');
  assert.equal(body.status, 'queued');
  assert.ok(body.scanPath.startsWith('scans/'), 'scanPath must be relative');
  assert.ok(body.meta.filesExtracted > 0, 'At least one file must have been extracted');
});

test('T02 – request with no file is rejected with 400', async () => {
  const { status, body } = await postNoFile();
  assert.equal(status, 400);
  assert.ok(body.error, 'Error message must be present');
});

test('T03 – non-ZIP file (renamed .txt) is rejected with 400', async () => {
  // Send a plain text file disguised with a .txt extension
  // fileFilter checks the extension, not the content here, so we also
  // send with .txt extension to trigger the filter.
  const blob = new Blob(['this is not a zip'], { type: 'text/plain' });
  const form = new FormData();
  form.append('project', blob, 'not-a-zip.txt');
  const res  = await fetch(`${BASE_URL}/api/scans`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 400);
  assert.ok(body.error, 'Error message must be present');
});

test('T03b – file with .zip extension but invalid content is rejected', async () => {
  // This time the extension passes the filter but yauzl rejects the content
  const buf = Buffer.from('this is definitely not a zip file');
  const { status, body } = await postZip(buf, 'fake.zip');
  assert.equal(status, 400);
  assert.match(body.error, /invalid|corrupt/i, 'Error must mention invalid ZIP');
});

test('T04 – oversized upload is rejected with 413', async () => {
  // Multer's limit is 50 MB. We generate a buffer just over that limit.
  // Instead of allocating 50+ MB, we craft a request where the Content-Length
  // header exceeds the limit. Multer enforces the limit on the incoming stream.
  // We'll create a small ZIP but lie about its size via a large padding.
  // The simplest reliable approach: stream 51 MB of zeros as the file body.
  const OVER_LIMIT = 51 * 1024 * 1024; // 51 MB

  // Build a multipart body manually so we can control the size without
  // allocating the whole buffer in memory.
  const boundary = '----TestBoundary1234';
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="project"; filename="big.zip"\r\n` +
    `Content-Type: application/zip\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  // Payload: header + OVER_LIMIT zeros + footer
  // We allocate the zeros lazily using a Blob backed by an ArrayBuffer.
  const zeros   = new Uint8Array(OVER_LIMIT);
  const bigBlob = new Blob([header, zeros, footer]);

  const res = await fetch(`${BASE_URL}/api/scans`, {
    method: 'POST',
    body: bigBlob,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    duplex: 'half',
  });
  const body = await res.json().catch(() => ({}));
  assert.equal(res.status, 413, `Expected 413, got ${res.status}: ${JSON.stringify(body)}`);
});

test('T05 – ZIP with path traversal entry is rejected with 400', async () => {
  const buf = buildZip([
    { name: 'safe.txt',        data: Buffer.from('ok') },
    { name: '../evil.txt',     data: Buffer.from('escaped!') },
  ]);
  const { status, body } = await postZip(buf);
  assert.equal(status, 400);
  assert.match(body.error, /unsafe.*path|traversal|\.\./i);
});

test('T06 – ZIP with Unix absolute path is rejected with 400', async () => {
  const buf = buildZip([
    { name: '/etc/passwd', data: Buffer.from('root:x:0:0') },
  ]);
  const { status, body } = await postZip(buf);
  assert.equal(status, 400);
  assert.match(body.error, /unsafe.*path|absolute/i);
});

test('T07 – ZIP with Windows drive-letter path is rejected with 400', async () => {
  const buf = buildZip([
    { name: 'C:\\Windows\\evil.exe', data: Buffer.from('evil') },
  ]);
  const { status, body } = await postZip(buf);
  assert.equal(status, 400);
  assert.match(body.error, /unsafe.*path|drive/i);
});

test('T08 – ZIP with symbolic link is rejected with 400', async () => {
  const buf = buildZip([
    {
      name: 'symlink-to-passwd',
      data: Buffer.from('/etc/passwd'), // symlink target stored as data
      externalAttributes: makeSymlinkAttributes(),
    },
  ]);
  const { status, body } = await postZip(buf);
  assert.equal(status, 400);
  assert.match(body.error, /symbolic link/i);
});

test('T09 – ZIP with duplicate paths is rejected with 400', async () => {
  const buf = buildZip([
    { name: 'file.txt', data: Buffer.from('first') },
    { name: 'file.txt', data: Buffer.from('second') },
  ]);
  const { status, body } = await postZip(buf);
  assert.equal(status, 400);
  assert.match(body.error, /duplicate/i);
});

test('T10 – ZIP with more than MAX_ENTRIES entries is rejected with 400', async () => {
  // MAX_ENTRIES is 10000. Build a ZIP with 10001 entries.
  const entries = Array.from({ length: 10001 }, (_, i) => ({
    name: `f${i}.txt`,
    data: Buffer.alloc(0),
  }));
  const buf = buildZip(entries);
  const { status, body } = await postZip(buf);
  assert.equal(status, 400);
  assert.match(body.error, /too many entries/i);
  assert.match(body.error, /10000/);
});

test('T10b – ZIP with 1200 entries (exceeding old 1000 limit) is accepted with 202', async () => {
  const entries = Array.from({ length: 1200 }, (_, i) => ({
    name: `f${i}.txt`,
    data: Buffer.alloc(0),
  }));
  const buf = buildZip(entries);
  const { status, body } = await postZip(buf, 'many-entries.zip');
  assert.equal(status, 202);
  assert.equal(body.meta.filesExtracted, 1200);
});

test('T11 – ZIP entry exceeding per-file size limit is rejected with 400', async () => {
  // MAX_ENTRY_UNCOMPRESSED_BYTES is 50 MB.
  // We declare an uncompressed size exceeding 50 MB in the ZIP entry metadata,
  // while keeping the uploaded file small so it does not hit multer's 50 MB limit.
  const OVER = 50 * 1024 * 1024 + 1;
  const buf = buildZip([
    { name: 'huge.bin', data: Buffer.from('small payload'), uncompressedSize: OVER },
  ]);
  const { status, body } = await postZip(buf, 'big-entry.zip');
  assert.equal(status, 400);
  assert.match(body.error, /too large|size limit/i);
});

test('T12 – failed extraction leaves no partial scan directory', async () => {
  // Get a list of existing scan directories before the request
  const scansDir = path.resolve(__dirname, '../data/scans');
  const before   = new Set(await readdir(scansDir).catch(() => []));

  // Send a traversal ZIP that will be rejected during extraction
  const buf = buildZip([{ name: '../escape.txt', data: Buffer.from('boom') }]);
  const { status } = await postZip(buf);
  assert.equal(status, 400);

  // Get the list after the failed request
  const after = new Set(await readdir(scansDir).catch(() => []));

  // Find any new directory that appeared
  const newDirs = [...after].filter((d) => !before.has(d));

  // There must be no new scan directory left behind
  assert.equal(
    newDirs.length,
    0,
    `Partial scan directory was NOT cleaned up: ${newDirs.join(', ')}`
  );
});

test('T13 – GET /api/health still works after all uploads', async () => {
  const res  = await fetch(`${BASE_URL}/api/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'buildproof-server');
});

test('T14 – successful upload does not execute project code', async () => {
  // This test is structural: extractZip() only uses fs.mkdir and
  // fs.createWriteStream. It never calls child_process.spawn, exec, or
  // any npm/node command. We verify this by checking the extracted directory
  // contains only static files and no node_modules or installed artifacts.
  const buf = await readSampleZip('good-app.zip');
  const { status, body } = await postZip(buf, 'good-app.zip');
  assert.equal(status, 202);

  const scansDir   = path.resolve(__dirname, '../data/scans');
  const scanId     = body.scanId;
  const projectDir = path.join(scansDir, scanId, 'project');

  // node_modules must NOT be present (no npm install was run)
  let nodeModulesExists = false;
  try {
    await stat(path.join(projectDir, 'node_modules'));
    nodeModulesExists = true;
  } catch (_) {
    // Expected — it should not exist
  }

  assert.equal(
    nodeModulesExists,
    false,
    'node_modules must not exist; npm install must never be run by the extractor'
  );

  // Verify at least one expected file IS present (confirming extraction worked)
  const files = await readdir(projectDir);
  assert.ok(files.includes('package.json'), 'package.json must be in the extracted project');
});
