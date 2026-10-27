/**
 * services/report.js
 *
 * What this file does:
 *   BuildProof Detailed, Judge-Friendly Project Handover Report Engine.
 *   Generates both machine-readable (report.json) and self-contained,
 *   print-ready, judge-friendly HTML (report.html) reports from verified scan evidence.
 *
 * Core Principles:
 *   1. Evidence-based & Honest: Findings are grounded only in actual scan results.
 *      Never invent passes, missing files, or security claims.
 *   2. Plain-English: Every technical check is translated into simple language,
 *      explaining what was detected, why it matters for handover, and how to fix it.
 *   3. Dual-Audience: Accessible to non-technical judges while providing exact
 *      exit codes, commands, and diagnostics for software engineers.
 *   4. Zero External Dependencies: Generated HTML is completely self-contained,
 *      offline-capable, responsive, and print-ready without CDN scripts or CSS.
 *   5. Security First: Complete HTML escaping of untrusted inputs and full path sanitization.
 */

import path from 'path';
import { writeFile, rename, mkdir } from 'fs/promises';
import { updateScan } from './scanStore.js';

// ── HTML Escaping & Sanitization ─────────────────────────────────────────────

/**
 * escapeHtml(str)
 * Safely escapes characters with special meaning in HTML.
 *
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * sanitizePath(p)
 * Strips host-specific Windows drive prefixes or user directories,
 * presenting clean relative or container-generic paths.
 *
 * @param {any} p
 * @returns {string}
 */
export function sanitizePath(p) {
  if (!p) return '';
  return String(p)
    .replace(/^[a-zA-Z]:[\\/].*?[\\/]project[\\/]?/gi, '')
    .replace(/^[a-zA-Z]:[\\/][^\\/]+[\\/]/g, '')
    .replace(/\\/g, '/');
}

// ── Categorization & Plain-English Translation ───────────────────────────────

export const CHECK_CATEGORIES = {
  manifest: 'Dependencies & Manifest',
  lockfile: 'Dependencies & Manifest',
  install: 'Dependencies & Installation',
  'test-script': 'Automated Tests',
  tests: 'Automated Tests',
  readme: 'Documentation & Setup',
  'env-docs': 'Configuration & Environment',
  'runtime-version': 'Project Structure & Runtime',
  'node-version': 'Project Structure & Runtime',
  structure: 'Project Structure',
};

function getCategory(checkId) {
  return CHECK_CATEGORIES[checkId] || 'Project Structure';
}

function getAffectedTarget(check, ecosystem) {
  if (check.id === 'manifest') {
    return ecosystem === 'python' ? 'pyproject.toml / requirements.txt' : 'package.json';
  }
  if (check.id === 'lockfile') {
    return ecosystem === 'python' ? 'requirements.txt (pinned versions)' : 'package-lock.json / yarn.lock';
  }
  if (check.id === 'install') {
    return ecosystem === 'python' ? 'requirements.txt' : 'package.json dependencies';
  }
  if (check.id === 'test-script' || check.id === 'tests') {
    return ecosystem === 'python' ? 'tests/ (unittest discovery)' : 'package.json ("scripts.test")';
  }
  if (check.id === 'readme') {
    return 'README.md';
  }
  if (check.id === 'env-docs') {
    return '.env.example';
  }
  if (check.id === 'runtime-version' || check.id === 'node-version') {
    return ecosystem === 'python' ? '.python-version / pyproject.toml' : '.nvmrc / package.json (engines)';
  }
  return 'Project root configuration';
}

function getPlainEnglishExplanation(check, ecosystem) {
  if (check.explanation) return check.explanation;

  const isPython = ecosystem === 'python';
  switch (check.id) {
    case 'manifest':
      return check.status === 'Passed'
        ? `A valid ${isPython ? 'pyproject.toml or requirements.txt' : 'package.json'} manifest is present, defining the software package identity and external libraries.`
        : `The project manifest (${isPython ? 'pyproject.toml / requirements.txt' : 'package.json'}) is missing or corrupted. The software cannot declare its dependencies.`;

    case 'lockfile':
      return check.status === 'Passed'
        ? `A dependency lockfile is present, guaranteeing that every developer and server installs exact, byte-for-byte identical package versions.`
        : `No dependency lockfile was found. Without a lockfile, future dependency installations may pull newer, untested versions that cause breaking bugs.`;

    case 'install':
      return check.status === 'Passed'
        ? `All declared third-party dependencies downloaded and installed cleanly inside the isolated sandbox container without errors.`
        : `Dependency installation failed during automated build. External libraries could not be resolved or installed.`;

    case 'test-script':
      return check.status === 'Passed'
        ? `The project specifies an automated test execution command or discoverable test suite.`
        : `No automated test suite or test command is configured. The scanner has no way to automatically verify code behavior.`;

    case 'tests':
      return check.status === 'Passed'
        ? `All automated tests ran inside an isolated container sandbox with network access disabled, and every assertion succeeded.`
        : check.status === 'Failed'
        ? `Automated tests ran but failed. At least one test assertion or test process returned an error.`
        : `Tests could not be verified because test execution was either not configured or prevented by an earlier step.`;

    case 'readme':
      return check.status === 'Passed'
        ? `Project documentation (README.md) is present and includes setup or installation guidance for new engineers.`
        : `Documentation is missing or does not contain essential setup instructions, leaving incoming engineers without guidance.`;

    case 'env-docs':
      return check.status === 'Passed'
        ? `The project documents required environment variables via an example template (.env.example) without leaking secret values.`
        : `The application reads environment variables in code but does not provide an example template (.env.example) documenting them.`;

    case 'runtime-version':
    case 'node-version':
      return check.status === 'Passed'
        ? `The project explicitly declares its required ${isPython ? 'Python' : 'Node.js'} runtime version.`
        : `No specific runtime version is pinned. The application may behave inconsistently across different versions.`;

    case 'structure':
      return check.status === 'Passed'
        ? `Project source files and directories are organized in a standard, recognizable layout.`
        : `Project layout is ambiguous or lacks recognizable source structure.`;

    default:
      return check.summary || 'Check evaluation completed.';
  }
}

function getWhyItMatters(check, ecosystem) {
  const isPython = ecosystem === 'python';
  switch (check.id) {
    case 'manifest':
      return 'Without a valid manifest, new developers cannot install dependencies, build the software, or deploy it into production.';
    case 'lockfile':
      return 'Lockfiles eliminate "works on my machine" defects by locking package sub-dependencies to tested versions.';
    case 'install':
      return 'If third-party libraries fail to install, the application cannot run or be tested by incoming maintainers.';
    case 'test-script':
      return 'Automated tests protect against regressions. Without a configured test runner, verification must be done entirely manually.';
    case 'tests':
      return 'Test execution confirms that core business logic works as designed. A test failure indicates a real defect or broken contract.';
    case 'readme':
      return 'Clear setup instructions reduce handover friction, allowing a new team to onboard and run the application in minutes.';
    case 'env-docs':
      return 'Missing environment documentation causes runtime crashes on first launch because incoming developers do not know which variables are needed.';
    case 'runtime-version':
    case 'node-version':
      return `Pinning the runtime version prevents subtle runtime crashes caused by breaking changes between different ${isPython ? 'Python' : 'Node'} versions.`;
    case 'structure':
      return 'Standard structures help new engineers navigate codebases efficiently.';
    default:
      return 'Ensures project maintains predictable engineering handover quality.';
  }
}

function getRecommendedFix(check, ecosystem) {
  const isPython = ecosystem === 'python';
  switch (check.id) {
    case 'manifest':
      return isPython
        ? 'Create a pyproject.toml or requirements.txt listing all required dependencies.'
        : 'Initialize package.json using `npm init -y` and declare all dependencies.';
    case 'lockfile':
      return isPython
        ? 'Pin exact package versions in requirements.txt (e.g. `pip freeze > requirements.txt`).'
        : 'Generate package-lock.json by running `npm install --package-lock-only`.';
    case 'install':
      return isPython
        ? 'Review requirements.txt for incompatible package names or syntax errors, then test `pip install -r requirements.txt`.'
        : 'Check package.json dependencies and run `npm install` locally to resolve version conflicts.';
    case 'test-script':
      return isPython
        ? 'Add automated tests in a `tests/` directory named `test_*.py` using Python standard `unittest` or `pytest`.'
        : 'Add a valid `"test"` script to `package.json` (e.g. `"test": "node --test"` or your testing framework).';
    case 'tests':
      return isPython
        ? 'Inspect the test failure traceback, correct the failing logic or assertion, and rerun `python -m unittest discover`.'
        : 'Inspect the test output, fix the failing test or implementation, and rerun `npm test`.';
    case 'readme':
      return 'Create a README.md file documenting the project description, prerequisites, installation steps, and test commands.';
    case 'env-docs':
      return 'Create a `.env.example` file listing all required variable keys with dummy or descriptive placeholder values (never secrets).';
    case 'runtime-version':
    case 'node-version':
      return isPython
        ? 'Add a `.python-version` file (e.g. `3.11`) or specify `requires-python = ">=3.11"` in pyproject.toml.'
        : 'Add an `.nvmrc` file (e.g. `20`) or specify `"engines": { "node": ">=20" }` in package.json.';
    default:
      return check.nextStep || 'Review the project configuration and resolve reported issues.';
  }
}

function getEcosystemCommands(check, ecosystem) {
  const isPython = ecosystem === 'python';
  switch (check.id) {
    case 'lockfile':
      return isPython ? ['pip freeze > requirements.txt'] : ['npm install --package-lock-only'];
    case 'install':
      return isPython ? ['pip install -r requirements.txt'] : ['npm install', 'npm ci'];
    case 'test-script':
    case 'tests':
      return isPython ? ['python -m unittest discover', 'pytest'] : ['npm test'];
    case 'env-docs':
      return ['cp .env.example .env'];
    default:
      return [];
  }
}

function getExpectedResult(check, ecosystem) {
  switch (check.id) {
    case 'manifest':
      return 'Project manifest parses without syntax errors and declares required packages.';
    case 'lockfile':
      return 'Identical dependency versions are resolved deterministically on all environments.';
    case 'install':
      return 'All external packages install cleanly with exit code 0.';
    case 'test-script':
    case 'tests':
      return 'Test runner executes and all unit/integration tests pass with exit code 0.';
    case 'readme':
      return 'Incoming engineers can successfully install and execute the application following the README.';
    case 'env-docs':
      return 'Application initializes without missing configuration errors.';
    default:
      return 'Verification check passes on subsequent scan.';
  }
}

function getVerificationStep(check, ecosystem) {
  const isPython = ecosystem === 'python';
  switch (check.id) {
    case 'manifest':
    case 'lockfile':
    case 'install':
      return isPython ? 'Run `pip install -r requirements.txt` in a fresh virtualenv.' : 'Run `npm ci` in a fresh directory.';
    case 'test-script':
    case 'tests':
      return isPython ? 'Run `python -m unittest discover` to ensure all tests pass.' : 'Run `npm test` locally to verify 0 failures.';
    case 'readme':
    case 'env-docs':
      return 'Follow the README steps on a clean environment to ensure completeness.';
    default:
      return 'Upload the updated archive to BuildProof to verify resolution.';
  }
}

// ── Finding & Report Section Builders ────────────────────────────────────────

export function buildFindings(checks, warnings = [], ecosystem = 'node') {
  const findings = [];

  for (const c of checks) {
    const isFailed = c.status === 'Failed';
    const isNotVerified = c.status === 'Not Verified';
    const isWarning = c.status === 'Warning';
    const isSkipped = c.status === 'Skipped';
    const isPassed = c.status === 'Passed';

    let severity = 'info';
    let priority = 5;

    if (isFailed && c.critical) {
      severity = 'blocker';
      priority = 1;
    } else if (isFailed) {
      severity = 'high';
      priority = 2;
    } else if ((isNotVerified || isWarning) && c.critical) {
      severity = 'high';
      priority = 2;
    } else if (isNotVerified || isWarning) {
      severity = 'medium';
      priority = 3;
    } else if (isSkipped) {
      severity = 'low';
      priority = 4;
    }

    const blocksHandover = Boolean(isFailed && c.critical);

    findings.push({
      id: `FINDING-${c.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
      checkId: c.id,
      title: c.title || c.name || c.id,
      category: getCategory(c.id),
      status: c.status,
      severity,
      priority,
      blocksHandover,
      detected: c.summary || `${c.title || c.name}: ${c.status}`,
      evidence: Array.isArray(c.evidence) ? c.evidence.map(String) : [],
      explanation: getPlainEnglishExplanation(c, ecosystem),
      whyItMatters: getWhyItMatters(c, ecosystem),
      affectedTarget: getAffectedTarget(c, ecosystem),
      recommendedFix: getRecommendedFix(c, ecosystem),
      ecosystemCommands: getEcosystemCommands(c, ecosystem),
      expectedResult: getExpectedResult(c, ecosystem),
      verificationStep: getVerificationStep(c, ecosystem),
      command: c.command ?? null,
      exitCode: typeof c.exitCode === 'number' ? c.exitCode : null,
      durationMs: typeof c.durationMs === 'number' ? c.durationMs : null,
      logFile: c.logFile ?? null,
    });
  }

  // Sort findings by priority (blockers first, then high, medium, low, info)
  findings.sort((a, b) => a.priority - b.priority);
  return findings;
}

export function buildExecutiveSummary(scanRecord, summary, findings) {
  const verdict = scanRecord.verdict || 'not_ready';
  const ecosystem = scanRecord.ecosystem || scanRecord.scanResult?.ecosystem || 'node';
  const isPython = ecosystem === 'python';

  const blockers = findings.filter((f) => f.blocksHandover);
  const failed = findings.filter((f) => f.status === 'Failed' && !f.blocksHandover);
  const unverified = findings.filter((f) => f.status === 'Not Verified');

  let verdictExplanation = '';
  let nextAction = '';

  if (verdict === 'ready') {
    verdictExplanation = `This project is Ready for Handover. All critical project integrity and sandboxed execution checks passed successfully. Dependencies installed cleanly and automated test execution succeeded inside the isolated ${isPython ? 'Python 3.11' : 'Node.js 20'} container sandbox.`;
    nextAction = 'The project is verified and ready for client or team handover. Proceed with standard deployment or archiving procedures.';
  } else if (verdict === 'not_ready') {
    if (blockers.some((b) => b.checkId === 'tests')) {
      verdictExplanation = 'This project is Not Ready for Handover because its automated test suite failed. Automated tests verify that core code contracts behave as expected; failing assertions represent real or potential defects that must be resolved before acceptance.';
      nextAction = 'Review the failing test diagnostics and stack traces in Section G, repair the failing assertions or code in your local repository, and rescan the project.';
    } else if (blockers.some((b) => b.checkId === 'install')) {
      verdictExplanation = 'This project is Not Ready for Handover because third-party dependencies failed to install inside the clean container sandbox. A project whose dependencies cannot install cannot be run or maintained by incoming developers.';
      nextAction = 'Examine the package manifest and dependency lockfile, resolve missing or conflicting package versions, and verify with a clean install.';
    } else {
      verdictExplanation = 'This project is Not Ready for Handover due to unresolved critical blockers detected during verification.';
      nextAction = 'Address the critical blockers identified in the findings table and resubmit the archive.';
    }
  } else {
    // partially_verified
    verdictExplanation = 'This project is Partially Verified. While core manifests or dependencies may be valid, key verification steps (such as automated tests or essential documentation) could not be verified by the scanner.';
    nextAction = 'Add automated test suites or missing documentation as recommended in the Remediation Guide, then rescan to achieve full verification.';
  }

  return {
    verdict,
    verdictLabel:
      verdict === 'ready'
        ? 'Ready for Handover'
        : verdict === 'not_ready'
        ? 'Not Ready for Handover'
        : 'Partially Verified',
    verdictExplanation,
    nextAction,
    blockingIssues: blockers.map((b) => ({
      findingId: b.id,
      title: b.title,
      detected: b.detected,
      affectedTarget: b.affectedTarget,
    })),
    healthScore: summary.score,
    scoreExplanation: summary.scoreExplanation,
  };
}

export function buildRemediationGuide(findings, ecosystem) {
  const actionable = findings.filter((f) => f.status === 'Failed' || f.status === 'Not Verified' || f.status === 'Warning');
  return actionable.map((f, idx) => ({
    step: idx + 1,
    findingId: f.id,
    title: f.title,
    severity: f.severity,
    issue: f.explanation,
    recommendedFix: f.recommendedFix,
    commands: f.ecosystemCommands,
    affectedFile: f.affectedTarget,
    expectedOutcome: f.expectedResult,
    verification: f.verificationStep,
  }));
}

export function buildChecklist(findings, verdict) {
  return findings.map((f) => ({
    item: f.title,
    category: f.category,
    status: f.status,
    actionNeeded: f.status === 'Passed' ? 'None (Verified)' : f.recommendedFix,
    isComplete: f.status === 'Passed',
    blocksHandover: f.blocksHandover,
  }));
}

export function buildSetupGuide(scanRecord, ecosystem) {
  const isPython = ecosystem === 'python';
  const checks = scanRecord.checks || [];

  const manifestCheck = checks.find((c) => c.id === 'manifest');
  const testCheck = checks.find((c) => c.id === 'tests' || c.id === 'test-script');

  return {
    ecosystem,
    runtimeRequired: isPython ? 'Python >= 3.11' : 'Node.js >= 20.x',
    packageManager: isPython ? 'pip (with venv recommended)' : 'npm (or compatible)',
    installCommand: isPython ? 'pip install -r requirements.txt' : 'npm ci (or npm install)',
    envSetupInstructions: 'Copy .env.example to .env and configure all necessary environment variables.',
    testCommand: testCheck?.command || (isPython ? 'python -m unittest discover' : 'npm test'),
    verificationNote: 'Commands derived from detected project manifests and test configurations.',
  };
}

export function buildSandboxDetails(reportData) {
  const isPython = reportData.ecosystem === 'python';
  return {
    image: reportData.environment?.image || (isPython ? 'python:3.11-alpine' : 'node:20-alpine'),
    runtime: isPython ? 'Python 3.11' : 'Node.js 20',
    user: '1000:1000 (unprivileged user)',
    limits: {
      memory: '512m',
      cpus: '1',
      pidsLimit: 256,
      timeoutSeconds: 120,
    },
    securityFlags: [
      '--cap-drop=ALL (Drops all Linux root capabilities)',
      '--security-opt=no-new-privileges (Blocks privilege escalation)',
      '--read-only root inspection where applicable',
    ],
    networkPolicy: {
      installPhase: 'Limited egress (package registry access only)',
      testPhase: 'none (Network completely severed via --network none)',
    },
    plainEnglishNote:
      'Docker containers are strictly isolated disposable environments. Network access is completely disabled during the test phase to prevent untrusted code from making external network requests or exfiltrating data.',
  };
}

export function buildFinalDecision(reportData, findings) {
  const verdict = reportData.verdict;
  const blockers = findings.filter((f) => f.blocksHandover);
  const warnings = findings.filter((f) => f.status === 'Warning' || f.status === 'Not Verified');

  return {
    verdict,
    verdictLabel: reportData.verdictLabel,
    canSignOff: verdict === 'ready',
    blockersRemaining: blockers.length,
    warningsRemaining: warnings.length,
    signOffRecommendation:
      verdict === 'ready'
        ? 'Approved for handover sign-off. Project satisfies automated reproducibility, dependency hygiene, and unit test contracts.'
        : verdict === 'not_ready'
        ? 'Sign-off rejected. Project contains critical blocking defects that must be repaired before acceptance.'
        : 'Sign-off conditional. Missing tests or documentation should be reviewed manually before formal sign-off.',
    mandatoryPrerequisitesBeforeTransfer:
      blockers.length > 0
        ? blockers.map((b) => b.title)
        : ['Perform client user acceptance validation.'],
  };
}

// ── JSON Report Builder ──────────────────────────────────────────────────────

/**
 * buildReportData(scanRecord)
 * Deterministically constructs a comprehensive handover report object from scan metadata.
 *
 * @param {object} scanRecord - The in-memory or persisted scan record
 * @returns {object} Standardized report object matching ARCHITECTURE.md §6
 */
export function buildReportData(scanRecord = {}) {
  const scanId      = scanRecord.scanId || 'unknown-scan';
  const projectName = scanRecord.projectName ?? null;
  const originalFilename = scanRecord.originalFilename ?? (projectName ? `${projectName}.zip` : null);
  const createdAt   = scanRecord.createdAt ?? null;
  const completedAt = scanRecord.completedAt ?? null;
  const verdict     = scanRecord.verdict || 'not_ready';
  const warnings    = Array.isArray(scanRecord.warnings) ? [...scanRecord.warnings] : [];
  const rawChecks   = Array.isArray(scanRecord.checks) ? scanRecord.checks : [];
  const ecosystem   = scanRecord.ecosystem || scanRecord.scanResult?.ecosystem || 'node';
  const isPython    = ecosystem === 'python';

  // Standardize checks list
  const checks = rawChecks.map((c) => ({
    id: c.id,
    name: c.name || c.title || c.id,
    title: c.title || c.name || c.id,
    status: c.status || 'Not Verified',
    critical: Boolean(c.critical),
    command: c.command ?? null,
    exitCode: typeof c.exitCode === 'number' ? c.exitCode : null,
    durationMs: typeof c.durationMs === 'number' ? c.durationMs : null,
    logFile: c.logFile ?? null,
    summary: c.summary || '',
    explanation: c.explanation || null,
    nextStep: c.nextStep || null,
    evidence: Array.isArray(c.evidence) ? c.evidence.map((e) => String(e)) : [],
  }));

  // Calculate summary counts
  const totalChecks = checks.length;
  const passed = checks.filter((c) => c.status === 'Passed').length;
  const failed = checks.filter((c) => c.status === 'Failed').length;
  const notVerified = checks.filter((c) => c.status === 'Not Verified').length;
  const skipped = checks.filter((c) => c.status === 'Skipped').length;

  // Defensible Handover Quality Score (0 to 100)
  // Transparent calculation: Percentage of total evaluated checks that passed.
  // Missing or unverified checks receive 0 points.
  const score = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 0;
  const scoreExplanation = 'Handover Health Score represents the percentage of verified checks that passed cleanly. Missing, unverified, or skipped checks contribute 0 points. This metric is distinct from the readiness verdict: any critical check failure blocks handover regardless of score.';

  const summary = {
    totalChecks,
    passed,
    failed,
    notVerified,
    skipped,
    score,
    scoreExplanation,
  };

  const verdictLabels = {
    ready: 'Ready for handover',
    not_ready: 'Not ready',
    partially_verified: 'Partially verified',
  };

  const findings = buildFindings(checks, warnings, ecosystem);
  const executiveSummary = buildExecutiveSummary(scanRecord, summary, findings);
  const remediationGuide = buildRemediationGuide(findings, ecosystem);
  const checklist = buildChecklist(findings, verdict);
  const setupGuide = buildSetupGuide(scanRecord, ecosystem);

  // Extract raw logs if present on scanRecord
  const logs = {
    install: scanRecord.logs?.install || null,
    tests: scanRecord.logs?.tests || null,
  };

  const environment = {
    image: scanRecord.environment?.image || (isPython ? 'python:3.11-alpine' : 'node:20-alpine'),
    ...(isPython ? { python: '3.11' } : { node: '20' }),
    limits: {
      memory: '512m',
      cpus: '1',
      timeoutSeconds: 120,
    },
    networkPolicy: {
      install: isPython ? 'default (PyPI registry access)' : 'default (npm registry access)',
      tests: 'none (network isolated)',
    },
  };

  const projectOverview = {
    originalFilename,
    projectName,
    ecosystem,
    runtimeVersion: isPython ? 'Python 3.11' : 'Node.js 20',
    manifestDetected: checks.find((c) => c.id === 'manifest')?.status === 'Passed',
    lockfileDetected: checks.find((c) => c.id === 'lockfile')?.status === 'Passed',
    testSuiteConfigured: checks.find((c) => c.id === 'test-script')?.status === 'Passed',
    documentationPresent: checks.find((c) => c.id === 'readme')?.status === 'Passed',
    environmentTemplatePresent: checks.find((c) => c.id === 'env-docs')?.status === 'Passed',
  };

  const sandboxDetails = buildSandboxDetails({ ecosystem, environment });
  const finalDecision = buildFinalDecision({ verdict, verdictLabel: verdictLabels[verdict] || verdict }, findings);

  return {
    schemaVersion: '1.0.0',
    scanId,
    projectName,
    createdAt,
    completedAt,
    status: 'done',
    verdict,
    verdictLabel: verdictLabels[verdict] || verdict,
    ecosystem,
    environment,
    summary,
    checks,
    warnings,
    disclaimer: 'A passing check does not prove software is bug-free, secure, or compatible with every machine.',

    // Extended Handover Report Sections
    executiveSummary,
    projectOverview,
    findings,
    remediationGuide,
    checklist,
    setupGuide,
    sandboxDetails,
    finalDecision,
    logs,
  };
}

// ── HTML Report Generator ───────────────────────────────────────────────────

/**
 * renderHtmlReport(reportData)
 * Generates a completely self-contained, professional, print-ready HTML handover report.
 * Uses semantic markup, accessible status symbols, native expandable details, and zero external dependencies.
 *
 * @param {object} reportData - Object returned by buildReportData
 * @returns {string} Standalone HTML document string
 */
export function renderHtmlReport(reportData) {
  const {
    scanId,
    projectName,
    createdAt,
    completedAt,
    verdict,
    verdictLabel,
    ecosystem,
    summary,
    checks,
    warnings,
    disclaimer,
    environment,
    executiveSummary,
    projectOverview,
    findings,
    remediationGuide,
    checklist,
    setupGuide,
    sandboxDetails,
    finalDecision,
    logs,
  } = reportData;

  const isPython = ecosystem === 'python';
  const displayProjectName = projectName ? escapeHtml(projectName) : 'Project Archive';
  const formattedDate = completedAt
    ? escapeHtml(completedAt.replace('T', ' ').slice(0, 19)) + ' UTC'
    : 'Not recorded';

  // Verdict Theme Configuration
  const verdictThemes = {
    ready: {
      bg: '#ecfdf5',
      border: '#059669',
      badgeBg: '#059669',
      badgeText: '#ffffff',
      titleColor: '#065f46',
      icon: '✔',
      subtext: 'Passed All Handover Criteria',
    },
    not_ready: {
      bg: '#fef2f2',
      border: '#dc2626',
      badgeBg: '#dc2626',
      badgeText: '#ffffff',
      titleColor: '#991b1b',
      icon: '✖',
      subtext: 'Critical Blocker Detected — Handover Blocked',
    },
    partially_verified: {
      bg: '#fffbeb',
      border: '#d97706',
      badgeBg: '#d97706',
      badgeText: '#ffffff',
      titleColor: '#92400e',
      icon: '⚠',
      subtext: 'Manual Verification Required Before Handover',
    },
  };

  const vTheme = verdictThemes[verdict] || verdictThemes.not_ready;

  function renderStatusBadge(status) {
    let bg = '#6b7280';
    let text = '#ffffff';
    let icon = '○';

    if (status === 'Passed') {
      bg = '#059669';
      icon = '✔';
    } else if (status === 'Failed') {
      bg = '#dc2626';
      icon = '✖';
    } else if (status === 'Not Verified') {
      bg = '#d97706';
      icon = '⚠';
    } else if (status === 'Warning') {
      bg = '#b45309';
      icon = '⚠';
    } else if (status === 'Skipped') {
      bg = '#4b5563';
      icon = '⊘';
    }

    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;font-size:11px;font-weight:700;border-radius:12px;background-color:${bg};color:${text};text-transform:uppercase;letter-spacing:0.04em;">
      <span aria-hidden="true">${icon}</span> ${escapeHtml(status)}
    </span>`;
  }

  function renderSeverityBadge(severity) {
    let bg = '#f3f4f6';
    let color = '#374151';
    let border = '#d1d5db';

    if (severity === 'blocker') {
      bg = '#fef2f2';
      color = '#991b1b';
      border = '#f87171';
    } else if (severity === 'high') {
      bg = '#fff7ed';
      color = '#c2410c';
      border = '#fb923c';
    } else if (severity === 'medium') {
      bg = '#fffbeb';
      color = '#b45309';
      border = '#fde68a';
    }

    return `<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;border-radius:4px;background:${bg};color:${color};border:1px solid ${border};">
      ${escapeHtml(severity)}
    </span>`;
  }

  // Group checks by category
  const categoriesMap = new Map();
  for (const c of checks) {
    const cat = getCategory(c.id);
    if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
    categoriesMap.get(cat).push(c);
  }

  // Render Check Card
  function renderCheckCard(c) {
    const isFailed = c.status === 'Failed';
    const isNotVerified = c.status === 'Not Verified';
    const borderColor = isFailed ? '#fca5a5' : isNotVerified ? '#fde68a' : '#e5e7eb';
    const cardBg = isFailed ? '#fff5f5' : isNotVerified ? '#fffdf7' : '#ffffff';

    let detailsHtml = '';

    if (c.command) {
      detailsHtml += `<div style="margin-top:8px;font-size:12px;color:#4b5563;background:#f9fafb;padding:8px 12px;border-radius:6px;border:1px solid #e5e7eb;">
        <strong>Command:</strong> <code style="font-family:monospace;color:#1f2937;">${escapeHtml(c.command)}</code>`;
      if (c.exitCode !== null) {
        detailsHtml += ` &bull; <strong>Exit Code:</strong> <span style="font-weight:bold;color:${c.exitCode === 0 ? '#059669' : '#dc2626'}">${escapeHtml(c.exitCode)}</span>`;
      }
      if (c.durationMs !== null) {
        detailsHtml += ` &bull; <strong>Duration:</strong> ${(c.durationMs / 1000).toFixed(2)}s`;
      }
      detailsHtml += `</div>`;
    }

    if (c.explanation) {
      detailsHtml += `<div style="margin-top:8px;padding:8px 12px;background:#f8fafc;border-left:4px solid #3b82f6;border-radius:4px;font-size:12px;color:#1e3a8a;">
        <strong>Plain-English Diagnosis:</strong> ${escapeHtml(c.explanation)}
      </div>`;
    }

    if (c.nextStep) {
      detailsHtml += `<div style="margin-top:6px;padding:8px 12px;background:#f0fdf4;border-left:4px solid #059669;border-radius:4px;font-size:12px;color:#166534;">
        <strong>Suggested Action:</strong> ${escapeHtml(c.nextStep)}
      </div>`;
    }

    let evidenceList = '';
    if (c.evidence && c.evidence.length > 0) {
      evidenceList = `
        <div style="margin-top:8px;">
          <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Observed Evidence:</span>
          <ul style="margin:4px 0 0 0;padding-left:18px;font-size:12px;color:#4b5563;">
            ${c.evidence.map((ev) => `<li style="margin-bottom:2px;">${escapeHtml(ev)}</li>`).join('')}
          </ul>
        </div>`;
    }

    return `
      <div style="border:1px solid ${borderColor};background:${cardBg};border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px;">
          <div>
            <h4 style="margin:0;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(c.title || c.name)}</h4>
            <p style="margin:2px 0 0 0;font-size:13px;color:#4b5563;">${escapeHtml(c.summary)}</p>
          </div>
          <div>${renderStatusBadge(c.status)}</div>
        </div>
        ${detailsHtml}
        ${evidenceList}
      </div>`;
  }

  // Findings Rows
  const findingsRowsHtml = findings.map((f) => {
    return `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#111827;">
          ${escapeHtml(f.title)}
          <div style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:2px;">${escapeHtml(f.affectedTarget)}</div>
        </td>
        <td style="padding:10px 12px;font-size:12px;">${renderStatusBadge(f.status)}</td>
        <td style="padding:10px 12px;font-size:12px;">${renderSeverityBadge(f.severity)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#374151;">
          <div>${escapeHtml(f.explanation)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;"><strong>Impact:</strong> ${escapeHtml(f.whyItMatters)}</div>
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#047857;">
          ${escapeHtml(f.recommendedFix)}
        </td>
      </tr>`;
  }).join('');

  // Remediation Steps
  const remediationHtml = remediationGuide.length > 0
    ? remediationGuide.map((step) => `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;background:#ffffff;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:#111827;color:#ffffff;border-radius:50%;font-size:12px;font-weight:700;">${step.step}</span>
          <h4 style="margin:0;font-size:14px;color:#111827;">${escapeHtml(step.title)}</h4>
          ${renderSeverityBadge(step.severity)}
        </div>
        <p style="margin:0 0 8px 0;font-size:13px;color:#4b5563;">${escapeHtml(step.issue)}</p>
        <div style="background:#f9fafb;border-left:3px solid #059669;padding:8px 12px;border-radius:4px;font-size:12px;margin-bottom:8px;">
          <strong>Action:</strong> ${escapeHtml(step.recommendedFix)}
        </div>
        ${step.commands.length > 0 ? `
          <div style="margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Suggested Command(s):</span>
            ${step.commands.map((cmd) => `<pre style="margin:4px 0;background:#1e293b;color:#f8fafc;padding:8px 12px;border-radius:6px;font-size:12px;overflow-x:auto;"><code>${escapeHtml(cmd)}</code></pre>`).join('')}
          </div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;color:#6b7280;margin-top:8px;">
          <div><strong>Expected Outcome:</strong> ${escapeHtml(step.expectedOutcome)}</div>
          <div><strong>Verification:</strong> ${escapeHtml(step.verification)}</div>
        </div>
      </div>
    `).join('')
    : '<div style="padding:16px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;color:#065f46;font-size:13px;">No repairs or remediations are required. The project passed all automated checks.</div>';

  // Checklist Items
  const checklistHtml = checklist.map((item) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;border:2px solid ${item.isComplete ? '#059669' : '#d1d5db'};background:${item.isComplete ? '#059669' : 'transparent'};color:#ffffff;font-size:12px;font-weight:700;">
          ${item.isComplete ? '✔' : ''}
        </span>
        <span style="font-weight:600;color:${item.isComplete ? '#111827' : '#991b1b'};">${escapeHtml(item.item)}</span>
      </div>
      <div>
        ${renderStatusBadge(item.status)}
      </div>
    </div>
  `).join('');

  // Expandable Logs Section
  const installLogHtml = logs?.install
    ? `<details style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;overflow:hidden;">
        <summary style="padding:10px 14px;background:#f8fafc;font-size:13px;font-weight:600;color:#334155;cursor:pointer;">
          Dependency Installation Log (stdout/stderr)
        </summary>
        <pre style="margin:0;padding:14px;background:#0f172a;color:#f8fafc;font-size:11px;line-height:1.4;overflow-x:auto;max-height:300px;"><code>${escapeHtml(logs.install)}</code></pre>
      </details>`
    : '';

  const testsLogHtml = logs?.tests
    ? `<details style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;overflow:hidden;">
        <summary style="padding:10px 14px;background:#f8fafc;font-size:13px;font-weight:600;color:#334155;cursor:pointer;">
          Automated Test Execution Log (Isolated Sandbox stdout/stderr)
        </summary>
        <pre style="margin:0;padding:14px;background:#0f172a;color:#f8fafc;font-size:11px;line-height:1.4;overflow-x:auto;max-height:300px;"><code>${escapeHtml(logs.tests)}</code></pre>
      </details>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BuildProof Project Handover Report — ${displayProjectName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      background-color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 980px;
      margin: 40px auto;
      padding: 0 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      padding: 24px;
      margin-bottom: 24px;
    }
    h2.section-title {
      margin-top: 0;
      margin-bottom: 16px;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 8px;
    }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .print-button {
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .print-button:hover {
      background: #334155;
    }
    @media print {
      body { background: #ffffff; font-size: 12px; }
      .container { max-width: 100%; margin: 0; padding: 0; }
      .card { border: 1px solid #cbd5e1; box-shadow: none; margin-bottom: 16px; padding: 16px; page-break-inside: avoid; }
      .no-print { display: none !important; }
      details { display: block !important; }
      details[open] summary ~ * { display: block !important; }
      details summary { display: none !important; }
    }
    @media (max-width: 640px) {
      .container { margin: 16px auto; padding: 0 12px; }
      .card { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- Header / Brand -->
    <header style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
      <div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #111827;">BuildProof</h1>
        <p style="margin: 2px 0 0 0; font-size: 14px; color: #6b7280;">Project Handover Readiness Checker</p>
      </div>
      <div style="text-align: right;" class="no-print">
        <button class="print-button" onclick="window.print()">
          <span>🖨 Print / Save as PDF</span>
        </button>
        <div style="margin-top:4px;font-size:12px;color:#6b7280;">${formattedDate}</div>
      </div>
    </header>

    <!-- Executive Summary / Verdict Banner -->
    <div style="background: ${vTheme.bg}; border: 2px solid ${vTheme.border}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${vTheme.badgeBg};color:#ffffff;font-size:14px;font-weight:bold;">${vTheme.icon}</span>
            <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${vTheme.titleColor};">
              Handover Verdict &bull; ${vTheme.subtext}
            </span>
          </div>
          <h2 style="margin: 0; font-size: 28px; font-weight: 900; color: ${vTheme.titleColor}; letter-spacing:-0.01em;">
            ${escapeHtml(verdictLabel)}
          </h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">
            Project: <strong>${displayProjectName}</strong> &bull; Ecosystem: <strong style="text-transform:capitalize;">${escapeHtml(ecosystem)}</strong> &bull; Scan ID: <code style="font-size: 12px; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 3px;">${escapeHtml(scanId)}</code>
          </p>
        </div>
        <div style="background:#ffffff;border:1px solid ${vTheme.border};border-radius:8px;padding:12px 18px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Handover Score</div>
          <div style="font-size:28px;font-weight:900;color:${vTheme.titleColor};line-height:1;">${summary.score}%</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">${summary.passed} of ${summary.totalChecks} Checks Passed</div>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(0,0,0,0.08); font-size: 14px; color: #334155; line-height: 1.6;">
        <p style="margin:0 0 8px 0;"><strong>Executive Assessment:</strong> ${escapeHtml(executiveSummary.verdictExplanation)}</p>
        <p style="margin:0;font-size:13px;color:#475569;"><strong>Next Action:</strong> ${escapeHtml(executiveSummary.nextAction)}</p>
      </div>
    </div>

    <!-- Metrics Summary Cards -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div class="card" style="margin: 0; text-align: center; border-top: 4px solid #059669;">
        <div style="font-size: 30px; font-weight: 800; color: #059669;">${summary.passed}</div>
        <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Passed</div>
      </div>
      <div class="card" style="margin: 0; text-align: center; border-top: 4px solid #dc2626;">
        <div style="font-size: 30px; font-weight: 800; color: #dc2626;">${summary.failed}</div>
        <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Failed</div>
      </div>
      <div class="card" style="margin: 0; text-align: center; border-top: 4px solid #d97706;">
        <div style="font-size: 30px; font-weight: 800; color: #d97706;">${summary.notVerified}</div>
        <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Not Verified</div>
      </div>
    </div>

    <!-- Warnings Section (if any) -->
    ${warnings.length > 0 ? `
      <section style="margin-bottom:28px;">
        <h2 style="font-size:18px;color:#92400e;margin-bottom:12px;border-bottom:1px solid #fde68a;padding-bottom:6px;">Observations &amp; Warnings</h2>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px;">
          <ul style="margin:0;padding-left:20px;font-size:14px;color:#b45309;">
            ${warnings.map((w) => `<li style="margin-bottom:4px;">${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>
      </section>` : ''}

    <!-- Section B: Project Overview Facts Table -->
    <section class="card">
      <h2 class="section-title"><span>📋</span> Verified Project Overview</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; width: 35%;">Uploaded Project File</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${escapeHtml(projectOverview.originalFilename || displayProjectName)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Ecosystem &amp; Adapter</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">
              <span style="text-transform: capitalize;">${escapeHtml(ecosystem)}</span> (${isPython ? 'Python PEP 517/621 & unittest Adapter' : 'Node.js npm/package.json Adapter'})
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Target Runtime</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${escapeHtml(projectOverview.runtimeVersion)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Isolated Sandbox Image</td>
            <td style="padding: 8px 0; font-weight: 600; font-family: monospace; color: #0f172a;">${escapeHtml(environment.image)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Manifest Status</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${projectOverview.manifestDetected ? '✔ Present and Parsed' : '✖ Missing / Corrupted'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Lockfile Status</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${projectOverview.lockfileDetected ? '✔ Present (Deterministic versions)' : '⚠ Missing (Non-deterministic installation)'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Automated Test Suite</td>
            <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${projectOverview.testSuiteConfigured ? '✔ Configured & Discovered' : '⚠ None Configured'}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Section E: Missing Items and Findings Table -->
    <section class="card">
      <h2 class="section-title"><span>🔍</span> Prioritized Findings &amp; Technical Diagnoses</h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
        Technical findings prioritized by severity. Critical blockers prevent clean handover sign-off.
      </p>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; color: #64748b;">
              <th style="padding: 10px 12px;">Finding / Target</th>
              <th style="padding: 10px 12px;">Status</th>
              <th style="padding: 10px 12px;">Severity</th>
              <th style="padding: 10px 12px;">Plain-English Explanation &amp; Impact</th>
              <th style="padding: 10px 12px;">Action Needed</th>
            </tr>
          </thead>
          <tbody>
            ${findingsRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Section F: Detailed Remediation Guide -->
    <section class="card">
      <h2 class="section-title"><span>🛠</span> Step-by-Step Remediation Guide</h2>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
        Actionable instructions tailored to the <strong>${escapeHtml(ecosystem)}</strong> ecosystem to repair detected issues before transferring code.
      </p>
      ${remediationHtml}
    </section>

    <!-- Docker Verification Section -->
    <section class="card">
      <h2 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
        Docker Container Verification (Sandbox)
      </h2>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
        Executed inside disposable container sandbox (<code style="background:#f3f4f6;padding:2px 4px;border-radius:3px;">${escapeHtml(environment.image)}</code>) with resource caps (512MB RAM, 1 CPU). Testing phase executed with network isolation (<code style="background:#f3f4f6;padding:2px 4px;border-radius:3px;">--network none</code>).
      </p>
      ${checks.filter((c) => ['install', 'tests'].includes(c.id)).map(renderCheckCard).join('')}
    </section>

    <!-- Static Project Analysis Section -->
    <section class="card">
      <h2 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
        Static Project Inspection
      </h2>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
        File-level structure and manifest inspections conducted prior to sandbox execution without running project code.
      </p>
      ${checks.filter((c) => !['install', 'tests'].includes(c.id)).map(renderCheckCard).join('')}
    </section>

    <!-- Section D: Complete Check-by-Check Results Grouped by Category -->
    <section class="card">
      <h2 class="section-title"><span>📊</span> Comprehensive Check-by-Check Results</h2>
      ${Array.from(categoriesMap.entries()).map(([category, catChecks]) => `
        <div style="margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; border-left: 3px solid #64748b; padding-left: 8px;">
            ${escapeHtml(category)} (${catChecks.length})
          </h3>
          ${catChecks.map(renderCheckCard).join('')}
        </div>
      `).join('')}
    </section>

    <!-- Section G: Execution Logs & Evidence -->
    <section class="card">
      <h2 class="section-title"><span>📜</span> Execution Logs &amp; Sandbox Evidence</h2>
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748b;">
        Real outputs captured inside the isolated container sandbox. Sensitive environment variables are masked.
      </p>
      ${installLogHtml}
      ${testsLogHtml}
      ${!logs?.install && !logs?.tests ? '<div style="font-size:13px;color:#64748b;font-style:italic;">No sandbox logs were generated or required for this evaluation.</div>' : ''}
    </section>

    <!-- Section H: Runtime & Sandbox Security Controls -->
    <section class="card">
      <h2 class="section-title"><span>🛡</span> Runtime &amp; Sandbox Security Controls</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:14px;font-size:13px;color:#334155;line-height:1.6;">
        <p style="margin:0 0 8px 0;"><strong>Security Architecture:</strong> ${escapeHtml(sandboxDetails.plainEnglishNote)}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#64748b;width:35%;">Container Image</td>
            <td style="padding:8px 0;font-family:monospace;font-weight:600;">${escapeHtml(sandboxDetails.image)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#64748b;">Process Identity</td>
            <td style="padding:8px 0;font-weight:600;">${escapeHtml(sandboxDetails.user)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#64748b;">Resource Quotas</td>
            <td style="padding:8px 0;font-weight:600;">Memory: ${escapeHtml(sandboxDetails.limits.memory)} &bull; CPUs: ${escapeHtml(sandboxDetails.limits.cpus)} &bull; PIDs: ${escapeHtml(sandboxDetails.limits.pidsLimit)} &bull; Timeout: ${escapeHtml(sandboxDetails.limits.timeoutSeconds)}s</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#64748b;">Test Network Policy</td>
            <td style="padding:8px 0;font-weight:700;color:#059669;">${escapeHtml(sandboxDetails.networkPolicy.testPhase)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;">Privilege Containment</td>
            <td style="padding:8px 0;font-size:12px;color:#475569;">
              ${sandboxDetails.securityFlags.map((flag) => `<div>&bull; ${escapeHtml(flag)}</div>`).join('')}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Section J: New Developer Reproduction Setup Guide -->
    <section class="card">
      <h2 class="section-title"><span>🚀</span> Incoming Maintainer Quickstart Guide</h2>
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748b;">
        Verified baseline commands for another engineer to reproduce and run this project locally:
      </p>
      <div style="display:grid;gap:12px;font-size:13px;">
        <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;">
          <strong>1. Prerequisites:</strong> Ensure ${escapeHtml(setupGuide.runtimeRequired)} and ${escapeHtml(setupGuide.packageManager)} are installed.
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;">
          <strong>2. Install Dependencies:</strong>
          <pre style="margin:6px 0 0 0;background:#1e293b;color:#f8fafc;padding:8px 12px;border-radius:6px;font-size:12px;"><code>${escapeHtml(setupGuide.installCommand)}</code></pre>
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;">
          <strong>3. Environment Setup:</strong> ${escapeHtml(setupGuide.envSetupInstructions)}
        </div>
        <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;">
          <strong>4. Execute Automated Tests:</strong>
          <pre style="margin:6px 0 0 0;background:#1e293b;color:#f8fafc;padding:8px 12px;border-radius:6px;font-size:12px;"><code>${escapeHtml(setupGuide.testCommand)}</code></pre>
        </div>
      </div>
    </section>

    <!-- Section I: Handover Checklist -->
    <section class="card">
      <h2 class="section-title"><span>☑</span> Project-Specific Handover Checklist</h2>
      <div style="border:1px solid #e2e8f0;border-radius:8px;background:#ffffff;overflow:hidden;">
        ${checklistHtml}
      </div>
    </section>

    <!-- Section K: Final Handover Decision -->
    <div style="background: #ffffff; border: 2px solid ${vTheme.border}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="margin-top: 0; font-size: 20px; font-weight: 800; color: ${vTheme.titleColor};">
        Final Handover Decision: ${escapeHtml(verdictLabel)}
      </h2>
      <p style="font-size: 14px; color: #334155; margin: 0 0 12px 0;">
        ${escapeHtml(finalDecision.signOffRecommendation)}
      </p>
      <div style="background: ${vTheme.bg}; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: ${vTheme.titleColor};">
        <strong>Sign-off Prerequisites:</strong>
        <ul style="margin: 6px 0 0 0; padding-left: 20px;">
          ${finalDecision.mandatoryPrerequisitesBeforeTransfer.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    </div>

    <!-- Footer & Disclaimer -->
    <footer style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #64748b;">
      <p style="margin: 0 0 6px 0;">
        <strong>Disclaimer:</strong> ${escapeHtml(disclaimer)}
      </p>
      <p style="margin: 0; color: #94a3b8;">
        BuildProof Project Handover Verification System &bull; Scan ID: ${escapeHtml(scanId)}
      </p>
    </footer>

  </div>
</body>
</html>`;
}

// ── Report Persistence Service ───────────────────────────────────────────────

/**
 * generateReports(scanId, scanDir, scanRecord)
 *
 * Builds report data, renders HTML, and writes both report.json and report.html
 * atomically to the scan directory.
 *
 * @param {string} scanId       - The unique scan identifier
 * @param {string} scanDir      - The absolute path to server/data/scans/<scanId>
 * @param {object} scanRecord   - The scan state object from scanStore
 * @returns {Promise<{ reportData: object, jsonPath: string, htmlPath: string }>}
 */
export async function generateReports(scanId, scanDir, scanRecord) {
  if (!scanId || typeof scanId !== 'string') {
    throw new Error('Invalid scanId provided to report generator');
  }

  // Reject path traversal characters in scanId
  if (scanId.includes('..') || scanId.includes('/') || scanId.includes('\\')) {
    throw new Error('Invalid scanId: path traversal characters detected');
  }

  const resolvedScanDir = path.resolve(scanDir);
  await mkdir(resolvedScanDir, { recursive: true });

  const completedAt = new Date().toISOString();
  const reportData = buildReportData({
    ...scanRecord,
    scanId,
    completedAt,
  });

  const jsonContent = JSON.stringify(reportData, null, 2);
  const htmlContent = renderHtmlReport(reportData);

  const jsonPath = path.join(resolvedScanDir, 'report.json');
  const htmlPath = path.join(resolvedScanDir, 'report.html');

  const jsonTmp = path.join(resolvedScanDir, `report.json.tmp.${Date.now()}`);
  const htmlTmp = path.join(resolvedScanDir, `report.html.tmp.${Date.now()}`);

  // Atomic write via temporary file + rename
  await writeFile(jsonTmp, jsonContent, 'utf8');
  await rename(jsonTmp, jsonPath);

  await writeFile(htmlTmp, htmlContent, 'utf8');
  await rename(htmlTmp, htmlPath);

  // Update in-memory scan store to mark scan as completely done
  updateScan(scanId, {
    status: 'done',
    stage: 'done',
    completedAt,
    reports: {
      json: 'report.json',
      html: 'report.html',
    },
    reportData,
  });

  return {
    reportData,
    jsonPath,
    htmlPath,
  };
}
