/**
 * tests/history.test.js
 *
 * Automated tests for Scan History backend endpoint:
 *   GET /api/scans
 * Verifies:
 *   1. Returns 200 with an array.
 *   2. Accurately reflects scans created in scanStore.
 *   3. Sorts records in reverse chronological order (newest first).
 *   4. Excludes internal sensitive fields (host paths, raw logs).
 *   5. Preserves originalFilename, projectName, status, verdict, and checksCount.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import app from '../src/index.js';
import { createScan, updateScan } from '../src/services/scanStore.js';

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
  if (server) {
    server.close((err) => (err ? reject(err) : resolve()));
  } else {
    resolve();
  }
}));

test('H01: GET /api/scans returns 200 and an array', async () => {
  const res = await fetch(`${BASE_URL}/api/scans`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type')?.includes('application/json'));
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

test('H02: GET /api/scans returns registered scans in reverse chronological order', async () => {
  const scanId1 = 'test-hist-001';
  const scanId2 = 'test-hist-002';

  createScan(scanId1, {
    projectName: 'alpha-project',
    originalFilename: 'alpha-project.zip',
    status: 'done',
    verdict: 'ready',
    createdAt: '2026-10-27T10:00:00.000Z',
    checks: [{ id: 'manifest', status: 'Passed' }],
  });

  createScan(scanId2, {
    projectName: 'beta-project',
    originalFilename: 'beta-project.zip',
    status: 'done',
    verdict: 'not_ready',
    createdAt: '2026-10-27T11:00:00.000Z',
    checks: [{ id: 'manifest', status: 'Failed' }],
  });

  const res = await fetch(`${BASE_URL}/api/scans`);
  assert.equal(res.status, 200);
  const body = await res.json();

  const scan2 = body.find((s) => s.scanId === scanId2);
  const scan1 = body.find((s) => s.scanId === scanId1);

  assert.ok(scan2, 'scan2 found in history');
  assert.ok(scan1, 'scan1 found in history');
  assert.equal(scan2.projectName, 'beta-project');
  assert.equal(scan2.originalFilename, 'beta-project.zip');
  assert.equal(scan2.verdict, 'not_ready');
  assert.equal(scan1.verdict, 'ready');

  // Verify newest first
  const idx2 = body.indexOf(scan2);
  const idx1 = body.indexOf(scan1);
  assert.ok(idx2 < idx1, 'scan2 (created later) appears before scan1');
});

test('H03: GET /api/scans does not leak internal sensitive logs or paths', async () => {
  const sensitiveId = 'test-sensitive-003';
  createScan(sensitiveId, {
    projectName: 'secret-app',
    originalFilename: 'secret-app.zip',
    status: 'done',
    verdict: 'ready',
    createdAt: '2026-10-27T12:00:00.000Z',
    logs: { install: 'SUPER_SECRET_LOG_TOKEN_12345' },
    scanPath: 'C:\\Users\\Host\\secret-app',
  });

  const res = await fetch(`${BASE_URL}/api/scans`);
  const body = await res.json();
  const found = body.find((s) => s.scanId === sensitiveId);

  assert.ok(found);
  assert.equal(found.logs, undefined, 'logs field is stripped from summary list');
  assert.equal(found.scanPath, undefined, 'host scanPath is stripped from summary list');
});
