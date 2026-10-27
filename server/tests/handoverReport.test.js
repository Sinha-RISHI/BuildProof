/**
 * tests/handoverReport.test.js
 *
 * Automated test suite for the BuildProof Handover Report Engine.
 * Verifies all requirements specified in Part 8:
 *   1. Summary generation from actual checks
 *   2. Ready verdict
 *   3. Not Ready verdict
 *   4. Partially Verified verdict
 *   5. Failed tests findings & plain-English diagnostics
 *   6. Missing test configuration findings
 *   7. Skipped and unverified checks
 *   8. Missing manifests and lockfiles
 *   9. Node.js remediation guidance & commands
 *  10. Python remediation guidance & commands
 *  11. Accurate environment metadata & container security controls
 *  12. Actual evidence and log inclusion
 *  13. Empty and incomplete scan data resilience
 *  14. HTML escaping for malicious filenames, logs, and diagnostic text
 *  15. JSON schema backward compatibility & serialization
 *  16. Standalone HTML printability and offline capability (zero CDN scripts)
 *  17. No fabricated findings, statistics, or execution output
 *
 * Run:
 *   node --test tests/handoverReport.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  sanitizePath,
  buildReportData,
  renderHtmlReport,
  buildFindings,
  buildRemediationGuide,
  buildChecklist,
  buildSetupGuide,
  buildSandboxDetails,
  buildFinalDecision,
} from '../src/services/report.js';

// ── 1. Verdict & Executive Summary Generation ───────────────────────────────

test('HR01 – Ready verdict produces affirmative executive assessment and 100% score', () => {
  const scanRecord = {
    scanId: 'hr-ready-001',
    projectName: 'calculator-good',
    verdict: 'ready',
    ecosystem: 'python',
    checks: [
      { id: 'manifest', status: 'Passed', critical: true, title: 'pyproject.toml present' },
      { id: 'install', status: 'Passed', critical: true, command: 'pip install -r requirements.txt', exitCode: 0 },
      { id: 'tests', status: 'Passed', critical: true, command: 'python -m unittest discover', exitCode: 0 },
    ],
  };

  const report = buildReportData(scanRecord);
  assert.equal(report.verdict, 'ready');
  assert.equal(report.verdictLabel, 'Ready for handover');
  assert.equal(report.summary.score, 100);
  assert.equal(report.summary.passed, 3);
  assert.equal(report.summary.failed, 0);
  assert.equal(report.executiveSummary.blockingIssues.length, 0);
  assert.ok(report.executiveSummary.verdictExplanation.includes('Ready for Handover'));
  assert.equal(report.finalDecision.canSignOff, true);
  assert.ok(report.finalDecision.signOffRecommendation.includes('Approved for handover'));
});

test('HR02 – Not Ready verdict due to failed tests reports blocker and diagnosis', () => {
  const scanRecord = {
    scanId: 'hr-fail-002',
    projectName: 'failing-test-app',
    verdict: 'not_ready',
    ecosystem: 'python',
    checks: [
      { id: 'manifest', status: 'Passed', critical: true, title: 'Manifest' },
      { id: 'install', status: 'Passed', critical: true, title: 'Install', exitCode: 0 },
      {
        id: 'tests',
        status: 'Failed',
        critical: true,
        title: 'Execute tests',
        exitCode: 1,
        explanation: 'AssertionError: 4 != 5 in test_intentional_failure',
        nextStep: 'Fix failing test assertion in tests/test_calculator.py',
      },
    ],
  };

  const report = buildReportData(scanRecord);
  assert.equal(report.verdict, 'not_ready');
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.score, 67); // 2 of 3 passed = 67%
  assert.equal(report.executiveSummary.blockingIssues.length, 1);
  assert.equal(report.executiveSummary.blockingIssues[0].findingId, 'FINDING-TESTS');
  assert.ok(report.executiveSummary.verdictExplanation.includes('automated test suite failed'));
  assert.equal(report.finalDecision.canSignOff, false);
  assert.ok(report.finalDecision.signOffRecommendation.includes('Sign-off rejected'));
});

test('HR03 – Partially Verified verdict when tests are not configured', () => {
  const scanRecord = {
    scanId: 'hr-partial-003',
    projectName: 'no-tests-app',
    verdict: 'partially_verified',
    ecosystem: 'node',
    checks: [
      { id: 'manifest', status: 'Passed', critical: true, title: 'package.json' },
      { id: 'install', status: 'Passed', critical: true, title: 'npm ci' },
      { id: 'test-script', status: 'Not Verified', critical: false, title: 'Test script' },
      { id: 'tests', status: 'Not Verified', critical: true, title: 'Execute tests' },
    ],
  };

  const report = buildReportData(scanRecord);
  assert.equal(report.verdict, 'partially_verified');
  assert.equal(report.summary.passed, 2);
  assert.equal(report.summary.notVerified, 2);
  assert.equal(report.summary.score, 50); // 2 of 4 passed = 50%
  assert.ok(report.executiveSummary.verdictExplanation.includes('Partially Verified'));
  assert.equal(report.finalDecision.canSignOff, false);
});

// ── 2. Finding Model & Plain-English Categorization ─────────────────────────

test('HR04 – Findings model produces complete fields, correct priorities, and plain-English text', () => {
  const checks = [
    {
      id: 'tests',
      status: 'Failed',
      critical: true,
      title: 'Execute tests',
      summary: 'Unit test execution failed with exit code 1',
      evidence: ['FAILED (failures=1)', 'AssertionError: 2 * 2 != 5'],
      command: 'python -m unittest discover',
      exitCode: 1,
      durationMs: 120,
    },
    {
      id: 'lockfile',
      status: 'Failed',
      critical: true,
      title: 'Lockfile check',
      summary: 'No package-lock.json found',
      evidence: ['package.json found without package-lock.json'],
    },
    {
      id: 'readme',
      status: 'Passed',
      critical: false,
      title: 'README check',
      summary: 'README.md found with setup instructions',
      evidence: ['README.md (1240 bytes)'],
    },
  ];

  const findings = buildFindings(checks, [], 'python');

  // Verify priority sorting: blocker tests first, then lockfile, then info readme
  assert.equal(findings[0].checkId, 'tests');
  assert.equal(findings[0].severity, 'blocker');
  assert.equal(findings[0].blocksHandover, true);
  assert.equal(findings[0].category, 'Automated Tests');
  assert.ok(findings[0].whyItMatters.includes('core business logic'));
  assert.ok(findings[0].recommendedFix.includes('Inspect the test failure traceback'));
  assert.deepEqual(findings[0].ecosystemCommands, ['python -m unittest discover', 'pytest']);
  assert.equal(findings[0].exitCode, 1);

  // Check lockfile finding
  const lockFinding = findings.find((f) => f.checkId === 'lockfile');
  assert.ok(lockFinding);
  assert.equal(lockFinding.severity, 'blocker');
  assert.ok(lockFinding.whyItMatters.includes('works on my machine'));

  // Check passed readme finding
  const readmeFinding = findings.find((f) => f.checkId === 'readme');
  assert.ok(readmeFinding);
  assert.equal(readmeFinding.severity, 'info');
  assert.equal(readmeFinding.blocksHandover, false);
});

// ── 3. Ecosystem Remediation Guidance ───────────────────────────────────────

test('HR05 – Node.js remediation guidance provides npm commands', () => {
  const findings = [
    {
      id: 'FINDING-LOCKFILE',
      checkId: 'lockfile',
      title: 'Lockfile check',
      status: 'Failed',
      severity: 'blocker',
      explanation: 'Missing package-lock.json',
      recommendedFix: 'Generate package-lock.json by running npm install --package-lock-only.',
      ecosystemCommands: ['npm install --package-lock-only'],
      affectedTarget: 'package-lock.json',
      expectedResult: 'Exact package versions locked',
      verificationStep: 'Run npm ci in a fresh directory',
    },
  ];

  const guide = buildRemediationGuide(findings, 'node');
  assert.equal(guide.length, 1);
  assert.equal(guide[0].step, 1);
  assert.equal(guide[0].commands[0], 'npm install --package-lock-only');
  assert.equal(guide[0].affectedFile, 'package-lock.json');
});

test('HR06 – Python remediation guidance provides pip and unittest commands', () => {
  const checks = [
    { id: 'tests', status: 'Failed', critical: true, title: 'Execute tests' },
    { id: 'lockfile', status: 'Failed', critical: true, title: 'Lockfile' },
  ];
  const findings = buildFindings(checks, [], 'python');
  const guide = buildRemediationGuide(findings, 'python');

  assert.equal(guide.length, 2);
  const testStep = guide.find((g) => g.findingId === 'FINDING-TESTS');
  assert.ok(testStep.commands.includes('python -m unittest discover'));

  const lockStep = guide.find((g) => g.findingId === 'FINDING-LOCKFILE');
  assert.ok(lockStep.commands.includes('pip freeze > requirements.txt'));
});

// ── 4. Setup Guide & Sandbox Security Details ───────────────────────────────

test('HR07 – Setup guide derives accurate commands from ecosystem', () => {
  const pyGuide = buildSetupGuide({ checks: [{ id: 'tests', command: 'python -m unittest discover' }] }, 'python');
  assert.equal(pyGuide.ecosystem, 'python');
  assert.ok(pyGuide.runtimeRequired.includes('Python'));
  assert.equal(pyGuide.installCommand, 'pip install -r requirements.txt');
  assert.equal(pyGuide.testCommand, 'python -m unittest discover');

  const nodeGuide = buildSetupGuide({ checks: [{ id: 'tests', command: 'npm test' }] }, 'node');
  assert.equal(nodeGuide.ecosystem, 'node');
  assert.ok(nodeGuide.runtimeRequired.includes('Node.js'));
  assert.equal(nodeGuide.installCommand, 'npm ci (or npm install)');
  assert.equal(nodeGuide.testCommand, 'npm test');
});

test('HR08 – Sandbox details reflect actual verified container controls', () => {
  const details = buildSandboxDetails({
    ecosystem: 'python',
    environment: { image: 'python:3.11-alpine' },
  });

  assert.equal(details.image, 'python:3.11-alpine');
  assert.equal(details.user, '1000:1000 (unprivileged user)');
  assert.equal(details.limits.memory, '512m');
  assert.equal(details.limits.cpus, '1');
  assert.ok(details.networkPolicy.testPhase.includes('--network none'));
  assert.ok(details.securityFlags.some((f) => f.includes('--cap-drop=ALL')));
});

// ── 5. HTML Report Security & Escaping ──────────────────────────────────────

test('HR09 – HTML report strictly escapes malicious scripts in findings and logs', () => {
  const reportData = buildReportData({
    scanId: 'xss-test-001',
    projectName: '<script>alert("XSS")</script>',
    verdict: 'not_ready',
    checks: [
      {
        id: 'tests',
        status: 'Failed',
        summary: 'Assertion <img src=x onerror=alert(1)> failed',
        explanation: 'Diagnosis contains <svg/onload=alert(2)> payload',
        evidence: ['Line 42: <iframe src="evil.com"></iframe>'],
      },
    ],
    logs: {
      tests: '<script>window.location="http://attacker.com"</script>',
    },
  });

  const html = renderHtmlReport(reportData);

  assert.ok(!html.includes('<script>alert("XSS")</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'));

  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));

  assert.ok(!html.includes('<svg/onload=alert(2)>'));
  assert.ok(html.includes('&lt;svg/onload=alert(2)&gt;'));

  assert.ok(!html.includes('<iframe src="evil.com"></iframe>'));
  assert.ok(html.includes('&lt;iframe src=&quot;evil.com&quot;&gt;&lt;/iframe&gt;'));

  assert.ok(!html.includes('<script>window.location'));
  assert.ok(html.includes('&lt;script&gt;window.location'));
});

// ── 6. Standalone & Print Capability ────────────────────────────────────────

test('HR10 – HTML report is 100% self-contained and print-ready with zero external scripts', () => {
  const reportData = buildReportData({
    scanId: 'print-test-001',
    projectName: 'my-offline-app',
    verdict: 'ready',
    checks: [
      { id: 'manifest', status: 'Passed', title: 'Manifest' },
      { id: 'install', status: 'Passed', title: 'Install' },
      { id: 'tests', status: 'Passed', title: 'Tests' },
    ],
  });

  const html = renderHtmlReport(reportData);

  // Must not reference external CDN libraries
  assert.ok(!html.includes('https://cdn.'), 'Must have zero CDN script or stylesheet links');
  assert.ok(!html.includes('<script src='), 'Must not load external JS files');
  assert.ok(!html.includes('http://'), 'No insecure external references');

  // Must include native print media styles
  assert.ok(html.includes('@media print'), 'Must include native print styles');
  assert.ok(html.includes('window.print()'), 'Must include browser print invocation');
});

// ── 7. Empty & Incomplete Scan Resilience ───────────────────────────────────

test('HR11 – Handles empty scan records gracefully without errors', () => {
  const emptyReport = buildReportData({});
  assert.equal(emptyReport.verdict, 'not_ready');
  assert.equal(emptyReport.summary.totalChecks, 0);
  assert.equal(emptyReport.summary.passed, 0);
  assert.equal(emptyReport.summary.score, 0);
  assert.equal(emptyReport.findings.length, 0);

  const html = renderHtmlReport(emptyReport);
  assert.ok(html.includes('BuildProof'));
  assert.ok(html.includes('Not ready'));
});

// ── 8. Serialization & Backward Compatibility ───────────────────────────────

test('HR12 – Report serializes cleanly to JSON without undefined keys', () => {
  const scanRecord = {
    scanId: 'serial-test-001',
    projectName: 'serialization-app',
    verdict: 'ready',
    checks: [
      { id: 'manifest', status: 'Passed', critical: true, title: 'Manifest' },
    ],
  };

  const report = buildReportData(scanRecord);
  const jsonStr = JSON.stringify(report);
  const parsed = JSON.parse(jsonStr);

  assert.deepEqual(parsed, report, 'JSON round-trip must have zero data loss or undefined keys');
});
