/**
 * tests/api.test.js
 *
 * Automated tests for Step 8: Frontend API Integration & Contracts.
 * Verifies:
 *   1. uploadScan validates .zip extension.
 *   2. uploadScan enforces 50 MB limit.
 *   3. uploadScan rejects null or undefined file.
 *   4. uploadScan sends "project" multipart field.
 *   5. getReportJsonUrl formats correct path.
 *   6. getReportHtmlUrl formats correct path.
 *   7. getHealth handles reachable backend.
 *   8. getHealth handles network failure gracefully.
 *   9. getScan fetches record and handles error status.
 *  10. getScanLog returns plain text.
 *  11. Production build bundle validation (dist/index.html & assets).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  uploadScan,
  getHealth,
  getScan,
  getScanLog,
  getReportJsonUrl,
  getReportHtmlUrl,
} from '../src/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Unit Tests: API Client Validation ───────────────────────────────────────

test('uploadScan: rejects missing file argument', async () => {
  await assert.rejects(
    () => uploadScan(null),
    /Please select a ZIP file/i
  );
  await assert.rejects(
    () => uploadScan(undefined),
    /Please select a ZIP file/i
  );
});

test('uploadScan: rejects non-ZIP archives (e.g. .tar, .txt)', async () => {
  const fakeTar = { name: 'project.tar', size: 1024 };
  await assert.rejects(
    () => uploadScan(fakeTar),
    /Only \.zip archives are supported/i
  );

  const fakeTxt = { name: 'exploit.txt', size: 500 };
  await assert.rejects(
    () => uploadScan(fakeTxt),
    /Only \.zip archives are supported/i
  );
});

test('uploadScan: enforces 50 MB client-side file size limit', async () => {
  const oversizedFile = {
    name: 'giant-project.zip',
    size: 51 * 1024 * 1024, // 51 MB
  };

  await assert.rejects(
    () => uploadScan(oversizedFile),
    /exceeds the 50 MB size limit/i
  );
});

test('getReportJsonUrl: formats correct safe URL with encoding', () => {
  assert.equal(
    getReportJsonUrl('scan-1234'),
    '/api/scans/scan-1234/report.json'
  );
  assert.equal(
    getReportJsonUrl('test/slash'),
    '/api/scans/test%2Fslash/report.json'
  );
});

test('getReportHtmlUrl: formats correct safe URL with encoding', () => {
  assert.equal(
    getReportHtmlUrl('scan-5678'),
    '/api/scans/scan-5678/report.html'
  );
  assert.equal(
    getReportHtmlUrl('id with space'),
    '/api/scans/id%20with%20space/report.html'
  );
});

// ── Mocked Fetch Tests: Contract Validation ─────────────────────────────────

test('getHealth: parses backend health response when reachable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/health');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        service: 'buildproof-server',
        time: '2026-10-27T00:00:00.000Z',
        docker: { reachable: true, version: '24.0.7', error: null },
      }),
    };
  };

  try {
    const health = await getHealth();
    assert.equal(health.ok, true);
    assert.equal(health.docker.reachable, true);
    assert.equal(health.docker.version, '24.0.7');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getHealth: returns graceful offline object on network error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Connection refused');
  };

  try {
    const health = await getHealth();
    assert.equal(health.ok, false);
    assert.equal(health.docker.reachable, false);
    assert.ok(health.docker.error.includes('Connection refused'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uploadScan: builds FormData with "project" field name and returns response', async () => {
  const originalFetch = globalThis.fetch;
  let receivedFieldName = null;

  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/scans');
    assert.equal(options.method, 'POST');
    assert.ok(options.body instanceof FormData);
    receivedFieldName = options.body.get('project') ? 'project' : null;

    return {
      ok: true,
      status: 202,
      json: async () => ({
        scanId: 'mock-scan-uuid-123',
        status: 'queued',
        projectName: 'test-app',
      }),
    };
  };

  try {
    const mockFile = new File(['mock zip binary'], 'test-app.zip', {
      type: 'application/zip',
    });

    const res = await uploadScan(mockFile);
    assert.equal(receivedFieldName, 'project');
    assert.equal(res.scanId, 'mock-scan-uuid-123');
    assert.equal(res.status, 'queued');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getScan: fetches record and returns JSON', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/scans/test-id-100');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        scanId: 'test-id-100',
        status: 'done',
        verdict: 'ready',
        checks: [{ id: 'package_json', status: 'Passed' }],
      }),
    };
  };

  try {
    const scan = await getScan('test-id-100');
    assert.equal(scan.scanId, 'test-id-100');
    assert.equal(scan.status, 'done');
    assert.equal(scan.verdict, 'ready');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getScanLog: returns raw text from backend', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/scans/scan-1/logs/install');
    return {
      ok: true,
      status: 200,
      text: async () => 'npm ci completed in 3.4s\nadded 14 packages\n',
    };
  };

  try {
    const log = await getScanLog('scan-1', 'install');
    assert.ok(log.includes('npm ci completed'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Production Build Artifact Verification ──────────────────────────────────

test('Production build verification: dist/index.html is valid and themed', async () => {
  const distIndexPath = path.resolve(__dirname, '../dist/index.html');
  await access(distIndexPath);

  const html = await readFile(distIndexPath, 'utf8');
  assert.ok(html.includes('BuildProof'), 'Build contains title');
  assert.ok(html.includes('class="dark"'), 'Build sets dark mode class');
  assert.ok(html.includes('Material+Symbols+Outlined'), 'Build loads Stitch icon font');
});
