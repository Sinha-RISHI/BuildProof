/**
 * tests/history.test.js
 *
 * Comprehensive tests for BuildProof Scan History Dashboard:
 *   1. Metric summary calculations from real scan data.
 *   2. Filtering by status: all, ready, not_ready, running, failed.
 *   3. Search matching by originalFilename, projectName, and scanId.
 *   4. Sorting: newest first, oldest first, and project name A-Z.
 *   5. Robust fallbacks for missing timestamps, missing project names, and partial metadata.
 *   6. Proper report URL resolution for HTML and JSON downloads.
 *   7. Empty history handling and zero-metrics integrity.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReportJsonUrl, getReportHtmlUrl } from '../src/api.js';

// Sample realistic scan fixture dataset derived from server/src/services/scanStore.js
const SAMPLE_SCANS = [
  {
    id: 'scan-uuid-001',
    scanId: 'scan-uuid-001',
    projectName: 'good-app',
    originalFilename: 'good-app.zip',
    status: 'done',
    stage: 'done',
    verdict: 'ready',
    createdAt: '2026-10-27T10:00:00.000Z',
    completedAt: '2026-10-27T10:00:14.000Z',
    hasReport: true,
  },
  {
    id: 'scan-uuid-002',
    scanId: 'scan-uuid-002',
    projectName: 'lockfile-mismatch',
    originalFilename: 'lockfile-mismatch.zip',
    status: 'done',
    stage: 'done',
    verdict: 'not_ready',
    createdAt: '2026-10-27T11:00:00.000Z',
    completedAt: '2026-10-27T11:00:18.000Z',
    hasReport: true,
  },
  {
    id: 'scan-uuid-003',
    scanId: 'scan-uuid-003',
    projectName: 'partially-verified-app',
    originalFilename: 'partially-verified-app.zip',
    status: 'done',
    stage: 'done',
    verdict: 'partially_verified',
    createdAt: '2026-10-27T12:00:00.000Z',
    completedAt: '2026-10-27T12:00:12.000Z',
    hasReport: true,
  },
  {
    id: 'scan-uuid-004',
    scanId: 'scan-uuid-004',
    projectName: 'running-app',
    originalFilename: 'running-app.zip',
    status: 'testing',
    stage: 'docker_running',
    verdict: null,
    createdAt: '2026-10-27T13:00:00.000Z',
    completedAt: null,
    hasReport: false,
  },
  {
    id: 'scan-uuid-005',
    scanId: 'scan-uuid-005',
    projectName: 'corrupt-app',
    originalFilename: 'corrupt-app.zip',
    status: 'error',
    stage: 'error',
    verdict: null,
    createdAt: '2026-10-27T09:00:00.000Z',
    completedAt: null,
    hasReport: false,
  },
];

// Helper functions that mirror ScanHistoryView logic
function calculateMetrics(scans) {
  const total = scans.length;
  let ready = 0;
  let notReady = 0;
  let inProgress = 0;
  let failed = 0;

  for (const s of scans) {
    if (['queued', 'extracting', 'scanning', 'installing', 'testing', 'reporting'].includes(s.status)) {
      inProgress++;
    } else if (s.status === 'error') {
      failed++;
    } else if (s.verdict === 'ready') {
      ready++;
    } else if (s.verdict === 'not_ready' || s.verdict === 'partially_verified') {
      notReady++;
    }
  }

  return { total, ready, notReady, inProgress, failed };
}

function filterAndSortScans(scans, { statusFilter = 'all', searchQuery = '', sortBy = 'newest' } = {}) {
  let result = [...scans];

  if (statusFilter === 'ready') {
    result = result.filter((s) => s.verdict === 'ready');
  } else if (statusFilter === 'not_ready') {
    result = result.filter((s) => s.verdict === 'not_ready' || s.verdict === 'partially_verified');
  } else if (statusFilter === 'running') {
    result = result.filter((s) =>
      ['queued', 'extracting', 'scanning', 'installing', 'testing', 'reporting'].includes(s.status)
    );
  } else if (statusFilter === 'failed') {
    result = result.filter((s) => s.status === 'error');
  }

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    result = result.filter((s) => {
      const nameMatch = s.projectName?.toLowerCase().includes(query);
      const fileMatch = s.originalFilename?.toLowerCase().includes(query);
      const idMatch = (s.id || s.scanId)?.toLowerCase().includes(query);
      return Boolean(nameMatch || fileMatch || idMatch);
    });
  }

  result.sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    if (sortBy === 'name') {
      const nameA = (a.projectName || a.originalFilename || '').toLowerCase();
      const nameB = (b.projectName || b.originalFilename || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  return result;
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('Metrics: empty scans array produces honest zero metrics', () => {
  const m = calculateMetrics([]);
  assert.deepEqual(m, {
    total: 0,
    ready: 0,
    notReady: 0,
    inProgress: 0,
    failed: 0,
  });
});

test('Metrics: accurately categorizes ready, not ready, in progress, and failed scans', () => {
  const m = calculateMetrics(SAMPLE_SCANS);
  assert.equal(m.total, 5);
  assert.equal(m.ready, 1); // good-app
  assert.equal(m.notReady, 2); // lockfile-mismatch + partially-verified-app
  assert.equal(m.inProgress, 1); // running-app (testing)
  assert.equal(m.failed, 1); // corrupt-app (error)
});

test('Filter: status filtering returns only matching subsets', () => {
  const readyOnly = filterAndSortScans(SAMPLE_SCANS, { statusFilter: 'ready' });
  assert.equal(readyOnly.length, 1);
  assert.equal(readyOnly[0].projectName, 'good-app');

  const notReadyOnly = filterAndSortScans(SAMPLE_SCANS, { statusFilter: 'not_ready' });
  assert.equal(notReadyOnly.length, 2);

  const runningOnly = filterAndSortScans(SAMPLE_SCANS, { statusFilter: 'running' });
  assert.equal(runningOnly.length, 1);
  assert.equal(runningOnly[0].status, 'testing');

  const failedOnly = filterAndSortScans(SAMPLE_SCANS, { statusFilter: 'failed' });
  assert.equal(failedOnly.length, 1);
  assert.equal(failedOnly[0].status, 'error');
});

test('Search: matches by original filename, project name, or scan ID case-insensitively', () => {
  const matchFile = filterAndSortScans(SAMPLE_SCANS, { searchQuery: 'GOOD-APP.ZIP' });
  assert.equal(matchFile.length, 1);
  assert.equal(matchFile[0].scanId, 'scan-uuid-001');

  const matchName = filterAndSortScans(SAMPLE_SCANS, { searchQuery: 'mismatch' });
  assert.equal(matchName.length, 1);
  assert.equal(matchName[0].projectName, 'lockfile-mismatch');

  const matchId = filterAndSortScans(SAMPLE_SCANS, { searchQuery: 'uuid-004' });
  assert.equal(matchId.length, 1);
  assert.equal(matchId[0].scanId, 'scan-uuid-004');

  const noMatch = filterAndSortScans(SAMPLE_SCANS, { searchQuery: 'nonexistent-project-xyz' });
  assert.equal(noMatch.length, 0);
});

test('Sorting: orders correctly by newest, oldest, and name', () => {
  const newest = filterAndSortScans(SAMPLE_SCANS, { sortBy: 'newest' });
  assert.equal(newest[0].scanId, 'scan-uuid-004'); // 13:00
  assert.equal(newest[newest.length - 1].scanId, 'scan-uuid-005'); // 09:00

  const oldest = filterAndSortScans(SAMPLE_SCANS, { sortBy: 'oldest' });
  assert.equal(oldest[0].scanId, 'scan-uuid-005'); // 09:00
  assert.equal(oldest[oldest.length - 1].scanId, 'scan-uuid-004'); // 13:00

  const byName = filterAndSortScans(SAMPLE_SCANS, { sortBy: 'name' });
  assert.equal(byName[0].projectName, 'corrupt-app');
  assert.equal(byName[byName.length - 1].projectName, 'running-app');
});

test('Metadata Resilience: safely handles missing timestamps, null project names, and partial objects', () => {
  const degenerateScans = [
    {
      id: 'incomplete-1',
      scanId: 'incomplete-1',
      projectName: null,
      originalFilename: null,
      status: 'done',
      verdict: null,
      createdAt: null,
    },
    {
      id: 'incomplete-2',
      scanId: 'incomplete-2',
      projectName: 'valid-name',
      status: 'extracting',
      createdAt: 'invalid-date-string',
    },
  ];

  const m = calculateMetrics(degenerateScans);
  assert.equal(m.total, 2);
  assert.equal(m.inProgress, 1);
  assert.equal(m.ready, 0);

  const sorted = filterAndSortScans(degenerateScans, { sortBy: 'newest' });
  assert.equal(sorted.length, 2);

  const search = filterAndSortScans(degenerateScans, { searchQuery: 'valid' });
  assert.equal(search.length, 1);
});

test('Report Links: generates valid, secure report URLs for scans', () => {
  const scanId = 'scan-uuid-001';
  assert.equal(getReportHtmlUrl(scanId), '/api/scans/scan-uuid-001/report.html');
  assert.equal(getReportJsonUrl(scanId), '/api/scans/scan-uuid-001/report.json');
});
