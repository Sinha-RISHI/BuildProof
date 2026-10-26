/**
 * tests/step6.test.js
 *
 * What this file does:
 *   Automated test suite for Step 6: Restricted Docker Runner (Milestone M3).
 *   Covers:
 *     - Unit tests with controlled spawner mocks verifying all security flags,
 *       argument arrays, timeout handling, error code handling, and package managers.
 *     - Real Docker integration tests executing the four sample projects inside
 *       node:20-alpine containers.
 *     - API integration for status and log retrieval endpoints.
 *
 * How to run:
 *   cd server
 *   node --test tests/step6.test.js
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';

import app from '../src/index.js';
import {
  runDockerChecks,
  runDockerProcess,
  calculateVerdict,
  runDockerRunner,
} from '../src/services/dockerRunner.js';
import { scanProject } from '../src/services/scanner.js';
import { getScan } from '../src/services/scanStore.js';

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

// ── Mock spawner helper ─────────────────────────────────────────────────────

/**
 * createMockSpawner(handler)
 * Returns a mock spawner and records all calls.
 */
function createMockSpawner(handler) {
  const calls = [];

  const spawnFn = (cmd, args, options) => {
    calls.push({ cmd, args, options });

    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};

    // Invoke handler asynchronously
    setImmediate(() => {
      try {
        handler({ cmd, args, options, child });
      } catch (err) {
        child.emit('error', err);
      }
    });

    return child;
  };

  return { spawnFn, calls };
}

// ── Unit Tests with Mock Spawner ────────────────────────────────────────────

test('D01 – Lockfile detection selects npm ci', async () => {
  const { spawnFn, calls } = createMockSpawner(({ child, args }) => {
    child.stdout.emit('data', 'added 1 package');
    child.emit('close', 0);
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.install.command, 'npm ci');
  assert.ok(calls.length >= 1);
  assert.deepEqual(calls[0].args.slice(-2), ['npm', 'ci']);
});

test('D02 – Missing lockfile selects npm install fallback with reproducibility warning', async () => {
  const { spawnFn, calls } = createMockSpawner(({ child }) => {
    child.stdout.emit('data', 'installed packages');
    child.emit('close', 0);
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Failed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: null },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.install.command, 'npm install');
  assert.ok(outcome.warnings.some((w) => w.includes('fell back to npm install')));
  assert.deepEqual(calls[0].args.slice(-2), ['npm', 'install']);
});

test('D03 – Unsupported package managers (yarn, pnpm) are handled explicitly', async () => {
  const { spawnFn, calls } = createMockSpawner(() => {});

  const scanResult = {
    checks: [{ id: 'manifest', status: 'Passed' }],
    metadata: { lockfile: 'yarn.lock' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(outcome.install.status, 'Not Verified');
  assert.match(outcome.install.summary, /unsupported package manager/i);
  assert.equal(outcome.tests.status, 'Not Verified');
  assert.equal(calls.length, 0, 'No Docker command should be spawned for unsupported package manager');
});

test('D04 – Docker commands use spawn with argument arrays and no shell', async () => {
  const { spawnFn, calls } = createMockSpawner(({ child }) => {
    child.emit('close', 0);
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  for (const call of calls) {
    assert.equal(call.cmd, 'docker');
    assert.ok(Array.isArray(call.args), 'Arguments must be an array');
    assert.notEqual(call.options?.shell, true, 'shell: true must NEVER be used');
  }
});

test('D05 – Test execution strictly enforces --network none', async () => {
  let callIndex = 0;
  const { spawnFn, calls } = createMockSpawner(({ child, args }) => {
    callIndex++;
    if (callIndex === 1) {
      // Install phase
      child.stdout.emit('data', 'installed');
      child.emit('close', 0);
    } else {
      // Test phase
      child.stdout.emit('data', 'test pass');
      child.emit('close', 0);
    }
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(calls.length, 2);
  const testCall = calls[1];
  const networkArgIndex = testCall.args.indexOf('--network');
  assert.ok(networkArgIndex !== -1, '--network flag must be present in test call');
  assert.equal(testCall.args[networkArgIndex + 1], 'none', 'network must be set to "none"');
});

test('D06 – Required resource and privilege restrictions are present', async () => {
  const { spawnFn, calls } = createMockSpawner(({ child }) => {
    child.emit('close', 0);
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  const requiredFlags = [
    '--rm',
    '--user',
    '--memory=512m',
    '--cpus=1',
    '--pids-limit=256',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
  ];

  for (const call of calls) {
    for (const flag of requiredFlags) {
      if (flag.includes('=')) {
        assert.ok(call.args.includes(flag), `Flag ${flag} must be present in docker arguments`);
      } else {
        assert.ok(call.args.includes(flag), `Flag ${flag} must be present in docker arguments`);
      }
    }
  }
});

test('D07 – Only the expected project directory is mounted to /app', async () => {
  const { spawnFn, calls } = createMockSpawner(({ child }) => {
    child.emit('close', 0);
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const targetDir = path.resolve('C:/safe/extraction/project');
  await runDockerChecks(targetDir, scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  for (const call of calls) {
    const vIndex = call.args.indexOf('-v');
    assert.ok(vIndex !== -1, '-v volume mount must exist');
    const mount = call.args[vIndex + 1];
    assert.equal(mount, `${targetDir}:/app`, 'Mount must point strictly to project folder and target /app');
  }
});

test('D08 – Docker daemon unavailable is handled cleanly', async () => {
  const { spawnFn, calls } = createMockSpawner(() => {});

  const scanResult = {
    checks: [{ id: 'manifest', status: 'Passed' }],
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: false, error: 'Docker Desktop is stopped.' }),
  });

  assert.equal(outcome.install.status, 'Failed');
  assert.match(outcome.install.summary, /Docker sandbox unavailable/);
  assert.equal(outcome.tests.status, 'Not Verified');
  assert.equal(outcome.verdict, 'not_ready');
  assert.equal(calls.length, 0);
});

test('D09 – Missing image or container-start errors are handled without crash', async () => {
  const { spawnFn } = createMockSpawner(({ child }) => {
    child.emit('error', new Error('Unable to find image locally and pull access denied'));
  });

  const scanResult = {
    checks: [{ id: 'manifest', status: 'Passed' }, { id: 'lockfile', status: 'Passed' }],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(outcome.install.status, 'Failed');
  assert.equal(outcome.tests.status, 'Not Verified');
});

test('D10 – Successful installation permits the test phase', async () => {
  let installRan = false;
  let testRan = false;

  const { spawnFn } = createMockSpawner(({ child, args }) => {
    if (args.includes('ci')) {
      installRan = true;
      child.emit('close', 0);
    } else if (args.includes('test')) {
      testRan = true;
      child.emit('close', 0);
    }
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(installRan, true);
  assert.equal(testRan, true);
  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.tests.status, 'Passed');
  assert.equal(outcome.verdict, 'ready');
});

test('D11 – Installation failure prevents the test phase', async () => {
  let testRan = false;

  const { spawnFn } = createMockSpawner(({ child, args }) => {
    if (args.includes('ci')) {
      child.stderr.emit('data', 'Missing: left-pad@1.3.0 from lock file');
      child.emit('close', 1);
    } else if (args.includes('test')) {
      testRan = true;
      child.emit('close', 0);
    }
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(testRan, false, 'Tests must not run when installation fails');
  assert.equal(outcome.install.status, 'Failed');
  assert.equal(outcome.tests.status, 'Not Verified');
  assert.match(outcome.install.explanation, /out of sync/i);
  assert.equal(outcome.verdict, 'not_ready');
});

test('D12 – Failing tests preserve the actual nonzero exit code and set not_ready verdict', async () => {
  const { spawnFn } = createMockSpawner(({ child, args }) => {
    if (args.includes('ci')) {
      child.emit('close', 0);
    } else if (args.includes('test')) {
      child.stderr.emit('data', 'AssertionError: expected 5 to equal 10');
      child.emit('close', 1);
    }
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.tests.status, 'Failed');
  assert.equal(outcome.tests.exitCode, 1);
  assert.equal(outcome.verdict, 'not_ready');
});

test('D13 – Missing or placeholder test script is marked Not Verified without running container', async () => {
  let testRan = false;

  const { spawnFn } = createMockSpawner(({ child, args }) => {
    if (args.includes('ci')) {
      child.emit('close', 0);
    } else if (args.includes('test')) {
      testRan = true;
      child.emit('close', 0);
    }
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
      { id: 'test-script', status: 'Not Verified' }, // Placeholder
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks('C:/fake/project', scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  assert.equal(testRan, false);
  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.tests.status, 'Not Verified');
  assert.equal(outcome.verdict, 'partially_verified');
});

test('D14 – Execution timeout triggers kill and reports failure', async () => {
  let killCalled = false;
  const mockChild = new EventEmitter();
  mockChild.stdout = new EventEmitter();
  mockChild.stderr = new EventEmitter();
  mockChild.kill = () => { killCalled = true; };

  const spawnFn = () => mockChild;

  // Run with 50ms timeout
  const res = await runDockerProcess(['run', 'node:20-alpine'], 'test-container', 50, spawnFn);

  assert.equal(res.timedOut, true);
  assert.equal(res.exitCode, null);
  assert.equal(killCalled, true);
  assert.equal(res.error, 'TIMEOUT');
});

test('D15 – Logs are bounded and sanitized', async () => {
  const hostDir = path.resolve('C:/Users/SecretUser/buildproof/server/data/scans/123/project');
  const hugeText = `error at ${hostDir}/index.js\n` + 'A'.repeat(60_000);

  const { spawnFn } = createMockSpawner(({ child }) => {
    child.stdout.emit('data', hugeText);
    child.emit('close', 0);
  });

  const scanResult = {
    checks: [
      { id: 'manifest', status: 'Passed' },
      { id: 'lockfile', status: 'Passed' },
    ],
    metadata: { lockfile: 'package-lock.json' },
  };

  const outcome = await runDockerChecks(hostDir, scanResult, {
    spawnFn,
    checkDockerFn: async () => ({ reachable: true, version: '27.0' }),
  });

  const log = outcome.logs.install;
  assert.ok(log.length <= 51_000, 'Log must be bounded');
  assert.ok(log.includes('[BuildProof Notice: Log truncated'), 'Must include truncation notice');
  assert.ok(!log.includes('SecretUser'), 'Host username path must not be leaked');
  assert.ok(log.includes('/app/index.js'), 'Host path must be sanitized to /app');
});

test('D16 – Verdict calculation satisfies ARCHITECTURE.md §5.5 rules', () => {
  // All critical + non-critical pass -> ready
  assert.equal(
    calculateVerdict([
      { id: 'manifest', status: 'Passed' },
      { id: 'install', status: 'Passed' },
      { id: 'tests', status: 'Passed' },
      { id: 'readme', status: 'Passed' },
    ]),
    'ready'
  );

  // Critical install failure -> not_ready
  assert.equal(
    calculateVerdict([
      { id: 'manifest', status: 'Passed' },
      { id: 'install', status: 'Failed', critical: true },
      { id: 'tests', status: 'Not Verified' },
    ]),
    'not_ready'
  );

  // Critical test failure -> not_ready
  assert.equal(
    calculateVerdict([
      { id: 'manifest', status: 'Passed' },
      { id: 'install', status: 'Passed' },
      { id: 'tests', status: 'Failed', critical: true },
    ]),
    'not_ready'
  );

  // No critical failures, but tests Not Verified -> partially_verified
  assert.equal(
    calculateVerdict([
      { id: 'manifest', status: 'Passed' },
      { id: 'install', status: 'Passed' },
      { id: 'tests', status: 'Not Verified' },
      { id: 'readme', status: 'Failed' },
    ]),
    'partially_verified'
  );
});

// ── Real Docker Integration Tests (Samples) ─────────────────────────────────

test('D17 – Real Docker: "good-app" succeeds install and tests, verdict ready', async () => {
  const goodAppDir = path.join(SAMPLES_DIR, 'good-app');
  const scanResult = await scanProject(goodAppDir);

  const outcome = await runDockerChecks(goodAppDir, scanResult);

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.install.exitCode, 0);
  assert.equal(outcome.tests.status, 'Passed');
  assert.equal(outcome.tests.exitCode, 0);
  assert.equal(outcome.verdict, 'ready');
});

test('D18 – Real Docker: "lockfile-mismatch" fails npm ci and skips tests, verdict not_ready', async () => {
  const mismatchDir = path.join(SAMPLES_DIR, 'lockfile-mismatch');
  const scanResult = await scanProject(mismatchDir);

  const outcome = await runDockerChecks(mismatchDir, scanResult);

  assert.equal(outcome.install.status, 'Failed');
  assert.equal(outcome.install.exitCode, 1);
  assert.match(outcome.install.explanation, /out of sync/i);
  assert.equal(outcome.tests.status, 'Not Verified');
  assert.equal(outcome.verdict, 'not_ready');
});

test('D19 – Real Docker: "failing-test" passes install but fails npm test with exit code 1', async () => {
  const failingDir = path.join(SAMPLES_DIR, 'failing-test');
  const scanResult = await scanProject(failingDir);

  const outcome = await runDockerChecks(failingDir, scanResult);

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.install.exitCode, 0);
  assert.equal(outcome.tests.status, 'Failed');
  assert.equal(outcome.tests.exitCode, 1);
  assert.match(outcome.tests.explanation, /failed with exit code 1/i);
  assert.equal(outcome.verdict, 'not_ready');
});

test('D20 – Real Docker: "no-tests-no-readme" passes install, tests Not Verified, verdict partially_verified', async () => {
  const noTestDir = path.join(SAMPLES_DIR, 'no-tests-no-readme');
  const scanResult = await scanProject(noTestDir);

  const outcome = await runDockerChecks(noTestDir, scanResult);

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.install.exitCode, 0);
  assert.equal(outcome.tests.status, 'Not Verified');
  assert.equal(outcome.verdict, 'partially_verified');
});

// ── API Integration Test ────────────────────────────────────────────────────

test('D21 – API: Background Docker run completes, GET /api/scans/:id and GET /logs/:checkId expose results', async () => {
  const { readFile } = await import('node:fs/promises');
  const zipBuf = await readFile(path.join(SAMPLES_DIR, 'good-app.zip'));

  const blob = new Blob([zipBuf], { type: 'application/zip' });
  const form = new FormData();
  form.append('project', blob, 'good-app.zip');

  const uploadRes = await fetch(`${BASE_URL}/api/scans`, { method: 'POST', body: form });
  assert.equal(uploadRes.status, 202);
  const uploadBody = await uploadRes.json();
  const scanId = uploadBody.scanId;
  assert.ok(scanId);

  // Poll until background Docker runner completes (status: 'reporting' or 'done')
  let finalStatus;
  let pollBody;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const res = await fetch(`${BASE_URL}/api/scans/${scanId}`);
    pollBody = await res.json();
    if (pollBody.status === 'reporting' || pollBody.status === 'done' || pollBody.status === 'error') {
      finalStatus = pollBody.status;
      break;
    }
  }

  assert.equal(finalStatus, 'reporting');
  assert.equal(pollBody.verdict, 'ready');

  const installCheck = pollBody.checks.find((c) => c.id === 'install');
  const testsCheck   = pollBody.checks.find((c) => c.id === 'tests');
  assert.ok(installCheck);
  assert.equal(installCheck.status, 'Passed');
  assert.ok(testsCheck);
  assert.equal(testsCheck.status, 'Passed');

  // Verify log retrieval endpoint
  const logRes = await fetch(`${BASE_URL}/api/scans/${scanId}/logs/install`);
  assert.equal(logRes.status, 200);
  assert.equal(logRes.headers.get('content-type'), 'text/plain; charset=utf-8');
  const logText = await logRes.text();
  assert.ok(logText.length > 0);
});
