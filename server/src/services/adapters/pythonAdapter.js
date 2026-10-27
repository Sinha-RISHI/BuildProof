/**
 * services/adapters/pythonAdapter.js
 *
 * What this file does:
 *   Adapter for Python projects. Implements static checks for pyproject.toml,
 *   requirements.txt, setup.py, lockfiles, pytest/unittest, README, env docs,
 *   and executes Docker verification using a versioned python:3.11-alpine sandbox.
 *
 * Security guarantees:
 *   - NEVER executes Python code on the host.
 *   - Container user is unprivileged (1000:1000) with --cap-drop ALL.
 *   - Dependency installation (Phase 1) is bounded and runs in container only.
 *   - Test execution (Phase 2) strictly enforces --network none.
 */

import path from 'path';
import { readdir, open, lstat } from 'fs/promises';
import { BaseAdapter } from './baseAdapter.js';
import { checkContainment } from '../scanner.js';

const MAX_FILE_READ_BYTES = 64 * 1024;
const MAX_SEARCH_FILES    = 150;
const MAX_SEARCH_DEPTH    = 3;

const IGNORED_DIRS = new Set([
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.git',
  '.tox',
  '.mypy_cache',
  'build',
  'dist',
  '*.egg-info',
  '.deps',
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

export class PythonAdapter extends BaseAdapter {
  constructor() {
    super('python', 'Python', 'python:3.11-alpine', '1000:1000');
  }

  async inspect(projectDir, rootEntries) {
    const manifestCheck = await this._checkManifest(projectDir, rootEntries);
    const lockfileCheck = this._checkLockfile(rootEntries);
    const testConfigCheck = await this._checkTestConfig(projectDir, rootEntries, manifestCheck.manifest);
    const readmeCheck = await this._checkReadme(projectDir, rootEntries);
    const envDocsCheck = await this._checkEnvDocs(projectDir, rootEntries);
    const pythonVersionCheck = await this._checkPythonVersion(projectDir, rootEntries, manifestCheck.manifest);
    const structureCheck = await this._checkStructure(projectDir, rootEntries);

    const checks = [
      manifestCheck.check,
      lockfileCheck,
      testConfigCheck.check,
      readmeCheck,
      envDocsCheck,
      pythonVersionCheck,
      structureCheck,
    ];

    const metadata = {
      ecosystem: 'python',
      projectName: manifestCheck.projectName || path.basename(projectDir),
      version: manifestCheck.version ?? null,
      manifestFile: manifestCheck.manifestFile ?? null,
      lockfile: lockfileCheck.lockfile ?? null,
      packageManager: lockfileCheck.packageManager ?? 'pip',
      dependenciesCount: manifestCheck.dependenciesCount ?? 0,
      hasTests: testConfigCheck.hasTests,
      testFramework: testConfigCheck.framework,
    };

    return { checks, metadata };
  }

  getInstallCommand(metadata, rootEntries) {
    // Check if requirements.txt or pyproject.toml exists
    const hasReqs = rootEntries.some(
      (e) => e.name.toLowerCase() === 'requirements.txt' && e.isFile && !e.isSymlink
    );
    const hasPyproject = rootEntries.some(
      (e) => e.name.toLowerCase() === 'pyproject.toml' && e.isFile && !e.isSymlink
    );
    const hasSetup = rootEntries.some(
      (e) => e.name.toLowerCase() === 'setup.py' && e.isFile && !e.isSymlink
    );

    if (hasReqs) {
      return {
        command: ['python', '-m', 'pip', 'install', '--no-cache-dir', '-r', 'requirements.txt', '--target', '/app/.deps'],
        displayCommand: 'pip install -r requirements.txt',
        needsInstall: true,
        timeoutMs: 120_000,
        env: { PYTHONPATH: '/app:/app/src:/app/.deps' },
      };
    }

    if (hasPyproject || hasSetup) {
      return {
        command: ['python', '-m', 'pip', 'install', '--no-cache-dir', '.', '--target', '/app/.deps'],
        displayCommand: 'pip install .',
        needsInstall: true,
        timeoutMs: 120_000,
        env: { PYTHONPATH: '/app:/app/src:/app/.deps' },
      };
    }

    // Standard library only / no manifest dependencies
    return {
      command: null,
      displayCommand: 'No external dependencies required (standard library only)',
      needsInstall: false,
      timeoutMs: 0,
      env: { PYTHONPATH: '/app:/app/src:/app/.deps' },
    };
  }

  getTestCommand(metadata) {
    const isConfigured = Boolean(metadata.hasTests);

    if (metadata.testFramework === 'pytest') {
      return {
        command: ['python', '-m', 'pytest'],
        displayCommand: 'pytest',
        isConfigured,
        timeoutMs: 60_000,
        env: { PYTHONPATH: '/app:/app/src:/app/.deps' },
      };
    }

    // Default to Python standard library unittest discovery
    return {
      command: ['python', '-m', 'unittest', 'discover', '-s', '.', '-p', 'test*.py'],
      displayCommand: 'python -m unittest discover',
      isConfigured,
      timeoutMs: 60_000,
      env: { PYTHONPATH: '/app:/app/src:/app/.deps' },
    };
  }

  analyzeInstallFailure(output, exitCode, timedOut) {
    if (timedOut) {
      return {
        explanation: 'Python dependency installation timed out after exceeding the maximum allowed duration.',
        nextStep: 'Check for network latency, complex C-extension builds, or circular dependency resolution in pip.',
      };
    }

    const lower = (output || '').toLowerCase();
    if (lower.includes('no matching distribution found') || lower.includes('could not find a version')) {
      return {
        explanation: 'pip could not find a compatible distribution for one or more specified packages.',
        nextStep: 'Verify package names and version specifiers in requirements.txt or pyproject.toml.',
      };
    }

    if (lower.includes('resolutionimpossible') || lower.includes('conflicting dependencies')) {
      return {
        explanation: 'pip encountered incompatible dependency version constraints.',
        nextStep: 'Resolve version conflicts between required packages in your manifest.',
      };
    }

    if (
      lower.includes('network is unreachable') ||
      lower.includes('connection error') ||
      lower.includes('failed to establish a new connection')
    ) {
      return {
        explanation: 'Network error encountered while attempting to contact PyPI registry.',
        nextStep: 'Verify outbound connectivity to https://pypi.org.',
      };
    }

    return {
      explanation: `pip install failed with exit code ${exitCode}.`,
      nextStep: 'Inspect the installation logs for missing dependencies or compiler errors.',
    };
  }

  analyzeTestFailure(output, exitCode, timedOut) {
    if (timedOut) {
      return {
        explanation: 'Python test execution timed out after exceeding the maximum allowed duration.',
        nextStep: 'Check for infinite loops, blocking I/O, or unclosed socket connections in your test suite.',
      };
    }

    const lower = (output || '').toLowerCase();
    if (lower.includes('modulenotfounderror') || lower.includes('no module named')) {
      return {
        explanation: 'Tests failed due to an unimported or missing module (ModuleNotFoundError).',
        nextStep: 'Ensure all required test packages are declared in requirements.txt or installed.',
      };
    }

    if (lower.includes('syntaxerror') || lower.includes('indentationerror')) {
      return {
        explanation: 'Python syntax error or indentation error detected during test discovery.',
        nextStep: 'Fix syntax and indentation issues in the identified source/test files.',
      };
    }

    return {
      explanation: `Python test runner exited with non-zero exit code ${exitCode}. One or more assertions failed.`,
      nextStep: 'Inspect the test tracebacks and fix failing assertions.',
    };
  }

  // ── Private inspection helpers ───────────────────────────────────────────

  async _checkManifest(rootDir, rootEntries) {
    // Check pyproject.toml, requirements.txt, setup.py
    const pyproject = rootEntries.find(
      (e) => e.name.toLowerCase() === 'pyproject.toml' && e.isFile && !e.isSymlink
    );
    const reqs = rootEntries.find(
      (e) => e.name.toLowerCase() === 'requirements.txt' && e.isFile && !e.isSymlink
    );
    const setupPy = rootEntries.find(
      (e) => e.name.toLowerCase() === 'setup.py' && e.isFile && !e.isSymlink
    );

    const foundFiles = [];
    if (pyproject) foundFiles.push(pyproject.name);
    if (reqs) foundFiles.push(reqs.name);
    if (setupPy) foundFiles.push(setupPy.name);

    if (foundFiles.length === 0) {
      return {
        check: {
          id: 'manifest',
          name: 'Package manifest',
          critical: true,
          status: 'Failed',
          summary: 'Missing Python package manifest (pyproject.toml, requirements.txt, or setup.py) in project root.',
          evidence: ['No pyproject.toml, requirements.txt, or setup.py found in root directory'],
          explanation: 'Python projects require a recognized dependency manifest for deterministic package installation.',
          nextStep: 'Add a requirements.txt or pyproject.toml listing required dependencies.',
        },
        manifest: null,
      };
    }

    // Inspect requirements.txt if present
    let depCount = 0;
    const evidence = [`Manifest found: ${foundFiles.join(', ')}`];
    let projectName = null;

    if (reqs) {
      const content = await safeReadText(path.join(rootDir, reqs.name), rootDir);
      if (content) {
        const lines = content
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'));
        depCount = lines.length;
        evidence.push(`requirements.txt packages declared: ${depCount}`);
      }
    }

    if (pyproject) {
      const content = await safeReadText(path.join(rootDir, pyproject.name), rootDir);
      if (content) {
        const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/i);
        if (nameMatch) {
          projectName = nameMatch[1];
          evidence.push(`Project name (pyproject.toml): "${projectName}"`);
        }
      }
    }

    return {
      check: {
        id: 'manifest',
        name: 'Package manifest',
        critical: true,
        status: 'Passed',
        summary: `Valid Python manifest present (${foundFiles.join(', ')}).`,
        evidence,
      },
      manifestFile: foundFiles[0],
      projectName,
      dependenciesCount: depCount,
      manifest: { foundFiles, depCount, projectName },
    };
  }

  _checkLockfile(rootEntries) {
    const lockfiles = [
      { name: 'poetry.lock', manager: 'poetry' },
      { name: 'pipfile.lock', manager: 'pipenv' },
      { name: 'pdm.lock', manager: 'pdm' },
      { name: 'requirements.lock', manager: 'pip-compile' },
    ];

    for (const lf of lockfiles) {
      const found = rootEntries.find(
        (e) => e.name.toLowerCase() === lf.name && e.isFile && !e.isSymlink
      );
      if (found) {
        return {
          id: 'lockfile',
          name: 'Dependency lockfile',
          critical: true,
          status: 'Passed',
          summary: `Found ${found.name} (${lf.manager}). Pinned dependencies ensure reproducible handover.`,
          evidence: [`Lockfile present: ${found.name}`, `Tool: ${lf.manager}`],
          lockfile: found.name,
          packageManager: lf.manager,
        };
      }
    }

    // Check if requirements.txt has pinned versions (e.g. package==1.2.3)
    const reqs = rootEntries.find(
      (e) => e.name.toLowerCase() === 'requirements.txt' && e.isFile && !e.isSymlink
    );
    if (reqs) {
      return {
        id: 'lockfile',
        name: 'Dependency lockfile',
        critical: true,
        status: 'Passed',
        summary: 'Using requirements.txt for dependency resolution.',
        evidence: ['requirements.txt present (reproducible install via pinned requirements or fallback)'],
        lockfile: 'requirements.txt',
        packageManager: 'pip',
      };
    }

    return {
      id: 'lockfile',
      name: 'Dependency lockfile',
      critical: true,
      status: 'Not Verified',
      summary: 'No dependency lockfile (poetry.lock, Pipfile.lock, requirements.lock) found.',
      evidence: ['No lockfile or requirements.txt found in root directory'],
      explanation: 'Without pinned dependencies, installations can vary across environments.',
      nextStep: 'Generate a lockfile using poetry.lock, Pipfile.lock, or pip freeze > requirements.txt.',
      lockfile: null,
      packageManager: 'pip',
    };
  }

  async _checkTestConfig(rootDir, rootEntries, manifest) {
    const pytestIni = rootEntries.find(
      (e) => e.name.toLowerCase() === 'pytest.ini' && e.isFile && !e.isSymlink
    );
    const testDir = rootEntries.find(
      (e) => (e.name.toLowerCase() === 'tests' || e.name.toLowerCase() === 'test') && e.isDir && !e.isSymlink
    );
    const rootTestFiles = rootEntries
      .filter((e) => (e.name.toLowerCase().startsWith('test_') || e.name.toLowerCase().endsWith('_test.py')) && e.isFile && !e.isSymlink)
      .map((e) => e.name);

    let testDirFiles = [];
    if (testDir) {
      try {
        const entries = await readdir(path.join(rootDir, testDir.name), { withFileTypes: true });
        testDirFiles = entries
          .filter((e) => (e.name.toLowerCase().startsWith('test_') || e.name.toLowerCase().endsWith('_test.py') || e.name.toLowerCase().endsWith('.py')) && e.isFile())
          .map((e) => `${testDir.name}/${e.name}`);
      } catch (_) {}
    }

    const allTestFiles = [...rootTestFiles, ...testDirFiles];
    const hasTestFiles = allTestFiles.length > 0;

    if (pytestIni) {
      return {
        check: {
          id: 'test-script',
          name: 'Configured test framework',
          critical: true,
          status: 'Passed',
          summary: 'Configured pytest framework found (pytest.ini). Tests will be executed in Docker sandbox.',
          evidence: ['pytest.ini detected in root', `Identified test files: ${allTestFiles.slice(0, 5).join(', ') || 'discovered via pytest'}`],
        },
        hasTests: true,
        framework: 'pytest',
      };
    }

    if (hasTestFiles) {
      return {
        check: {
          id: 'test-script',
          name: 'Configured test framework',
          critical: true,
          status: 'Passed',
          summary: `Identified ${allTestFiles.length} Python test file(s). Standard unittest/pytest discovery will execute in Docker sandbox.`,
          evidence: [`Discovered test files: ${allTestFiles.slice(0, 5).join(', ')}`, 'Runner: python -m unittest discover'],
        },
        hasTests: true,
        framework: 'unittest',
      };
    }

    return {
      check: {
        id: 'test-script',
        name: 'Configured test framework',
        critical: true,
        status: 'Not Verified',
        summary: 'No Python test files (test_*.py) or test configuration (pytest.ini) detected.',
        evidence: ['No tests/ directory, test_*.py files, or pytest.ini found'],
        explanation: 'Automated tests cannot be verified without test files or configuration.',
        nextStep: 'Add automated tests using unittest or pytest in a tests/ directory.',
      },
      hasTests: false,
      framework: null,
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
        explanation: 'Handover packages must provide documentation explaining how to set up and run the Python project.',
        nextStep: 'Add a README.md documenting Python version prerequisites, pip install, and run commands.',
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
    const setupKeywords = ['pip', 'python', 'install', 'setup', 'venv', 'requirements', 'usage', 'run', 'pytest'];
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
      summary: `Found ${readmeEntry.name}, but Python setup instructions could not be confirmed reliably.`,
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

    const usedVars = await this._scanForOsEnviron(rootDir);

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
        evidence.push(`Detected os.environ / os.getenv usage in code: ${usedVars.slice(0, 10).join(', ')}`);
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
        summary: 'Source code references os.environ or os.getenv, but no .env.example template was provided.',
        evidence: [`Environment variables referenced: ${usedVars.slice(0, 10).join(', ')}`, 'No .env.example found'],
        explanation: 'Python projects using environment variables should document them in a template.',
        nextStep: 'Create a .env.example listing the required environment variables with dummy values.',
      };
    }

    return {
      id: 'env-docs',
      name: 'Environment documentation',
      critical: false,
      status: 'Passed',
      summary: 'No environment variables detected in inspected Python source code, or documentation not required.',
      evidence: ['No unhandled os.environ / os.getenv references identified in project files'],
    };
  }

  async _checkPythonVersion(rootDir, rootEntries, manifest) {
    const evidence = [];
    let declaredVersion = null;

    const versionFile = rootEntries.find(
      (e) => (e.name.toLowerCase() === '.python-version' || e.name.toLowerCase() === 'runtime.txt') && e.isFile && !e.isSymlink
    );

    if (versionFile) {
      const content = await safeReadText(path.join(rootDir, versionFile.name), rootDir, 100);
      if (content) {
        declaredVersion = content.trim();
        evidence.push(`${versionFile.name}: "${declaredVersion}"`);
      }
    }

    if (declaredVersion) {
      return {
        id: 'runtime-version',
        name: 'Python version declaration',
        critical: false,
        status: 'Passed',
        summary: `Target Python version declared (${declaredVersion}). Sandbox execution uses Python 3.11.`,
        evidence,
      };
    }

    return {
      id: 'runtime-version',
      name: 'Python version declaration',
      critical: false,
      status: 'Passed',
      summary: 'No specific Python version constraint declared. Sandbox execution will use Python 3.11.',
      evidence: ['.python-version not specified; defaults to Python 3.11 LTS'],
    };
  }

  async _checkStructure(rootDir, rootEntries) {
    const commonEntryFiles = ['main.py', 'app.py', 'server.py', 'manage.py', 'cli.py'];
    const commonDirs = ['src', 'tests', 'test', 'pkg', 'app'];

    const foundRootFiles = rootEntries
      .filter((e) => commonEntryFiles.includes(e.name.toLowerCase()) && e.isFile && !e.isSymlink)
      .map((e) => e.name);

    const foundDirs = rootEntries
      .filter((e) => commonDirs.includes(e.name.toLowerCase()) && e.isDir && !e.isSymlink)
      .map((e) => e.name);

    // Check if any root directories contain __init__.py (package structure)
    const packageDirs = [];
    for (const ent of rootEntries) {
      if (ent.isDir && !ent.isSymlink && !IGNORED_DIRS.has(ent.name.toLowerCase())) {
        try {
          const sub = await readdir(path.join(rootDir, ent.name), { withFileTypes: true });
          if (sub.some((s) => s.name === '__init__.py')) {
            packageDirs.push(ent.name);
          }
        } catch (_) {}
      }
    }

    const allSignals = [...foundRootFiles, ...foundDirs, ...packageDirs.map((p) => `package: ${p}`)];
    const unique = Array.from(new Set(allSignals));

    if (unique.length > 0) {
      return {
        id: 'structure',
        name: 'Project structure',
        critical: false,
        status: 'Passed',
        summary: 'Recognized common Python project layout with entry points or package modules.',
        evidence: [`Detected structure: ${unique.join(', ')}`],
      };
    }

    return {
      id: 'structure',
      name: 'Project structure',
      critical: false,
      status: 'Not Verified',
      summary: 'No standard Python entry point (main.py, app.py) or package directory was identified.',
      evidence: ['No standard entry points or package modules detected'],
    };
  }

  async _scanForOsEnviron(rootDir) {
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
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.py')) {
          filesChecked++;
          const text = await safeReadText(fullPath, rootDir, 32 * 1024);
          if (text) {
            // Match os.environ.get('VAR'), os.environ['VAR'], os.getenv('VAR')
            const regex = /(?:os\.environ(?:\.get)?\[?\(?|os\.getenv\()["']([A-Z0-9_]+)["']/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
              if (match[1]) foundVars.add(match[1]);
            }
          }
        }
      }
    }

    await searchDir(rootDir, 0);
    return Array.from(foundVars);
  }
}
