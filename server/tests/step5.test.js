/**
 * tests/step5.test.js
 *
 * What this file does:
 *   Automated tests for Step 5: Static Project Scanner (Milestone M2).
 *   Verifies all required static checks, security boundaries, edge cases,
 *   the four sample projects, and the GET /api/scans/:id integration.
 *
 * How to run:
 *   cd server
 *   node --test tests/step5.test.js
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm, mkdir, writeFile, symlink } from 'node:fs/promises';

import app from '../src/index.js';
import { scanProject, checkContainment } from '../src/services/scanner.js';
import { buildZip } from './zipBuilder.js';

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

// ── Fixture helper ──────────────────────────────────────────────────────────

async function createTempProject(files = {}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'buildproof-scanner-test-'));
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

// ── 1. Manifest checks ──────────────────────────────────────────────────────

test('S01 – Valid package.json is recognized and parsed', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({
      name: 'sample-tool',
      version: '1.2.3',
      scripts: { test: 'node --test' },
      dependencies: { express: '^4.18.2' },
    }),
    'package-lock.json': '{}',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'manifest');
    assert.ok(check);
    assert.equal(check.status, 'Passed');
    assert.match(check.summary, /valid package\.json/i);
    assert.ok(check.evidence.some((e) => e.includes('sample-tool (v1.2.3)')));
    assert.equal(result.metadata.projectName, 'sample-tool');
    assert.equal(result.metadata.dependenciesCount, 1);
  } finally {
    await proj.cleanup();
  }
});

test('S02 – Missing package.json is reported as Failed', async () => {
  const proj = await createTempProject({
    'README.md': '# Just a readme',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'manifest');
    assert.ok(check);
    assert.equal(check.status, 'Failed');
    assert.match(check.summary, /not found/i);
    assert.ok(check.evidence.some((e) => e.includes('missing')));
  } finally {
    await proj.cleanup();
  }
});

test('S03 – Malformed package.json is reported safely without crashing', async () => {
  const proj = await createTempProject({
    'package.json': '{ "name": "bad-json", "version": 1.0.0, syntax-error }',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'manifest');
    assert.ok(check);
    assert.equal(check.status, 'Failed');
    assert.match(check.summary, /malformed|invalid/i);
    assert.ok(check.evidence.some((e) => /Parser error/i.test(e)));
  } finally {
    await proj.cleanup();
  }
});

// ── 2. Lockfile checks ──────────────────────────────────────────────────────

test('S04 – Lockfiles are detected correctly (package-lock, yarn.lock, pnpm-lock)', async () => {
  for (const lockfile of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json']) {
    const proj = await createTempProject({
      'package.json': JSON.stringify({ name: 'app' }),
      [lockfile]: lockfile.endsWith('.json') ? '{}' : '# lockfile',
    });

    try {
      const result = await scanProject(proj.dir);
      const check = result.checks.find((c) => c.id === 'lockfile');
      assert.ok(check);
      assert.equal(check.status, 'Passed');
      assert.ok(check.evidence.some((e) => e.includes(lockfile)));
      assert.equal(result.metadata.lockfile, lockfile);
    } finally {
      await proj.cleanup();
    }
  }
});

test('S05 – Missing lockfile is reported as Failed for handover readiness', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({ name: 'no-lockfile' }),
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'lockfile');
    assert.ok(check);
    assert.equal(check.status, 'Failed');
    assert.match(check.summary, /no lockfile/i);
    assert.equal(result.metadata.lockfile, null);
  } finally {
    await proj.cleanup();
  }
});

// ── 3. Test script configuration checks ─────────────────────────────────────

test('S06 – Configured test script is reported as Passed with Docker deferral note', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({
      name: 'tested-app',
      scripts: { test: 'node --test src/**/*.test.js' },
    }),
    'package-lock.json': '{}',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'test-script');
    assert.ok(check);
    assert.equal(check.status, 'Passed');
    assert.match(check.summary, /test script is configured/i);
    assert.ok(check.evidence.some((e) => e.includes('Docker sandbox')));
  } finally {
    await proj.cleanup();
  }
});

test('S07 – Missing or npm default placeholder test script is reported as Not Verified', async () => {
  // Test case 1: Missing test script
  const proj1 = await createTempProject({
    'package.json': JSON.stringify({ name: 'no-tests', scripts: {} }),
  });
  try {
    const res1 = await scanProject(proj1.dir);
    const check1 = res1.checks.find((c) => c.id === 'test-script');
    assert.equal(check1.status, 'Not Verified');
    assert.match(check1.summary, /no test script/i);
  } finally {
    await proj1.cleanup();
  }

  // Test case 2: Default npm placeholder "echo \"Error: no test specified\" && exit 1"
  const proj2 = await createTempProject({
    'package.json': JSON.stringify({
      name: 'placeholder-test',
      scripts: { test: 'echo "Error: no test specified" && exit 1' },
    }),
  });
  try {
    const res2 = await scanProject(proj2.dir);
    const check2 = res2.checks.find((c) => c.id === 'test-script');
    assert.equal(check2.status, 'Not Verified');
    assert.match(check2.summary, /placeholder/i);
  } finally {
    await proj2.cleanup();
  }
});

// ── 4. README documentation checks ──────────────────────────────────────────

test('S08 – README with setup instructions is reported as Passed', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({ name: 'readme-app' }),
    'README.md': '# App\n\n## Installation\n\nRun `npm install` and then `npm start`.\n',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'readme');
    assert.ok(check);
    assert.equal(check.status, 'Passed');
    assert.match(check.summary, /setup and run instructions/i);
  } finally {
    await proj.cleanup();
  }
});

test('S09 – Missing README is reported as Failed, and empty/uninformative README as Not Verified', async () => {
  // Missing README
  const proj1 = await createTempProject({
    'package.json': JSON.stringify({ name: 'no-readme' }),
  });
  try {
    const res1 = await scanProject(proj1.dir);
    const check1 = res1.checks.find((c) => c.id === 'readme');
    assert.equal(check1.status, 'Failed');
    assert.match(check1.summary, /no readme/i);
  } finally {
    await proj1.cleanup();
  }

  // README with no setup steps
  const proj2 = await createTempProject({
    'package.json': JSON.stringify({ name: 'uninformative-readme' }),
    'README.md': '# Project\n\nThis project is cool. Copyright 2026.\n',
  });
  try {
    const res2 = await scanProject(proj2.dir);
    const check2 = res2.checks.find((c) => c.id === 'readme');
    assert.equal(check2.status, 'Not Verified');
    assert.match(check2.summary, /clear setup/i);
  } finally {
    await proj2.cleanup();
  }
});

// ── 5. Environment variable documentation checks ────────────────────────────

test('S10 – Environment template (.env.example) is detected without exposing secrets', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({ name: 'env-app' }),
    '.env.example': 'PORT=3000\nAPI_KEY=your_key_here\nSECRET_TOKEN=xyz\n',
    'src/index.js': 'const port = process.env.PORT || 3000;\nconst key = process.env.API_KEY;\n',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'env-docs');
    assert.ok(check);
    assert.equal(check.status, 'Passed');
    assert.match(check.summary, /\.env\.example/);
    assert.ok(check.evidence.some((e) => e.includes('API_KEY')));
    // Must NOT leak raw secret values in evidence or summary
    assert.ok(!JSON.stringify(check).includes('your_key_here'));
    assert.ok(!JSON.stringify(check).includes('xyz'));
  } finally {
    await proj.cleanup();
  }
});

test('S11 – Missing environment template when process.env is used is reported as Failed', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({ name: 'undocumented-env' }),
    'server.js': 'const db = process.env.DATABASE_URL;\n',
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'env-docs');
    assert.ok(check);
    assert.equal(check.status, 'Failed');
    assert.match(check.summary, /no \.env\.example/i);
    assert.ok(check.evidence.some((e) => e.includes('DATABASE_URL')));
  } finally {
    await proj.cleanup();
  }
});

// ── 6. Project structure & Node.js version ───────────────────────────────────

test('S12 – Basic project structure is inspected flexibly', async () => {
  // Layout A: index.js at root
  const projA = await createTempProject({
    'package.json': JSON.stringify({ name: 'layout-a' }),
    'index.js': 'console.log("hello");',
  });
  try {
    const resA = await scanProject(projA.dir);
    const checkA = resA.checks.find((c) => c.id === 'structure');
    assert.equal(checkA.status, 'Passed');
  } finally {
    await projA.cleanup();
  }

  // Layout B: src/server.js
  const projB = await createTempProject({
    'package.json': JSON.stringify({ name: 'layout-b' }),
    'src/server.js': 'console.log("server");',
  });
  try {
    const resB = await scanProject(projB.dir);
    const checkB = resB.checks.find((c) => c.id === 'structure');
    assert.equal(checkB.status, 'Passed');
  } finally {
    await projB.cleanup();
  }
});

test('S13 – Node.js version declaration is detected in engines or .nvmrc', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({ name: 'node-app', engines: { node: '>=20' } }),
  });

  try {
    const result = await scanProject(proj.dir);
    const check = result.checks.find((c) => c.id === 'node-version');
    assert.ok(check);
    assert.equal(check.status, 'Passed');
    assert.ok(check.evidence.some((e) => e.includes('>=20')));
  } finally {
    await proj.cleanup();
  }
});

// ── 7. Security & Containment checks ────────────────────────────────────────

test('S14 – Path containment helper rejects path traversal and outside paths', () => {
  const root = path.resolve('C:/project/extracted');
  assert.equal(checkContainment(path.join(root, 'index.js'), root), true);
  assert.equal(checkContainment(path.join(root, 'src', 'app.js'), root), true);
  assert.equal(checkContainment(path.resolve(root, '../evil.js'), root), false);
  assert.equal(checkContainment('C:/Windows/system32/cmd.exe', root), false);
  assert.equal(checkContainment(null, root), false);
});

test('S15 – Symlinks are not followed by the scanner', async () => {
  const proj = await createTempProject({
    'package.json': JSON.stringify({ name: 'symlink-test' }),
    'real.js': 'const secret = "keep-me-safe";',
  });

  try {
    // Attempt to create a symlink to outside or inside (skip on OS if symlink requires admin)
    let symlinkCreated = false;
    try {
      await symlink(path.join(proj.dir, 'real.js'), path.join(proj.dir, 'linked.js'));
      symlinkCreated = true;
    } catch (_) {
      // Windows standard user without developer mode cannot create symlinks; that's fine
    }

    const result = await scanProject(proj.dir);
    assert.ok(result.checks.length > 0);
    // If symlink was created, ensure it did not cause a crash or invalid read
    if (symlinkCreated) {
      assert.ok(!result.metadata.scripts.includes('linked'));
    }
  } finally {
    await proj.cleanup();
  }
});

// ── 8. Verification against the four real sample projects ───────────────────

test('S16 – Sample project "good-app" passes all relevant static checks', async () => {
  const goodAppDir = path.join(SAMPLES_DIR, 'good-app');
  const result = await scanProject(goodAppDir);

  const manifest   = result.checks.find((c) => c.id === 'manifest');
  const lockfile   = result.checks.find((c) => c.id === 'lockfile');
  const testScript = result.checks.find((c) => c.id === 'test-script');
  const readme     = result.checks.find((c) => c.id === 'readme');
  const nodeVer    = result.checks.find((c) => c.id === 'node-version');
  const structure  = result.checks.find((c) => c.id === 'structure');

  assert.equal(manifest.status,   'Passed');
  assert.equal(lockfile.status,   'Passed');
  assert.equal(testScript.status, 'Passed');
  assert.equal(readme.status,     'Passed');
  assert.equal(nodeVer.status,    'Passed');
  assert.equal(structure.status,  'Passed');
});

test('S17 – Sample project "lockfile-mismatch" has manifest and lockfile present', async () => {
  const mismatchDir = path.join(SAMPLES_DIR, 'lockfile-mismatch');
  const result = await scanProject(mismatchDir);

  const manifest = result.checks.find((c) => c.id === 'manifest');
  const lockfile = result.checks.find((c) => c.id === 'lockfile');

  assert.equal(manifest.status, 'Passed');
  assert.equal(lockfile.status, 'Passed');
  // Note: lockfile presence passes statically; the version desync is verified in Docker runner during npm ci
});

test('S18 – Sample project "failing-test" has valid manifest and configured test script', async () => {
  const failingDir = path.join(SAMPLES_DIR, 'failing-test');
  const result = await scanProject(failingDir);

  const manifest   = result.checks.find((c) => c.id === 'manifest');
  const testScript = result.checks.find((c) => c.id === 'test-script');

  assert.equal(manifest.status,   'Passed');
  assert.equal(testScript.status, 'Passed');
});

test('S19 – Sample project "no-tests-no-readme" reports Not Verified test and Failed readme', async () => {
  const noTestDir = path.join(SAMPLES_DIR, 'no-tests-no-readme');
  const result = await scanProject(noTestDir);

  const manifest   = result.checks.find((c) => c.id === 'manifest');
  const lockfile   = result.checks.find((c) => c.id === 'lockfile');
  const testScript = result.checks.find((c) => c.id === 'test-script');
  const readme     = result.checks.find((c) => c.id === 'readme');

  assert.equal(manifest.status,   'Passed');
  assert.equal(lockfile.status,   'Passed');
  assert.equal(testScript.status, 'Not Verified', 'Placeholder test must be Not Verified');
  assert.equal(readme.status,     'Failed',       'Missing README must be Failed');
});

// ── 9. Integration with API (POST /api/scans and GET /api/scans/:id) ────────

test('S20 – POST /api/scans runs scanner and stores findings accessible via GET /api/scans/:id', async () => {
  // Upload a valid ZIP containing good-app
  const { readFile } = await import('node:fs/promises');
  const zipBuf = await readFile(path.join(SAMPLES_DIR, 'good-app.zip'));

  const blob = new Blob([zipBuf], { type: 'application/zip' });
  const form = new FormData();
  form.append('project', blob, 'good-app.zip');

  const uploadRes = await fetch(`${BASE_URL}/api/scans`, { method: 'POST', body: form });
  assert.equal(uploadRes.status, 202);
  const uploadBody = await uploadRes.json();
  assert.ok(uploadBody.scanId);

  // Poll GET /api/scans/:id to verify scan store has stored the static check results
  const pollRes = await fetch(`${BASE_URL}/api/scans/${uploadBody.scanId}`);
  assert.equal(pollRes.status, 200);
  const pollBody = await pollRes.json();

  assert.equal(pollBody.scanId, uploadBody.scanId);
  assert.equal(pollBody.status, 'installing', 'Scan state must have advanced to installing');
  assert.equal(pollBody.stage, 'static_scan_complete');
  assert.ok(Array.isArray(pollBody.checks), 'checks array must be present');
  assert.ok(pollBody.checks.length >= 6, 'Must contain all static checks');

  const manifestCheck = pollBody.checks.find((c) => c.id === 'manifest');
  assert.ok(manifestCheck);
  assert.equal(manifestCheck.status, 'Passed');
});
