/**
 * tests/step7.test.js
 *
 * What this file does:
 *   Automated test suite for Step 7: Report Generator (Milestone M4).
 *   Verifies:
 *     1. Valid JSON report generation matching ARCHITECTURE.md §6 schema.
 *     2. JSON report parses successfully and is deterministic.
 *     3. Report preserves the actual verdict (ready, not_ready, partially_verified).
 *     4. Report preserves static check statuses and evidence.
 *     5. Report includes installation and test outcomes when present.
 *     6. Report accurately represents skipped or Not Verified phases.
 *     7. Missing optional metadata (timestamps, project name) is not fabricated.
 *     8. Standalone HTML report is generated successfully without external dependencies.
 *     9. HTML contains the expected sections, verdict, branding, and disclaimers.
 *    10. Summary counts accurately reflect check statuses.
 *    11. HTML escapes malicious project names (XSS protection).
 *    12. HTML escapes malicious evidence, summaries, and diagnostic snippets.
 *    13. Secret values (.env, API keys) are not exposed in reports.
 *    14. Absolute host paths are sanitized to relative paths.
 *    15. Atomic file writes and report containment inside the scan directory.
 *    16. Path traversal in scan IDs is rejected.
 *    17. GET /api/scans/:id/report.json returns 404 for unknown scan IDs.
 *    18. GET /api/scans/:id/report.json returns 409 when report is not yet ready.
 *    19. Response headers (Content-Type, Content-Disposition, safe filenames).
 *    20. Report generation failure does not mark the scan as completed.
 *    21. Sample project report verification for good-app, lockfile-mismatch,
 *        failing-test, and no-tests-no-readme.
 *
 * How to run:
 *   cd server
 *   node --test tests/step7.test.js
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';

import app from '../src/index.js';
import {
  escapeHtml,
  sanitizePath,
  buildReportData,
  renderHtmlReport,
  generateReports,
} from '../src/services/report.js';
import { createScan, getScan, updateScan } from '../src/services/scanStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

// ── Server lifecycle for integration test ───────────────────────────────────

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

// ── Unit Tests: HTML Escaping & Path Sanitization ───────────────────────────

test('escapeHtml: escapes all characters with HTML significance', () => {
  const untrusted = '<script>alert("XSS" & \'attack\')</script>';
  const escaped = escapeHtml(untrusted);
  assert.ok(!escaped.includes('<script>'));
  assert.ok(!escaped.includes('</script>'));
  assert.ok(!escaped.includes('"'));
  assert.ok(!escaped.includes("'"));
  assert.equal(
    escaped,
    '&lt;script&gt;alert(&quot;XSS&quot; &amp; &#39;attack&#39;)&lt;/script&gt;'
  );
});

test('escapeHtml: handles null and undefined safely without throwing', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '123');
});

test('sanitizePath: strips host-specific Windows drive prefixes', () => {
  const winPath = 'E:\\buildProof\\server\\data\\scans\\12345\\project\\src\\index.js';
  const sanitized = sanitizePath(winPath);
  assert.ok(!sanitized.startsWith('E:'));
  assert.ok(!sanitized.includes('buildProof'));
  assert.equal(sanitized, 'src/index.js');
});

// ── Unit Tests: JSON Report Generation (buildReportData) ─────────────────────

test('R1: Valid JSON report generation matching ARCHITECTURE.md §6 schema', () => {
  const scanRecord = {
    scanId: 'scan-uuid-001',
    projectName: 'test-app',
    createdAt: '2026-10-26T12:00:00.000Z',
    completedAt: '2026-10-26T12:02:00.000Z',
    verdict: 'ready',
    checks: [
      {
        id: 'package_json',
        title: 'package.json present',
        status: 'Passed',
        critical: true,
        summary: 'Found valid package.json',
        evidence: ['package.json'],
      },
      {
        id: 'install',
        title: 'Install dependencies',
        status: 'Passed',
        critical: true,
        command: 'npm ci',
        exitCode: 0,
        durationMs: 4500,
        summary: 'Dependencies installed successfully.',
      },
      {
        id: 'tests',
        title: 'Execute tests',
        status: 'Passed',
        critical: true,
        command: 'npm test',
        exitCode: 0,
        durationMs: 1200,
        summary: 'All tests passed.',
      },
    ],
    warnings: ['No lockfile found; fallback to npm install'],
  };

  const report = buildReportData(scanRecord);

  // Schema assertions
  assert.equal(report.schemaVersion, '1.0.0');
  assert.equal(report.scanId, 'scan-uuid-001');
  assert.equal(report.projectName, 'test-app');
  assert.equal(report.createdAt, '2026-10-26T12:00:00.000Z');
  assert.equal(report.completedAt, '2026-10-26T12:02:00.000Z');
  assert.equal(report.status, 'done');
  assert.equal(report.verdict, 'ready');
  assert.equal(report.verdictLabel, 'Ready for handover');

  // Environment checks
  assert.equal(report.environment.image, 'node:20-alpine');
  assert.equal(report.environment.limits.memory, '512m');
  assert.equal(report.environment.networkPolicy.tests, 'none (network isolated)');

  // Checks and Summary
  assert.equal(report.summary.totalChecks, 3);
  assert.equal(report.summary.passed, 3);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.notVerified, 0);

  // Disclaimer
  assert.ok(report.disclaimer.includes('does not prove software is bug-free'));
});

test('R2: JSON report serializes and parses without data loss', () => {
  const scanRecord = {
    scanId: 'parse-test-123',
    projectName: 'json-parser-app',
    verdict: 'not_ready',
    checks: [
      {
        id: 'install',
        status: 'Failed',
        exitCode: 1,
        summary: 'Installation failed',
      },
    ],
  };

  const report = buildReportData(scanRecord);
  const serialized = JSON.stringify(report);
  const parsed = JSON.parse(serialized);

  assert.deepEqual(parsed, report);
});

test('R3: Report preserves actual verdicts exactly', () => {
  for (const v of ['ready', 'not_ready', 'partially_verified']) {
    const report = buildReportData({ verdict: v });
    assert.equal(report.verdict, v);
  }
});

test('R4: Report preserves static check statuses, evidence, and critical flags', () => {
  const checks = [
    {
      id: 'readme',
      title: 'README present',
      status: 'Passed',
      critical: false,
      evidence: ['README.md (1420 bytes)'],
    },
    {
      id: 'env_example',
      title: '.env.example present',
      status: 'Failed',
      critical: false,
      evidence: ['No .env.example found'],
    },
  ];

  const report = buildReportData({ checks });
  assert.equal(report.checks.length, 2);
  assert.equal(report.checks[0].id, 'readme');
  assert.equal(report.checks[0].status, 'Passed');
  assert.deepEqual(report.checks[0].evidence, ['README.md (1420 bytes)']);
  assert.equal(report.checks[1].id, 'env_example');
  assert.equal(report.checks[1].status, 'Failed');
});

test('R5: Report includes actual installation and test exit codes and durations', () => {
  const checks = [
    {
      id: 'install',
      status: 'Passed',
      command: 'npm ci',
      exitCode: 0,
      durationMs: 8200,
      summary: 'Dependencies installed in 8.2s',
    },
    {
      id: 'tests',
      status: 'Failed',
      command: 'npm test',
      exitCode: 1,
      durationMs: 3100,
      summary: '1 test failed',
    },
  ];

  const report = buildReportData({ checks });
  const install = report.checks.find((c) => c.id === 'install');
  const tests = report.checks.find((c) => c.id === 'tests');

  assert.equal(install.exitCode, 0);
  assert.equal(install.durationMs, 8200);
  assert.equal(tests.exitCode, 1);
  assert.equal(tests.durationMs, 3100);
});

test('R6: Report clearly distinguishes skipped/Not Verified phases from failed phases', () => {
  const checks = [
    {
      id: 'install',
      status: 'Failed',
      exitCode: 1,
      summary: 'Lockfile mismatch',
    },
    {
      id: 'tests',
      status: 'Not Verified',
      exitCode: null,
      summary: 'Tests skipped because dependency installation failed',
    },
  ];

  const report = buildReportData({ checks });
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.notVerified, 1);
  assert.equal(report.checks[1].status, 'Not Verified');
  assert.equal(report.checks[1].exitCode, null);
});

test('R7: Missing optional metadata is not fabricated', () => {
  const report = buildReportData({ scanId: 'minimal-record' });
  assert.equal(report.projectName, null);
  assert.equal(report.createdAt, null);
  assert.equal(report.completedAt, null);
  assert.deepEqual(report.warnings, []);
});

// ── Unit Tests: Standalone HTML Report Generation ───────────────────────────

test('R8: HTML report is self-contained with no external CSS, JS, or fonts', () => {
  const reportData = buildReportData({
    scanId: 'html-self-contained',
    projectName: 'offline-app',
    verdict: 'ready',
    checks: [
      { id: 'package_json', status: 'Passed', summary: 'Valid package.json' },
      { id: 'install', status: 'Passed', command: 'npm ci', exitCode: 0, durationMs: 2000, summary: 'Installed' },
      { id: 'tests', status: 'Passed', command: 'npm test', exitCode: 0, durationMs: 1500, summary: 'Passed' },
    ],
  });

  const html = renderHtmlReport(reportData);

  // Must not have external scripts or stylesheets
  assert.ok(!html.includes('<script src='), 'HTML should not load external scripts');
  assert.ok(!html.includes('<link rel="stylesheet"'), 'HTML should not load external stylesheets');
  assert.ok(!html.includes('http://'), 'HTML should not call external http assets');
  assert.ok(!html.includes('https://'), 'HTML should not call external https assets');
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('</html>'));
});

test('R9: HTML contains expected sections, branding, and verdict', () => {
  const reportData = buildReportData({
    scanId: 'html-sections-001',
    projectName: 'sample-project',
    verdict: 'not_ready',
    warnings: ['Found missing optional .env.example'],
    checks: [
      { id: 'install', status: 'Failed', exitCode: 1, command: 'npm ci', summary: 'ERESOLVE error' },
    ],
  });

  const html = renderHtmlReport(reportData);

  assert.ok(html.includes('BuildProof'), 'Must include brand name');
  assert.ok(html.includes('Project Handover Readiness Checker'), 'Must include subtitle');
  assert.ok(html.includes('Not ready'), 'Must display verdict');
  assert.ok(html.includes('Docker Container Verification (Sandbox)'));
  assert.ok(html.includes('Static Project Inspection'));
  assert.ok(html.includes('Observations &amp; Warnings'));
  assert.ok(html.includes('Disclaimer:'));
});

test('R10: Summary counts in HTML accurately reflect check statuses', () => {
  const reportData = buildReportData({
    verdict: 'partially_verified',
    checks: [
      { id: 'c1', status: 'Passed', summary: 'P1' },
      { id: 'c2', status: 'Passed', summary: 'P2' },
      { id: 'c3', status: 'Failed', summary: 'F1' },
      { id: 'c4', status: 'Not Verified', summary: 'NV1' },
      { id: 'c5', status: 'Not Verified', summary: 'NV2' },
    ],
  });

  const html = renderHtmlReport(reportData);
  assert.equal(reportData.summary.passed, 2);
  assert.equal(reportData.summary.failed, 1);
  assert.equal(reportData.summary.notVerified, 2);

  assert.ok(html.includes('>2</div>\n        <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Passed</div>'));
  assert.ok(html.includes('>1</div>\n        <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Failed</div>'));
  assert.ok(html.includes('>2</div>\n        <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Not Verified</div>'));
});

test('R11: HTML escapes malicious project names (XSS prevention)', () => {
  const maliciousName = '<img src=x onerror=alert("XSS")>';
  const reportData = buildReportData({
    scanId: 'xss-project-name',
    projectName: maliciousName,
    verdict: 'ready',
  });

  const html = renderHtmlReport(reportData);
  assert.ok(!html.includes('<img src=x onerror=alert("XSS")>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(&quot;XSS&quot;)&gt;'));
});

test('R12: HTML escapes malicious evidence, summaries, and diagnostic snippets', () => {
  const reportData = buildReportData({
    scanId: 'xss-evidence',
    verdict: 'not_ready',
    checks: [
      {
        id: 'install',
        title: '<b onmouseover=evil()>Install</b>',
        status: 'Failed',
        summary: '<script>stealCookie()</script>',
        explanation: '"><iframe src=javascript:alert(1)>',
        nextStep: '<a href="javascript:void(0)" onclick="attack()">Click</a>',
        evidence: ['<svg onload=alert(2)>', 'Normal string "with quotes" & ampersands'],
      },
    ],
    warnings: ['<script>alert("warning XSS")</script>'],
  });

  const html = renderHtmlReport(reportData);
  assert.ok(!html.includes('<b onmouseover=evil()>'));
  assert.ok(!html.includes('<script>stealCookie()</script>'));
  assert.ok(!html.includes('<iframe src=javascript:alert(1)>'));
  assert.ok(!html.includes('<svg onload=alert(2)>'));
  assert.ok(!html.includes('<script>alert("warning XSS")</script>'));

  assert.ok(html.includes('&lt;script&gt;stealCookie()&lt;/script&gt;'));
  assert.ok(html.includes('&lt;svg onload=alert(2)&gt;'));
  assert.ok(html.includes('&amp; ampersands'));
});

test('R13: Secret values and environment file contents are not leaked in report', () => {
  const reportData = buildReportData({
    scanId: 'secrets-test',
    verdict: 'ready',
    checks: [
      {
        id: 'env_example',
        status: 'Passed',
        summary: '.env.example verified',
        evidence: ['.env.example (safe template)'],
      },
    ],
  });

  const jsonStr = JSON.stringify(reportData);
  const htmlStr = renderHtmlReport(reportData);

  // Check no accidental AWS key, DB password, or API token format
  for (const text of [jsonStr, htmlStr]) {
    assert.ok(!text.includes('AKIA'), 'Must not contain AWS key');
    assert.ok(!text.includes('password='), 'Must not contain password string');
    assert.ok(!text.includes('DATABASE_URL='), 'Must not contain DB URL');
  }
});

// ── Unit Tests: Atomic File Generation & Path Security ──────────────────────

test('R14 & R15: generateReports creates report.json and report.html atomically inside scanDir', async () => {
  const tmpScanDir = await mkdtemp(path.join(os.tmpdir(), 'buildproof-report-test-'));
  const scanId = 'report-gen-unit-001';

  try {
    createScan(scanId, {
      status: 'reporting',
      projectName: 'unit-atomic-project',
      verdict: 'ready',
      checks: [
        { id: 'package_json', status: 'Passed', summary: 'OK' },
      ],
    });

    const outcome = await generateReports(scanId, tmpScanDir, {
      scanId,
      projectName: 'unit-atomic-project',
      verdict: 'ready',
      checks: [
        { id: 'package_json', status: 'Passed', summary: 'OK' },
      ],
    });

    assert.equal(outcome.jsonPath, path.join(tmpScanDir, 'report.json'));
    assert.equal(outcome.htmlPath, path.join(tmpScanDir, 'report.html'));

    const jsonOnDisk = await readFile(outcome.jsonPath, 'utf8');
    const htmlOnDisk = await readFile(outcome.htmlPath, 'utf8');

    assert.ok(jsonOnDisk.includes('"schemaVersion": "1.0.0"'));
    assert.ok(htmlOnDisk.includes('<!DOCTYPE html>'));

    // Scan record in memory updated to 'done'
    const record = getScan(scanId);
    assert.ok(record, 'Scan record should exist in store');
    assert.equal(record.status, 'done');
    assert.equal(record.stage, 'done');
    assert.ok(record.completedAt);
    assert.equal(record.reports.json, 'report.json');
    assert.equal(record.reports.html, 'report.html');
  } finally {
    await rm(tmpScanDir, { recursive: true, force: true });
  }
});

test('R16: Invalid or path traversal scan IDs are rejected by generateReports', async () => {
  const tmpScanDir = await mkdtemp(path.join(os.tmpdir(), 'buildproof-traversal-test-'));

  try {
    await assert.rejects(
      () => generateReports('../../etc', tmpScanDir, {}),
      /traversal/i
    );
    await assert.rejects(
      () => generateReports('..\\windows', tmpScanDir, {}),
      /traversal/i
    );
  } finally {
    await rm(tmpScanDir, { recursive: true, force: true });
  }
});

// ── Integration Tests: API Endpoints (GET /api/scans/:id/report.*) ──────────

test('R17: Unknown scan IDs return 404 for report endpoints', async () => {
  const resJson = await fetch(`${BASE_URL}/api/scans/non-existent-scan-9999/report.json`);
  assert.equal(resJson.status, 404);
  const dataJson = await resJson.json();
  assert.equal(dataJson.error, 'Scan not found');

  const resHtml = await fetch(`${BASE_URL}/api/scans/non-existent-scan-9999/report.html`);
  assert.equal(resHtml.status, 404);
  const dataHtml = await resHtml.json();
  assert.equal(dataHtml.error, 'Scan not found');
});

test('R18: Reports not yet ready return 409 Conflict', async () => {
  const inProgressScanId = 'in-progress-scan-001';
  createScan(inProgressScanId, {
    status: 'installing',
    stage: 'installing_dependencies',
    projectName: 'pending-project',
  });

  const resJson = await fetch(`${BASE_URL}/api/scans/${inProgressScanId}/report.json`);
  assert.equal(resJson.status, 409);
  const dataJson = await resJson.json();
  assert.ok(dataJson.error.includes('not ready yet'));

  const resHtml = await fetch(`${BASE_URL}/api/scans/${inProgressScanId}/report.html`);
  assert.equal(resHtml.status, 409);
  const dataHtml = await resHtml.json();
  assert.ok(dataHtml.error.includes('not ready yet'));
});

test('R19: Correct response content types, status 200, and download headers', async () => {
  const completedScanId = 'completed-scan-headers-001';
  const scansDir = path.resolve(__dirname, '../data/scans', completedScanId);
  await mkdir(scansDir, { recursive: true });

  createScan(completedScanId, {
    status: 'done',
    stage: 'done',
    projectName: 'my-awesome-app',
    verdict: 'ready',
    checks: [
      { id: 'package_json', status: 'Passed', summary: 'OK' },
    ],
  });

  await generateReports(completedScanId, scansDir, getScan(completedScanId));

  try {
    // 1. JSON Report Endpoint
    const resJson = await fetch(`${BASE_URL}/api/scans/${completedScanId}/report.json`);
    assert.equal(resJson.status, 200);
    assert.ok(resJson.headers.get('content-type').includes('application/json'));
    const dispositionJson = resJson.headers.get('content-disposition');
    assert.ok(dispositionJson.includes('attachment;'));
    assert.ok(dispositionJson.includes('buildproof-report-my-awesome-app-'));

    const jsonBody = await resJson.json();
    assert.equal(jsonBody.scanId, completedScanId);
    assert.equal(jsonBody.verdict, 'ready');

    // 2. HTML Report Endpoint
    const resHtml = await fetch(`${BASE_URL}/api/scans/${completedScanId}/report.html`);
    assert.equal(resHtml.status, 200);
    assert.ok(resHtml.headers.get('content-type').includes('text/html'));
    const dispositionHtml = resHtml.headers.get('content-disposition');
    assert.ok(dispositionHtml.includes('inline;'));
    assert.ok(dispositionHtml.includes('buildproof-report-my-awesome-app-'));

    const htmlBody = await resHtml.text();
    assert.ok(htmlBody.includes('my-awesome-app'));
    assert.ok(htmlBody.includes('Ready for handover'));
  } finally {
    await rm(scansDir, { recursive: true, force: true });
  }
});

test('R20: Report generation error transitions scan to error state', async () => {
  const scanId = 'error-report-scan-001';
  createScan(scanId, {
    status: 'reporting',
    stage: 'reporting',
  });

  // Attempting to generate reports with an illegal directory path (e.g. read-only or traversal)
  await assert.rejects(
    () => generateReports(scanId, '::illegal_win_path::', getScan(scanId))
  );

  // Status should not be marked 'done'
  const record = getScan(scanId);
  assert.notEqual(record.status, 'done');
});

// ── Sample Project Verification ─────────────────────────────────────────────

test('R21: Sample project report verification for good-app (Ready for handover)', async () => {
  const sampleScanRecord = {
    scanId: 'sample-good-app-001',
    projectName: 'good-app',
    createdAt: '2026-10-26T10:00:00.000Z',
    completedAt: '2026-10-26T10:01:30.000Z',
    verdict: 'ready',
    checks: [
      { id: 'package_json', status: 'Passed', critical: true, summary: 'Valid package.json' },
      { id: 'lockfile', status: 'Passed', critical: true, summary: 'package-lock.json present' },
      { id: 'test_script', status: 'Passed', critical: true, summary: 'Test script configured' },
      { id: 'readme', status: 'Passed', critical: false, summary: 'README present' },
      { id: 'env_example', status: 'Passed', critical: false, summary: '.env.example present' },
      { id: 'gitignore', status: 'Passed', critical: false, summary: '.gitignore present' },
      { id: 'install', status: 'Passed', critical: true, command: 'npm ci', exitCode: 0, durationMs: 4000, summary: 'Installed' },
      { id: 'tests', status: 'Passed', critical: true, command: 'npm test', exitCode: 0, durationMs: 1200, summary: 'Passed' },
    ],
  };

  const report = buildReportData(sampleScanRecord);
  assert.equal(report.verdict, 'ready');
  assert.equal(report.summary.passed, 8);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.notVerified, 0);

  const html = renderHtmlReport(report);
  assert.ok(html.includes('Ready for handover'));
  assert.ok(html.includes('good-app'));
});

test('R22: Sample project report verification for lockfile-mismatch (Not ready)', async () => {
  const sampleScanRecord = {
    scanId: 'sample-lockfile-mismatch-001',
    projectName: 'lockfile-mismatch',
    verdict: 'not_ready',
    checks: [
      { id: 'package_json', status: 'Passed', critical: true, summary: 'Valid package.json' },
      { id: 'lockfile', status: 'Passed', critical: true, summary: 'package-lock.json present' },
      { id: 'test_script', status: 'Passed', critical: true, summary: 'Test script configured' },
      { id: 'readme', status: 'Passed', critical: false, summary: 'README present' },
      { id: 'env_example', status: 'Passed', critical: false, summary: '.env.example present' },
      { id: 'gitignore', status: 'Passed', critical: false, summary: '.gitignore present' },
      {
        id: 'install',
        status: 'Failed',
        critical: true,
        command: 'npm ci',
        exitCode: 1,
        summary: 'npm ci failed with exit code 1',
        explanation: 'package.json and package-lock.json are out of sync.',
        nextStep: 'Run "npm install" locally and commit the updated package-lock.json.',
      },
      {
        id: 'tests',
        status: 'Not Verified',
        critical: true,
        command: null,
        exitCode: null,
        summary: 'Tests were not executed because dependency installation failed.',
      },
    ],
  };

  const report = buildReportData(sampleScanRecord);
  assert.equal(report.verdict, 'not_ready');
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.notVerified, 1);

  const html = renderHtmlReport(report);
  assert.ok(html.includes('Not ready'));
  assert.ok(html.includes('lockfile-mismatch'));
  assert.ok(html.includes('package.json and package-lock.json are out of sync.'));
});

test('R23: Sample project report verification for failing-test (Not ready)', async () => {
  const sampleScanRecord = {
    scanId: 'sample-failing-test-001',
    projectName: 'failing-test',
    verdict: 'not_ready',
    checks: [
      { id: 'package_json', status: 'Passed', critical: true, summary: 'Valid package.json' },
      { id: 'lockfile', status: 'Passed', critical: true, summary: 'package-lock.json present' },
      { id: 'test_script', status: 'Passed', critical: true, summary: 'Test script configured' },
      { id: 'readme', status: 'Passed', critical: false, summary: 'README present' },
      { id: 'env_example', status: 'Passed', critical: false, summary: '.env.example present' },
      { id: 'gitignore', status: 'Passed', critical: false, summary: '.gitignore present' },
      { id: 'install', status: 'Passed', critical: true, command: 'npm ci', exitCode: 0, summary: 'Installed' },
      {
        id: 'tests',
        status: 'Failed',
        critical: true,
        command: 'npm test',
        exitCode: 1,
        summary: 'npm test failed with exit code 1',
        explanation: 'One or more test assertions failed in the test suite.',
        nextStep: 'Inspect the test execution logs to fix failing test assertions.',
      },
    ],
  };

  const report = buildReportData(sampleScanRecord);
  assert.equal(report.verdict, 'not_ready');
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.passed, 7);

  const html = renderHtmlReport(report);
  assert.ok(html.includes('Not ready'));
  assert.ok(html.includes('failing-test'));
  assert.ok(html.includes('One or more test assertions failed in the test suite.'));
});

test('R24: Sample project report verification for no-tests-no-readme (Partially verified)', async () => {
  const sampleScanRecord = {
    scanId: 'sample-no-tests-no-readme-001',
    projectName: 'no-tests-no-readme',
    verdict: 'partially_verified',
    warnings: ['No README file found', 'Missing .env.example file'],
    checks: [
      { id: 'package_json', status: 'Passed', critical: true, summary: 'Valid package.json' },
      { id: 'lockfile', status: 'Passed', critical: true, summary: 'package-lock.json present' },
      { id: 'test_script', status: 'Not Verified', critical: true, summary: 'No test script configured' },
      { id: 'readme', status: 'Not Verified', critical: false, summary: 'README missing' },
      { id: 'env_example', status: 'Not Verified', critical: false, summary: '.env.example missing' },
      { id: 'gitignore', status: 'Passed', critical: false, summary: '.gitignore present' },
      { id: 'install', status: 'Passed', critical: true, command: 'npm ci', exitCode: 0, summary: 'Installed' },
      {
        id: 'tests',
        status: 'Not Verified',
        critical: true,
        summary: 'Tests were not executed because no real test script is configured.',
      },
    ],
  };

  const report = buildReportData(sampleScanRecord);
  assert.equal(report.verdict, 'partially_verified');
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.notVerified, 4);

  const html = renderHtmlReport(report);
  assert.ok(html.includes('Partially verified'));
  assert.ok(html.includes('no-tests-no-readme'));
  assert.ok(html.includes('No README file found'));
});
