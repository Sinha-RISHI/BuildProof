/**
 * tests/python.test.js
 *
 * What this file does:
 *   Comprehensive automated test suite for Stage B - Stage H:
 *   - Ecosystem detection (Python, Node.js, ambiguous, unsupported)
 *   - Adapter selection & resolution
 *   - Python static analysis (manifest, lockfile, test discovery, readme, env docs)
 *   - Python Docker execution (network isolation, unprivileged user, timeouts)
 *   - Real execution with the 4 Python sample projects
 *   - Report generation and schema compatibility
 *
 * Run:
 *   node --test tests/python.test.js
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';

import { detectEcosystem, ECOSYSTEMS, resolveAdapter, getAdapterForEcosystem } from '../src/services/adapters/index.js';
import { scanProject } from '../src/services/scanner.js';
import { runDockerChecks } from '../src/services/dockerRunner.js';
import { buildReportData, renderHtmlReport } from '../src/services/report.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

async function createTempProject(files = {}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'buildproof-python-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, relPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }
  return {
    dir: tmpDir,
    async cleanup() {
      await rm(tmpDir, { recursive: true, force: true });
    },
  };
}

// ── 1. Ecosystem Detection Tests ─────────────────────────────────────────────

test('PY01 – detectEcosystem identifies Python from requirements.txt', () => {
  const entries = [
    { name: 'requirements.txt', isFile: true, isDir: false, isSymlink: false },
    { name: 'app.py', isFile: true, isDir: false, isSymlink: false },
  ];
  const result = detectEcosystem(entries);
  assert.equal(result.ecosystem, ECOSYSTEMS.PYTHON);
  assert.ok(result.reason.includes('requirements.txt'));
});

test('PY02 – detectEcosystem identifies Python from pyproject.toml', () => {
  const entries = [
    { name: 'pyproject.toml', isFile: true, isDir: false, isSymlink: false },
  ];
  const result = detectEcosystem(entries);
  assert.equal(result.ecosystem, ECOSYSTEMS.PYTHON);
});

test('PY03 – detectEcosystem identifies Python from source files (.py) fallback', () => {
  const entries = [
    { name: 'main.py', isFile: true, isDir: false, isSymlink: false },
    { name: 'utils.py', isFile: true, isDir: false, isSymlink: false },
  ];
  const result = detectEcosystem(entries);
  assert.equal(result.ecosystem, ECOSYSTEMS.PYTHON);
});

test('PY04 – detectEcosystem flags ambiguous projects with mixed manifests', () => {
  const entries = [
    { name: 'package.json', isFile: true, isDir: false, isSymlink: false },
    { name: 'requirements.txt', isFile: true, isDir: false, isSymlink: false },
  ];
  const result = detectEcosystem(entries);
  assert.equal(result.ecosystem, ECOSYSTEMS.AMBIGUOUS);
  assert.ok(result.reason.includes('Ambiguous project'));
});

test('PY05 – detectEcosystem flags unsupported projects (Rust, Go, Java)', () => {
  const entries = [
    { name: 'Cargo.toml', isFile: true, isDir: false, isSymlink: false },
    { name: 'main.rs', isFile: true, isDir: false, isSymlink: false },
  ];
  const result = detectEcosystem(entries);
  assert.equal(result.ecosystem, ECOSYSTEMS.UNSUPPORTED);
  assert.ok(result.reason.includes('Rust'));
});

test('PY06 – resolveAdapter returns correct adapter instances', () => {
  const nodeEntries = [{ name: 'package.json', isFile: true, isDir: false, isSymlink: false }];
  const pythonEntries = [{ name: 'requirements.txt', isFile: true, isDir: false, isSymlink: false }];

  const nodeRes = resolveAdapter(nodeEntries);
  assert.equal(nodeRes.ecosystem, ECOSYSTEMS.NODE);
  assert.equal(nodeRes.adapter.id, 'node');

  const pyRes = resolveAdapter(pythonEntries);
  assert.equal(pyRes.ecosystem, ECOSYSTEMS.PYTHON);
  assert.equal(pyRes.adapter.id, 'python');
  assert.equal(pyRes.adapter.defaultImage, 'python:3.11-alpine');
});

// ── 2. Python Static Analysis Tests ──────────────────────────────────────────

test('PY07 – Static scan on python-good-app sample project', async () => {
  const goodAppDir = path.join(SAMPLES_DIR, 'python-good-app');
  const result = await scanProject(goodAppDir);

  assert.equal(result.ecosystem, 'python');
  assert.equal(result.metadata.ecosystem, 'python');

  const manifestCheck = result.checks.find((c) => c.id === 'manifest');
  assert.ok(manifestCheck);
  assert.equal(manifestCheck.status, 'Passed');

  const lockfileCheck = result.checks.find((c) => c.id === 'lockfile');
  assert.ok(lockfileCheck);
  assert.equal(lockfileCheck.status, 'Passed');

  const testCheck = result.checks.find((c) => c.id === 'test-script');
  assert.ok(testCheck);
  assert.equal(testCheck.status, 'Passed');

  const readmeCheck = result.checks.find((c) => c.id === 'readme');
  assert.ok(readmeCheck);
  assert.equal(readmeCheck.status, 'Passed');

  const versionCheck = result.checks.find((c) => c.id === 'runtime-version');
  assert.ok(versionCheck);
  assert.equal(versionCheck.status, 'Passed');
  assert.ok(versionCheck.evidence.some((e) => e.includes('3.11')));
});

test('PY08 – Static scan on python-missing-setup flags missing manifest and env docs', async () => {
  const missingSetupDir = path.join(SAMPLES_DIR, 'python-missing-setup');
  const result = await scanProject(missingSetupDir);

  assert.equal(result.ecosystem, 'python');
  const manifestCheck = result.checks.find((c) => c.id === 'manifest');
  assert.equal(manifestCheck.status, 'Failed');

  const envCheck = result.checks.find((c) => c.id === 'env-docs');
  assert.equal(envCheck.status, 'Failed');
  assert.ok(envCheck.evidence.some((e) => e.includes('DATABASE_URL')));

  const readmeCheck = result.checks.find((c) => c.id === 'readme');
  assert.equal(readmeCheck.status, 'Failed');
});

test('PY09 – Static scan on python-no-tests reports test-script as Not Verified', async () => {
  const noTestsDir = path.join(SAMPLES_DIR, 'python-no-tests');
  const result = await scanProject(noTestsDir);

  assert.equal(result.ecosystem, 'python');
  const testCheck = result.checks.find((c) => c.id === 'test-script');
  assert.equal(testCheck.status, 'Not Verified');
});

// ── 3. Docker Runner & Security Sandbox Tests ────────────────────────────────

test('PY10 – Docker security flags: Python tests enforce --network none and non-root user', async () => {
  let capturedArgs = [];
  const fakeSpawn = (cmd, args) => {
    capturedArgs.push({ cmd, args });
    return {
      stdout: { on: (event, cb) => { if (event === 'data') cb(Buffer.from('Ran 1 test in 0.001s\n\nOK\n')); } },
      stderr: { on: () => {} },
      on: (event, cb) => { if (event === 'close') cb(0); },
      kill: () => {},
    };
  };

  const goodAppDir = path.join(SAMPLES_DIR, 'python-good-app');
  const scanResult = await scanProject(goodAppDir);

  const outcome = await runDockerChecks(goodAppDir, scanResult, {
    checkDockerFn: async () => ({ reachable: true }),
    spawnFn: fakeSpawn,
  });

  assert.equal(outcome.verdict, 'ready');
  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.tests.status, 'Passed');

  // Verify test execution container configuration
  const testRun = capturedArgs.find((c) => c.args.includes('--network') && c.args.includes('none'));
  assert.ok(testRun, 'Phase 2 tests must run with --network none');
  assert.ok(testRun.args.includes('--user'), 'Must specify user flag');
  assert.ok(testRun.args.includes('1000:1000'), 'Must run as unprivileged user 1000:1000');
  assert.ok(testRun.args.includes('--cap-drop=ALL'), 'Must drop all Linux capabilities');
  assert.ok(testRun.args.includes('--security-opt=no-new-privileges'), 'Must prevent privilege escalation');
  assert.ok(testRun.args.includes('python:3.11-alpine'), 'Must use python:3.11-alpine sandbox image');
});

test('PY11 – Failing Python test preserves non-zero exit code and sets not_ready verdict', async () => {
  const fakeSpawn = (cmd, args) => {
    const isInstall = args.includes('pip');
    const exitCode = isInstall ? 0 : 1;
    const stdoutMsg = isInstall ? 'Successfully installed\n' : 'FAILED (failures=1)\n';

    return {
      stdout: { on: (event, cb) => { if (event === 'data') cb(Buffer.from(stdoutMsg)); } },
      stderr: { on: () => {} },
      on: (event, cb) => { if (event === 'close') cb(exitCode); },
      kill: () => {},
    };
  };

  const failingDir = path.join(SAMPLES_DIR, 'python-failing-test');
  const scanResult = await scanProject(failingDir);

  const outcome = await runDockerChecks(failingDir, scanResult, {
    checkDockerFn: async () => ({ reachable: true }),
    spawnFn: fakeSpawn,
  });

  assert.equal(outcome.verdict, 'not_ready');
  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.tests.status, 'Failed');
  assert.equal(outcome.tests.exitCode, 1);
  assert.ok(outcome.tests.explanation.includes('Python test runner exited with non-zero exit code 1'));
});

test('PY12 – Python project with no tests results in partially_verified verdict', async () => {
  const fakeSpawn = (cmd, args) => {
    // Only install should spawn; tests must never be spawned
    const isTest = args.includes('unittest') || args.includes('pytest');
    if (isTest) {
      assert.fail('Should not spawn Docker test container when no tests exist');
    }
    return {
      stdout: { on: (event, cb) => { if (event === 'data') cb(Buffer.from('Install ok\n')); } },
      stderr: { on: () => {} },
      on: (event, cb) => { if (event === 'close') cb(0); },
      kill: () => {},
    };
  };

  const noTestsDir = path.join(SAMPLES_DIR, 'python-no-tests');
  const scanResult = await scanProject(noTestsDir);

  const outcome = await runDockerChecks(noTestsDir, scanResult, {
    checkDockerFn: async () => ({ reachable: true }),
    spawnFn: fakeSpawn,
  });

  assert.equal(outcome.verdict, 'partially_verified');
  assert.equal(outcome.tests.status, 'Not Verified');
});

// ── 4. Report Generation Tests ───────────────────────────────────────────────

test('PY13 – buildReportData preserves Python ecosystem and environment metadata', () => {
  const scanRecord = {
    scanId: 'py-scan-1234',
    projectName: 'my-python-tool',
    verdict: 'ready',
    ecosystem: 'python',
    checks: [
      { id: 'manifest', status: 'Passed', critical: true, title: 'Package manifest' },
      { id: 'install', status: 'Passed', critical: true, command: 'pip install -r requirements.txt' },
      { id: 'tests', status: 'Passed', critical: true, command: 'python -m unittest discover' },
    ],
  };

  const report = buildReportData(scanRecord);
  assert.equal(report.ecosystem, 'python');
  assert.equal(report.environment.image, 'python:3.11-alpine');
  assert.equal(report.environment.python, '3.11');
  assert.equal(report.verdict, 'ready');
  assert.equal(report.summary.passed, 3);
  assert.equal(report.summary.failed, 0);

  const html = renderHtmlReport(report);
  assert.ok(html.includes('python:3.11-alpine'));
  assert.ok(html.includes('my-python-tool'));
  assert.ok(html.includes('Ready for handover'));
});

// ── 5. Real Docker Sandbox Integration Tests (Conditional) ───────────────────

test('PY14 – Real Docker sandbox execution: python-good-app runs to Ready verdict', async (t) => {
  const goodAppDir = path.join(SAMPLES_DIR, 'python-good-app');
  const scanResult = await scanProject(goodAppDir);

  let outcome;
  try {
    outcome = await runDockerChecks(goodAppDir, scanResult);
  } catch (err) {
    if (err.message.includes('Docker engine is not running') || err.message.includes('unavailable')) {
      t.skip('Docker daemon not available for real container run');
      return;
    }
    throw err;
  }

  assert.equal(outcome.install.status, 'Passed');
  assert.equal(outcome.tests.status, 'Passed');
  assert.equal(outcome.verdict, 'ready');
});
