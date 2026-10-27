/**
 * services/scanner.js
 *
 * What this file does:
 *   Performs static inspection on an already safely extracted project directory
 *   and produces structured, evidence-based check results.
 *
 * How it fits into BuildProof:
 *   This is Milestone M2 of the build roadmap (ARCHITECTURE.md §5.3, §12).
 *   After a ZIP is uploaded and safely extracted (Step 4), this scanner runs
 *   before any Docker execution. It inspects project files to verify whether
 *   the handover package meets basic readiness criteria.
 *
 * Security guarantees (ARCHITECTURE.md §9):
 *   - NEVER executes uploaded project code.
 *   - NEVER spawns node/npm processes or shell commands.
 *   - NEVER starts Docker containers or connects to the network.
 *   - NEVER modifies uploaded files.
 *   - NEVER follows symbolic links.
 *   - NEVER inspects files outside the specified project directory (containment check).
 *   - Limits file read size and directory traversal depth to prevent DoS.
 *   - Strips and suppresses secrets, credentials, and raw environment values.
 *
 * Check statuses used (ARCHITECTURE.md §1):
 *   - "Passed": Stated requirement was confirmed.
 *   - "Failed": Stated requirement was checked and did not meet requirements.
 *   - "Not Verified": Static inspection cannot reliably establish the result.
 */

import path from 'path';
import { readdir, lstat, open } from 'fs/promises';
import { resolveAdapter, ECOSYSTEMS } from './adapters/index.js';

// ── Resource and security limits ─────────────────────────────────────────────
const MAX_FILE_READ_BYTES = 64 * 1024;    // 64 KB max for text files (package.json, README, .env.example)
const MAX_SEARCH_FILES    = 150;          // max files to inspect for process.env search
const MAX_SEARCH_DEPTH    = 3;            // max subdirectory depth for source code search

// Directories skipped during source file searches
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  'coverage',
]);

// ── Safe file reading helpers ────────────────────────────────────────────────

/**
 * checkContainment(targetPath, rootDir)
 * Confirms that targetPath resolves strictly within rootDir.
 *
 * @param {string} targetPath
 * @param {string} rootDir
 * @returns {boolean}
 */
export function checkContainment(targetPath, rootDir) {
  if (!targetPath || !rootDir) return false;
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(resolvedRoot + path.sep)
  );
}

/**
 * safeReadText(filePath, rootDir, maxBytes = MAX_FILE_READ_BYTES)
 * Reads up to maxBytes of a text file, strictly checking containment and
 * refusing to follow symbolic links.
 *
 * @param {string} filePath - Absolute path to file
 * @param {string} rootDir  - Project root directory (containment boundary)
 * @param {number} maxBytes - Maximum bytes to read
 * @returns {Promise<string|null>} File contents or null if unreadable/unsafe
 */
async function safeReadText(filePath, rootDir, maxBytes = MAX_FILE_READ_BYTES) {
  if (!checkContainment(filePath, rootDir)) {
    return null;
  }

  let handle;
  try {
    const stats = await lstat(filePath);
    // Never follow symlinks; only read regular files
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return null;
    }

    handle = await open(filePath, 'r');
    const bytesToRead = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    return buffer.toString('utf8', 0, bytesRead);
  } catch {
    return null;
  } finally {
    if (handle) {
      try { await handle.close(); } catch (_) {}
    }
  }
}

/**
 * safeListRoot(rootDir)
 * Reads top-level entries in rootDir without following symlinks.
 *
 * @param {string} rootDir
 * @returns {Promise<Array<{ name: string, isFile: boolean, isDir: boolean, isSymlink: boolean }>>}
 */
async function safeListRoot(rootDir) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    return entries.map((dirent) => ({
      name: dirent.name,
      isFile: dirent.isFile(),
      isDir: dirent.isDirectory(),
      isSymlink: dirent.isSymbolicLink(),
    }));
  } catch {
    return [];
  }
}

// ── Check A: Project manifest (package.json) ─────────────────────────────────

async function checkManifest(rootDir, rootEntries) {
  const hasPkgFile = rootEntries.some(
    (e) => e.name.toLowerCase() === 'package.json' && e.isFile && !e.isSymlink
  );

  if (!hasPkgFile) {
    return {
      check: {
        id: 'manifest',
        name: 'Package manifest',
        critical: true,
        status: 'Failed',
        summary: 'package.json was not found in the project root.',
        evidence: ['package.json is missing from the project root'],
      },
      manifest: null,
    };
  }

  const pkgPath = path.join(rootDir, 'package.json');
  const content = await safeReadText(pkgPath, rootDir);

  if (content === null) {
    return {
      check: {
        id: 'manifest',
        name: 'Package manifest',
        critical: true,
        status: 'Failed',
        summary: 'package.json is not accessible or is a symbolic link.',
        evidence: ['package.json could not be read safely'],
      },
      manifest: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    const safeError = err.message ? err.message.split('\n')[0] : 'Syntax error';
    return {
      check: {
        id: 'manifest',
        name: 'Package manifest',
        critical: true,
        status: 'Failed',
        summary: 'package.json contains malformed or invalid JSON.',
        evidence: [
          'package.json exists but failed to parse as valid JSON',
          `Parser error: ${safeError}`,
        ],
      },
      manifest: null,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      check: {
        id: 'manifest',
        name: 'Package manifest',
        critical: true,
        status: 'Failed',
        summary: 'package.json top-level value must be a JSON object.',
        evidence: ['package.json does not contain a JSON object'],
      },
      manifest: null,
    };
  }

  const pkgName = typeof parsed.name === 'string' && parsed.name.trim() !== ''
    ? parsed.name.trim()
    : null;
  const pkgVersion = typeof parsed.version === 'string' && parsed.version.trim() !== ''
    ? parsed.version.trim()
    : null;
  const scriptKeys = parsed.scripts && typeof parsed.scripts === 'object'
    ? Object.keys(parsed.scripts)
    : [];

  const evidence = ['package.json exists and is valid JSON'];
  if (pkgName) {
    evidence.push(`Package name: ${pkgName}${pkgVersion ? ` (v${pkgVersion})` : ''}`);
  }
  if (scriptKeys.length > 0) {
    evidence.push(`Scripts declared: ${scriptKeys.join(', ')}`);
  } else {
    evidence.push('No scripts declared');
  }

  return {
    check: {
      id: 'manifest',
      name: 'Package manifest',
      critical: true,
      status: 'Passed',
      summary: 'A valid package.json manifest was found.',
      evidence,
    },
    manifest: parsed,
  };
}

// ── Check B: Lockfile presence ────────────────────────────────────────────────

function checkLockfile(rootEntries) {
  const LOCKFILE_CANDIDATES = [
    { file: 'package-lock.json', manager: 'npm' },
    { file: 'npm-shrinkwrap.json', manager: 'npm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  ];

  for (const candidate of LOCKFILE_CANDIDATES) {
    const entry = rootEntries.find(
      (e) => e.name.toLowerCase() === candidate.file.toLowerCase() && e.isFile && !e.isSymlink
    );
    if (entry) {
      return {
        id: 'lockfile',
        name: 'Lockfile',
        critical: true,
        status: 'Passed',
        summary: `Lockfile found: ${entry.name}. Handover receiver can reproduce exact dependency versions.`,
        evidence: [
          `${entry.name} is present in the project root`,
          'Lockfile synchronization with package.json will be verified during container installation',
        ],
        lockfile: entry.name,
        packageManager: candidate.manager,
      };
    }
  }

  return {
    id: 'lockfile',
    name: 'Lockfile',
    critical: true,
    status: 'Failed',
    summary: 'No lockfile found. A lockfile is required for reliable, reproducible dependency installation.',
    evidence: [
      'No package-lock.json, npm-shrinkwrap.json, yarn.lock, or pnpm-lock.yaml found in project root',
      'Handover readiness requires reproducible dependencies',
    ],
    lockfile: null,
    packageManager: null,
  };
}

// ── Check C: Test script configuration ───────────────────────────────────────

function checkTestScript(manifest) {
  if (!manifest) {
    return {
      id: 'test-script',
      name: 'Test script configuration',
      critical: false,
      status: 'Not Verified',
      summary: 'Test script could not be inspected because package.json is missing or invalid.',
      evidence: ['package.json unavailable'],
    };
  }

  const testScript = manifest.scripts && typeof manifest.scripts.test === 'string'
    ? manifest.scripts.test.trim()
    : null;

  if (!testScript) {
    return {
      id: 'test-script',
      name: 'Test script configuration',
      critical: false,
      status: 'Not Verified',
      summary: 'No test script is defined in package.json.',
      evidence: ['scripts.test is missing or empty in package.json'],
    };
  }

  // Detect npm default placeholder: echo "Error: no test specified" && exit 1
  const isDefaultPlaceholder =
    /no test specified/i.test(testScript) ||
    /echo\s+["']?Error:\s*no\s*test/i.test(testScript) ||
    testScript === 'exit 1';

  if (isDefaultPlaceholder) {
    return {
      id: 'test-script',
      name: 'Test script configuration',
      critical: false,
      status: 'Not Verified',
      summary: 'The test script is an unconfigured npm default placeholder.',
      evidence: [
        `scripts.test is set to placeholder: "${testScript}"`,
        'Placeholder does not execute real tests',
      ],
    };
  }

  return {
    id: 'test-script',
    name: 'Test script configuration',
    critical: false,
    status: 'Passed',
    summary: 'A test script is configured in package.json. Actual execution and pass/fail results will be verified in the Docker sandbox.',
    evidence: [
      `scripts.test is configured: "${testScript}"`,
      'Test execution deferred to isolated Docker sandbox (Phase 2)',
    ],
  };
}

// ── Check D: README and setup documentation ─────────────────────────────────

async function checkReadme(rootDir, rootEntries) {
  const README_NAMES = ['readme.md', 'readme', 'readme.txt', 'readme.markdown'];
  const entry = rootEntries.find(
    (e) => README_NAMES.includes(e.name.toLowerCase()) && e.isFile && !e.isSymlink
  );

  if (!entry) {
    return {
      id: 'readme',
      name: 'README & setup documentation',
      critical: false,
      status: 'Failed',
      summary: 'No README or setup documentation was found in the project root.',
      evidence: ['No README.md, README, or README.txt found in project root'],
    };
  }

  const readmePath = path.join(rootDir, entry.name);
  const content = await safeReadText(readmePath, rootDir);

  if (content === null) {
    return {
      id: 'readme',
      name: 'README & setup documentation',
      critical: false,
      status: 'Not Verified',
      summary: `Documentation file ${entry.name} was found but could not be read safely.`,
      evidence: [`${entry.name} could not be read safely`],
    };
  }

  // Look for setup, installation, or execution instructions
  const hasInstallOrRun =
    /(?:npm|yarn|pnpm)\s+(?:ci|install|i|start|test|run)/i.test(content) ||
    /(?:#+\s*|\b)(?:installation|install|setup|getting started|how to run|quick start|usage|requirements|prerequisites)\b/i.test(content) ||
    /node\s+[\w./-]+\.js/i.test(content);

  if (hasInstallOrRun) {
    return {
      id: 'readme',
      name: 'README & setup documentation',
      critical: false,
      status: 'Passed',
      summary: `Documentation found (${entry.name}) with setup and run instructions.`,
      evidence: [
        `Found ${entry.name}`,
        'Setup, installation, or execution instructions detected',
      ],
    };
  }

  return {
    id: 'readme',
    name: 'README & setup documentation',
    critical: false,
    status: 'Not Verified',
    summary: `Documentation file found (${entry.name}), but clear setup or installation steps were not detected.`,
    evidence: [
      `Found ${entry.name}`,
      'No standard setup, installation, or execution instructions detected',
    ],
  };
}

// ── Check E: Environment variable documentation ──────────────────────────────

/**
 * scanSourceForEnvVars(rootDir)
 * Bounded shallow scan for process.env references in JS/TS source files.
 * Ignores symlinks, node_modules, dist, etc.
 */
async function scanSourceForEnvVars(rootDir) {
  const referencedVars = new Set();
  const queue = [{ dir: rootDir, depth: 0 }];
  let filesScanned = 0;

  const CODE_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx']);
  const ENV_REGEX = /\bprocess\.env(?:\.([a-zA-Z_$][0-9a-zA-Z_$]*)|\[['"`]([a-zA-Z_$][0-9a-zA-Z_$]*)['"`]\])/g;

  while (queue.length > 0 && filesScanned < MAX_SEARCH_FILES) {
    const { dir, depth } = queue.shift();
    if (depth > MAX_SEARCH_DEPTH) continue;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (filesScanned >= MAX_SEARCH_FILES) break;
      if (ent.isSymbolicLink()) continue; // Never follow symlinks

      const fullPath = path.join(dir, ent.name);
      if (!checkContainment(fullPath, rootDir)) continue;

      if (ent.isDirectory()) {
        if (!IGNORED_DIRS.has(ent.name.toLowerCase())) {
          queue.push({ dir: fullPath, depth: depth + 1 });
        }
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (CODE_EXTS.has(ext)) {
          filesScanned++;
          const text = await safeReadText(fullPath, rootDir, 32 * 1024);
          if (text) {
            let match;
            while ((match = ENV_REGEX.exec(text)) !== null) {
              const varName = match[1] || match[2];
              if (varName && varName !== 'NODE_ENV') {
                referencedVars.add(varName);
              }
            }
          }
        }
      }
    }
  }

  return Array.from(referencedVars).sort();
}

async function checkEnvDocs(rootDir, rootEntries) {
  const TEMPLATE_NAMES = [
    '.env.example',
    '.env.sample',
    '.env.template',
    '.env.dist',
    'example.env',
    '.env.local.example',
  ];

  const templateEntry = rootEntries.find(
    (e) => TEMPLATE_NAMES.includes(e.name.toLowerCase()) && e.isFile && !e.isSymlink
  );

  const hasCommittedEnv = rootEntries.some(
    (e) => e.name.toLowerCase() === '.env' && e.isFile && !e.isSymlink
  );

  const referencedVars = await scanSourceForEnvVars(rootDir);

  const warnings = [];
  if (hasCommittedEnv) {
    warnings.push('A raw .env file was found in the project root. Ensure no real production credentials or API keys were committed.');
  }

  if (templateEntry) {
    const evidence = [`Environment configuration template found: ${templateEntry.name}`];
    if (referencedVars.length > 0) {
      evidence.push(`Referenced variables in code: ${referencedVars.join(', ')}`);
    }
    if (warnings.length > 0) {
      evidence.push(...warnings);
    }

    return {
      id: 'env-docs',
      name: 'Environment variable documentation',
      critical: false,
      status: 'Passed',
      summary: `Environment variable template is provided (${templateEntry.name}).`,
      evidence,
    };
  }

  if (referencedVars.length > 0) {
    const evidence = [
      `Project code references environment variables: ${referencedVars.join(', ')}`,
      'No .env.example, .env.sample, or .env.template found in project root',
    ];
    if (warnings.length > 0) {
      evidence.push(...warnings);
    }

    return {
      id: 'env-docs',
      name: 'Environment variable documentation',
      critical: false,
      status: 'Failed',
      summary: 'Environment variables (process.env) are used in code, but no .env.example or template file was provided.',
      evidence,
    };
  }

  const evidence = [
    'No process.env references detected in scanned project files',
    'No environment template required or found',
  ];
  if (warnings.length > 0) {
    evidence.push(...warnings);
  }

  return {
    id: 'env-docs',
    name: 'Environment variable documentation',
    critical: false,
    status: 'Passed',
    summary: 'No environment variable template found, and no process.env usage was detected in scanned files.',
    evidence,
  };
}

// ── Check F: Node.js version declaration ─────────────────────────────────────

async function checkNodeVersion(rootDir, rootEntries, manifest) {
  // 1. Check engines.node in package.json
  if (manifest?.engines?.node && typeof manifest.engines.node === 'string') {
    const versionDecl = manifest.engines.node.trim();
    return {
      id: 'node-version',
      name: 'Node.js version declaration',
      critical: false,
      status: 'Passed',
      summary: `Node.js engine requirement is specified: "${versionDecl}".`,
      evidence: [`package.json engines.node specifies: "${versionDecl}"`],
    };
  }

  // 2. Check .nvmrc or .node-version
  const versionFileEntry = rootEntries.find(
    (e) => (e.name.toLowerCase() === '.nvmrc' || e.name.toLowerCase() === '.node-version') && e.isFile && !e.isSymlink
  );

  if (versionFileEntry) {
    const fullPath = path.join(rootDir, versionFileEntry.name);
    const content = await safeReadText(fullPath, rootDir, 1024);
    const versionDecl = content ? content.trim().split(/\r?\n/)[0] : '';
    if (versionDecl) {
      return {
        id: 'node-version',
        name: 'Node.js version declaration',
        critical: false,
        status: 'Passed',
        summary: `Node.js version requirement is specified in ${versionFileEntry.name}: "${versionDecl}".`,
        evidence: [`${versionFileEntry.name} specifies Node.js version: "${versionDecl}"`],
      };
    }
  }

  return {
    id: 'node-version',
    name: 'Node.js version declaration',
    critical: false,
    status: 'Not Verified',
    summary: 'No specific Node.js version declared in engines.node, .nvmrc, or .node-version.',
    evidence: [
      'No engines.node in package.json',
      'No .nvmrc or .node-version file found in project root',
      'Execution will use the default Node.js version in the verification sandbox',
    ],
  };
}

// ── Check G: Basic project structure ─────────────────────────────────────────

async function checkStructure(rootDir, rootEntries, manifest) {
  const commonEntryFiles = ['index.js', 'server.js', 'app.js', 'main.js'];
  const commonDirs = ['src', 'lib', 'test', 'tests', '__tests__'];

  const foundRootFiles = rootEntries
    .filter((e) => commonEntryFiles.includes(e.name.toLowerCase()) && e.isFile && !e.isSymlink)
    .map((e) => e.name);

  const foundDirs = rootEntries
    .filter((e) => commonDirs.includes(e.name.toLowerCase()) && e.isDir && !e.isSymlink)
    .map((e) => e.name);

  // Also check if src contains common entry files
  const hasSrc = foundDirs.some((d) => d.toLowerCase() === 'src');
  const foundSrcFiles = [];
  if (hasSrc) {
    try {
      const srcEntries = await readdir(path.join(rootDir, 'src'), { withFileTypes: true });
      for (const ent of srcEntries) {
        if (ent.isFile() && !ent.isSymbolicLink() && commonEntryFiles.includes(ent.name.toLowerCase())) {
          foundSrcFiles.push(`src/${ent.name}`);
        }
      }
    } catch (_) {}
  }

  const allEntryPoints = [...foundRootFiles, ...foundSrcFiles];
  if (manifest?.main && typeof manifest.main === 'string') {
    allEntryPoints.push(`main (${manifest.main})`);
  }

  const uniqueEntries = Array.from(new Set(allEntryPoints));

  if (uniqueEntries.length > 0 || foundDirs.length > 0) {
    const evidence = [];
    if (uniqueEntries.length > 0) {
      evidence.push(`Identified entry points: ${uniqueEntries.join(', ')}`);
    }
    if (foundDirs.length > 0) {
      evidence.push(`Recognized directories: ${foundDirs.join(', ')}`);
    }

    return {
      id: 'structure',
      name: 'Project structure',
      critical: false,
      status: 'Passed',
      summary: 'Recognized common Node.js project layout with entry points and source structure.',
      evidence,
    };
  }

  return {
    id: 'structure',
    name: 'Project structure',
    critical: false,
    status: 'Not Verified',
    summary: 'No standard Node.js entry point (index.js, server.js, app.js, or src/ directory) was identified.',
    evidence: ['No standard entry points or source directories detected'],
  };
}

// ── Main scanner function ───────────────────────────────────────────────────

/**
 * scanProject(projectDir)
 *
 * Runs all static checks on an extracted project directory.
 * Returns a structured, evidence-based result object.
 *
 * @param {string} projectDir - Absolute path to the extracted project directory.
 * @returns {Promise<{
 *   scannedAt: string,
 *   checks: Array<{
 *     id: string,
 *     name: string,
 *     critical: boolean,
 *     status: "Passed" | "Failed" | "Not Verified",
 *     summary: string,
 *     evidence: string[],
 *   }>,
 *   metadata: {
 *     projectName: string|null,
 *     version: string|null,
 *     lockfile: string|null,
 *     packageManager: string|null,
 *     scripts: string[],
 *     dependenciesCount: number,
 *     devDependenciesCount: number,
 *   }
 * }>}
 */
export async function scanProject(projectDir) {
  const resolvedDir = path.resolve(projectDir);

  // Verify containment / existence of projectDir itself
  let stats;
  try {
    stats = await lstat(resolvedDir);
  } catch (err) {
    throw new Error(`Project directory is inaccessible: ${err.message}`);
  }

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error('Project path must be a regular directory, not a symbolic link or file.');
  }

  const rootEntries = await safeListRoot(resolvedDir);
  const resolution = resolveAdapter(rootEntries);

  if (resolution.ecosystem === ECOSYSTEMS.AMBIGUOUS) {
    const check = {
      id: 'ecosystem',
      name: 'Project ecosystem detection',
      critical: true,
      status: 'Failed',
      summary: resolution.reason,
      evidence: [
        `Node.js signals: ${resolution.signals.nodeManifests.join(', ') || 'none'}`,
        `Python signals: ${resolution.signals.pythonManifests.join(', ') || 'none'}`,
      ],
      explanation: 'Mixed-language project indicators detected. BuildProof requires a single unambiguous project root.',
      nextStep: 'Ensure the ZIP archive contains only one project ecosystem (Node.js or Python).',
    };
    return {
      scannedAt: new Date().toISOString(),
      ecosystem: ECOSYSTEMS.AMBIGUOUS,
      checks: [check],
      metadata: {
        ecosystem: ECOSYSTEMS.AMBIGUOUS,
        projectName: path.basename(projectDir),
        hasTests: false,
      },
    };
  }

  if (resolution.ecosystem === ECOSYSTEMS.UNSUPPORTED) {
    const check = {
      id: 'ecosystem',
      name: 'Project ecosystem detection',
      critical: true,
      status: 'Failed',
      summary: resolution.reason,
      evidence: ['No supported Node.js or Python manifests or source files recognized in root directory'],
      explanation: 'BuildProof currently supports Node.js and Python project verification.',
      nextStep: 'Provide a Node.js (package.json) or Python (pyproject.toml, requirements.txt) project.',
    };
    return {
      scannedAt: new Date().toISOString(),
      ecosystem: ECOSYSTEMS.UNSUPPORTED,
      checks: [check],
      metadata: {
        ecosystem: ECOSYSTEMS.UNSUPPORTED,
        projectName: path.basename(projectDir),
        hasTests: false,
      },
    };
  }

  if (resolution.ecosystem === ECOSYSTEMS.PYTHON) {
    const pythonResult = await resolution.adapter.inspect(resolvedDir, rootEntries);
    return {
      scannedAt: new Date().toISOString(),
      ecosystem: ECOSYSTEMS.PYTHON,
      checks: pythonResult.checks,
      metadata: pythonResult.metadata,
    };
  }

  // Run all static checks for Node.js
  const { check: manifestCheck, manifest } = await checkManifest(resolvedDir, rootEntries);
  const lockfileCheck = checkLockfile(rootEntries);
  const testScriptCheck = checkTestScript(manifest);
  const readmeCheck = await checkReadme(resolvedDir, rootEntries);
  const envDocsCheck = await checkEnvDocs(resolvedDir, rootEntries);
  const nodeVersionCheck = await checkNodeVersion(resolvedDir, rootEntries, manifest);
  const structureCheck = await checkStructure(resolvedDir, rootEntries, manifest);

  const checks = [
    manifestCheck,
    lockfileCheck,
    testScriptCheck,
    readmeCheck,
    envDocsCheck,
    nodeVersionCheck,
    structureCheck,
  ];

  const metadata = {
    ecosystem: ECOSYSTEMS.NODE,
    projectName: typeof manifest?.name === 'string' ? manifest.name : null,
    version: typeof manifest?.version === 'string' ? manifest.version : null,
    lockfile: lockfileCheck.lockfile ?? null,
    packageManager: lockfileCheck.packageManager ?? null,
    scripts: manifest?.scripts && typeof manifest.scripts === 'object'
      ? Object.keys(manifest.scripts)
      : [],
    dependenciesCount: manifest?.dependencies && typeof manifest.dependencies === 'object'
      ? Object.keys(manifest.dependencies).length
      : 0,
    devDependenciesCount: manifest?.devDependencies && typeof manifest.devDependencies === 'object'
      ? Object.keys(manifest.devDependencies).length
      : 0,
    hasTests: testScriptCheck.status === 'Passed',
  };

  return {
    scannedAt: new Date().toISOString(),
    ecosystem: ECOSYSTEMS.NODE,
    checks,
    metadata,
  };
}
