/**
 * services/adapters/nodeAdapter.js
 *
 * What this file does:
 *   Adapter for Node.js projects, preserving all established Node.js static
 *   checks, Docker execution rules, and failure pattern diagnostics.
 */

import path from 'path';
import { readdir, open, lstat } from 'fs/promises';
import { BaseAdapter } from './baseAdapter.js';
import { checkContainment } from '../scanner.js';

const MAX_FILE_READ_BYTES = 64 * 1024;
const MAX_SEARCH_FILES    = 150;
const MAX_SEARCH_DEPTH    = 3;

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

async function safeReadText(filePath, rootDir, maxBytes = MAX_FILE_READ_BYTES) {
  if (!checkContainment(filePath, rootDir)) return null;

  let handle;
  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink() || !stats.isFile()) return null;

    handle = await open(filePath, 'r');
    const bytesToRead = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    return buffer.toString('utf8', 0, bytesRead);
  } catch {
    return null;
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch (_) {}
    }
  }
}

export class NodeAdapter extends BaseAdapter {
  constructor() {
    super('node', 'Node.js', 'node:20-alpine', 'node');
  }

  async inspect(projectDir, rootEntries) {
    const manifestCheck = await this._checkManifest(projectDir, rootEntries);
    const lockfileCheck = this._checkLockfile(rootEntries);
    const testScriptCheck = this._checkTestScript(manifestCheck.manifest);
    const readmeCheck = await this._checkReadme(projectDir, rootEntries);
    const envDocsCheck = await this._checkEnvDocs(projectDir, rootEntries);
    const nodeVersionCheck = await this._checkNodeVersion(projectDir, rootEntries, manifestCheck.manifest);
    const structureCheck = await this._checkStructure(projectDir, rootEntries, manifestCheck.manifest);

    const checks = [
      manifestCheck.check,
      lockfileCheck,
      testScriptCheck,
      readmeCheck,
      envDocsCheck,
      nodeVersionCheck,
      structureCheck,
    ];

    const manifest = manifestCheck.manifest;
    const metadata = {
      ecosystem: 'node',
      projectName: typeof manifest?.name === 'string' ? manifest.name : null,
      version: typeof manifest?.version === 'string' ? manifest.version : null,
      manifestFile: 'package.json',
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

    return { checks, metadata };
  }

  getInstallCommand(metadata) {
    const hasLockfile = Boolean(metadata.lockfile);
    const command = hasLockfile ? ['npm', 'ci'] : ['npm', 'install'];
    const displayCommand = command.join(' ');

    return {
      command,
      displayCommand,
      needsInstall: true,
      timeoutMs: 120_000,
      hasLockfile,
    };
  }

  getTestCommand(metadata) {
    const isConfigured = Boolean(metadata.hasTests);
    return {
      command: ['npm', 'test'],
      displayCommand: 'npm test',
      isConfigured,
      timeoutMs: 60_000,
    };
  }

  analyzeInstallFailure(output, exitCode, timedOut) {
    if (timedOut) {
      return {
        explanation: 'Dependency installation timed out after exceeding the maximum allowed duration.',
        nextStep: 'Check for network latency or long-running post-install build scripts.',
      };
    }

    const lower = (output || '').toLowerCase();
    if (
      lower.includes('missing:') ||
      lower.includes('lock file') ||
      lower.includes('in sync') ||
      lower.includes('eusage')
    ) {
      return {
        explanation: 'npm ci failed because package.json and package-lock.json are out of sync.',
        nextStep: 'Run npm install locally and commit the updated package-lock.json.',
      };
    }

    if (lower.includes('eresolve')) {
      return {
        explanation: 'npm could not resolve conflicting dependency version constraints (ERESOLVE).',
        nextStep: 'Resolve conflicting package versions in package.json or update peer dependencies.',
      };
    }

    if (
      lower.includes('enotfound') ||
      lower.includes('econnrefused') ||
      lower.includes('network error') ||
      lower.includes('fetch failed')
    ) {
      return {
        explanation: 'Network error encountered while attempting to reach the npm registry.',
        nextStep: 'Verify external network connectivity and proxy settings.',
      };
    }

    return {
      explanation: `npm installation exited with non-zero code ${exitCode}.`,
      nextStep: 'Inspect the installation log to diagnose missing dependencies or build errors.',
    };
  }

  analyzeTestFailure(output, exitCode, timedOut) {
    if (timedOut) {
      return {
        explanation: 'Test execution timed out after exceeding the maximum allowed duration.',
        nextStep: 'Check for infinite loops, hanging asynchronous promises, or unclosed servers in test code.',
      };
    }

    return {
      explanation: `npm test failed with exit code ${exitCode}. One or more assertions did not pass.`,
      nextStep: 'Fix failing test assertions and verify tests pass locally with npm test.',
    };
  }

  async _checkManifest(rootDir, rootEntries) {
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

  _checkLockfile(rootEntries) {
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
          name: 'Dependency lockfile',
          critical: true,
          status: 'Passed',
          summary: `Found ${entry.name} (${candidate.manager}). Dependencies are pinned.`,
          evidence: [`Lockfile present: ${entry.name}`, `Package manager: ${candidate.manager}`],
          lockfile: entry.name,
          packageManager: candidate.manager,
        };
      }
    }

    return {
      id: 'lockfile',
      name: 'Dependency lockfile',
      critical: true,
      status: 'Failed',
      summary: 'No dependency lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml) found.',
      evidence: ['No lockfile found in project root'],
      explanation: 'Missing lockfiles make dependency installation non-deterministic.',
      nextStep: 'Run npm install locally and commit package-lock.json to the repository.',
      lockfile: null,
      packageManager: null,
    };
  }

  _checkTestScript(manifest) {
    if (!manifest || !manifest.scripts || typeof manifest.scripts !== 'object') {
      return {
        id: 'test-script',
        name: 'Configured test script',
        critical: true,
        status: 'Not Verified',
        summary: 'No scripts block found in package.json.',
        evidence: ['scripts field missing or not an object in package.json'],
        explanation: 'Automated tests cannot be run because no test script is declared.',
        nextStep: 'Add a "scripts": { "test": "..." } entry to package.json.',
      };
    }

    const testScript = manifest.scripts.test;
    if (typeof testScript !== 'string' || !testScript.trim()) {
      return {
        id: 'test-script',
        name: 'Configured test script',
        critical: true,
        status: 'Not Verified',
        summary: 'scripts.test is missing or empty in package.json.',
        evidence: ['scripts.test is undefined or empty string'],
        explanation: 'No test command configured.',
        nextStep: 'Define a test runner script in package.json (e.g. "test": "node --test").',
      };
    }

    const trimmed = testScript.trim();
    if (
      trimmed.includes('no test specified') ||
      trimmed.startsWith('echo "Error: no test specified"') ||
      trimmed === 'exit 1'
    ) {
      return {
        id: 'test-script',
        name: 'Configured test script',
        critical: true,
        status: 'Not Verified',
        summary: 'scripts.test is the default npm placeholder and does not run real tests.',
        evidence: [`Found placeholder script: "${trimmed}"`],
        explanation: 'Default npm test placeholder detected.',
        nextStep: 'Replace the placeholder test script with a real test runner.',
      };
    }

    return {
      id: 'test-script',
      name: 'Configured test script',
      critical: true,
      status: 'Passed',
      summary: `Configured test script found: "${trimmed}". Test execution will be verified in Docker sandbox.`,
      evidence: [`scripts.test: "${trimmed}"`, 'Docker sandbox verification deferred to execution phase'],
    };
  }

  async _checkReadme(rootDir, rootEntries) {
    const readmeEntry = rootEntries.find((e) => {
      const lower = e.name.toLowerCase();
      return (
        (lower === 'readme' || lower.startsWith('readme.')) &&
        e.isFile &&
        !e.isSymlink
      );
    });

    if (!readmeEntry) {
      return {
        id: 'readme',
        name: 'README documentation',
        critical: false,
        status: 'Failed',
        summary: 'Missing README file in project root.',
        evidence: ['No README or README.* found in root directory'],
        explanation: 'Handover packages must provide documentation explaining how to set up and run the project.',
        nextStep: 'Add a README.md documenting prerequisites, installation, and run instructions.',
      };
    }

    const content = await safeReadText(path.join(rootDir, readmeEntry.name), rootDir);
    if (!content || !content.trim()) {
      return {
        id: 'readme',
        name: 'README documentation',
        critical: false,
        status: 'Not Verified',
        summary: `Found ${readmeEntry.name}, but it is empty.`,
        evidence: [`${readmeEntry.name} has 0 bytes or only whitespace`],
        explanation: 'An empty README does not provide setup instructions.',
        nextStep: 'Add setup and run instructions to README.md.',
      };
    }

    const lower = content.toLowerCase();
    const setupKeywords = ['install', 'setup', 'getting started', 'prerequisites', 'usage', 'run', 'start'];
    const matched = setupKeywords.filter((kw) => lower.includes(kw));

    if (matched.length >= 2) {
      return {
        id: 'readme',
        name: 'README documentation',
        critical: false,
        status: 'Passed',
        summary: `Found ${readmeEntry.name} with setup and run instructions.`,
        evidence: [`File: ${readmeEntry.name}`, `Setup sections detected: ${matched.join(', ')}`],
      };
    }

    return {
      id: 'readme',
      name: 'README documentation',
      critical: false,
      status: 'Not Verified',
      summary: `Found ${readmeEntry.name}, but setup instructions could not be confirmed reliably.`,
      evidence: [`File: ${readmeEntry.name}`, `Limited setup keywords found: ${matched.length ? matched.join(', ') : 'none'}`],
      explanation: 'The README exists but lacks clear install or startup sections.',
      nextStep: 'Include clear "Installation" and "Running" sections in README.md.',
    };
  }

  async _checkEnvDocs(rootDir, rootEntries) {
    const envExampleEntry = rootEntries.find((e) => {
      const lower = e.name.toLowerCase();
      return (
        (lower === '.env.example' || lower === '.env.template' || lower === '.env.sample') &&
        e.isFile &&
        !e.isSymlink
      );
    });

    const usedVars = await this._scanForProcessEnv(rootDir);

    if (envExampleEntry) {
      const content = await safeReadText(path.join(rootDir, envExampleEntry.name), rootDir);
      const varNames = (content || '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => line.split('=')[0].trim());

      const evidence = [`Template file: ${envExampleEntry.name}`];
      if (varNames.length > 0) {
        evidence.push(`Documented variables (${varNames.length}): ${varNames.slice(0, 10).join(', ')}`);
      }
      if (usedVars.length > 0) {
        evidence.push(`Detected process.env usage in code: ${usedVars.slice(0, 10).join(', ')}`);
      }

      return {
        id: 'env-docs',
        name: 'Environment documentation',
        critical: false,
        status: 'Passed',
        summary: `Found environment template ${envExampleEntry.name} documenting required variables.`,
        evidence,
      };
    }

    if (usedVars.length > 0) {
      return {
        id: 'env-docs',
        name: 'Environment documentation',
        critical: false,
        status: 'Failed',
        summary: 'Source code references process.env, but no .env.example template was provided.',
        evidence: [`Environment variables referenced: ${usedVars.slice(0, 10).join(', ')}`, 'No .env.example found'],
        explanation: 'Projects using environment variables should document them in a template.',
        nextStep: 'Create a .env.example listing the required environment variables with dummy values.',
      };
    }

    return {
      id: 'env-docs',
      name: 'Environment documentation',
      critical: false,
      status: 'Passed',
      summary: 'No environment variables detected in inspected source code, or documentation not required.',
      evidence: ['No unhandled process.env references identified in project files'],
    };
  }

  async _checkNodeVersion(rootDir, rootEntries, manifest) {
    const evidence = [];
    let declaredVersion = null;

    if (manifest?.engines?.node && typeof manifest.engines.node === 'string') {
      declaredVersion = manifest.engines.node;
      evidence.push(`package.json engines.node: "${declaredVersion}"`);
    }

    const nvmrc = rootEntries.find(
      (e) => e.name.toLowerCase() === '.nvmrc' && e.isFile && !e.isSymlink
    );
    if (nvmrc) {
      const content = await safeReadText(path.join(rootDir, nvmrc.name), rootDir, 100);
      if (content) {
        const v = content.trim();
        evidence.push(`.nvmrc: "${v}"`);
        if (!declaredVersion) declaredVersion = v;
      }
    }

    if (declaredVersion) {
      return {
        id: 'node-version',
        name: 'Node.js version declaration',
        critical: false,
        status: 'Passed',
        summary: `Target Node.js version declared (${declaredVersion}). Sandbox execution uses Node 20 LTS.`,
        evidence,
      };
    }

    return {
      id: 'node-version',
      name: 'Node.js version declaration',
      critical: false,
      status: 'Passed',
      summary: 'No specific Node.js version constraint declared. Sandbox execution will use Node 20 LTS.',
      evidence: ['engines.node and .nvmrc not specified; defaults to LTS'],
    };
  }

  async _checkStructure(rootDir, rootEntries, manifest) {
    const commonEntryFiles = ['index.js', 'server.js', 'app.js', 'main.js'];
    const commonDirs = ['src', 'lib', 'test', 'tests', '__tests__'];

    const foundRootFiles = rootEntries
      .filter((e) => commonEntryFiles.includes(e.name.toLowerCase()) && e.isFile && !e.isSymlink)
      .map((e) => e.name);

    const foundDirs = rootEntries
      .filter((e) => commonDirs.includes(e.name.toLowerCase()) && e.isDir && !e.isSymlink)
      .map((e) => e.name);

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

  async _scanForProcessEnv(rootDir) {
    const foundVars = new Set();
    let filesChecked = 0;

    async function searchDir(currentDir, depth) {
      if (depth > MAX_SEARCH_DEPTH || filesChecked >= MAX_SEARCH_FILES) return;

      let entries;
      try {
        entries = await readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const ent of entries) {
        if (filesChecked >= MAX_SEARCH_FILES) break;
        if (ent.isSymbolicLink()) continue;

        const fullPath = path.join(currentDir, ent.name);
        if (ent.isDirectory()) {
          if (!IGNORED_DIRS.has(ent.name.toLowerCase())) {
            await searchDir(fullPath, depth + 1);
          }
        } else if (ent.isFile()) {
          const lower = ent.name.toLowerCase();
          if (
            lower.endsWith('.js') ||
            lower.endsWith('.mjs') ||
            lower.endsWith('.cjs') ||
            lower.endsWith('.ts')
          ) {
            filesChecked++;
            const text = await safeReadText(fullPath, rootDir, 32 * 1024);
            if (text) {
              const regex = /process\.env\.([A-Z0-9_]+)/g;
              let match;
              while ((match = regex.exec(text)) !== null) {
                if (match[1] && match[1] !== 'NODE_ENV') {
                  foundVars.add(match[1]);
                }
              }
            }
          }
        }
      }
    }

    await searchDir(rootDir, 0);
    return Array.from(foundVars);
  }
}
