/**
 * services/adapters/detector.js
 *
 * What this file does:
 *   Detects the primary project ecosystem (Node.js, Python, ambiguous, or unsupported)
 *   from safely extracted project root entries.
 *
 * Security & Reliability rules:
 *   - Manifests and configuration files are stronger signals than source-file extensions.
 *   - Mixed-language / conflicting manifests are flagged as 'ambiguous' rather than guessed.
 *   - Unsupported projects are flagged as 'unsupported' rather than failing unexpectedly.
 */

import path from 'path';

export const ECOSYSTEMS = {
  NODE: 'node',
  PYTHON: 'python',
  AMBIGUOUS: 'ambiguous',
  UNSUPPORTED: 'unsupported',
};

// Node.js strong manifest and lockfile indicators
const NODE_MANIFEST_FILES = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

// Python strong manifest and configuration indicators
const PYTHON_MANIFEST_FILES = new Set([
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'setup.cfg',
  'pipfile',
  'pipfile.lock',
  'poetry.lock',
  'pdm.lock',
]);

const PYTHON_CONFIG_FILES = new Set([
  'pytest.ini',
  'tox.ini',
  '.flake8',
  'mypy.ini',
  '.python-version',
]);

/**
 * detectEcosystem(rootEntries)
 *
 * Analyzes the entries in the project root to determine the target ecosystem.
 *
 * @param {Array<{ name: string, isFile: boolean, isDir: boolean, isSymlink: boolean }>} rootEntries
 * @returns {{
 *   ecosystem: 'node' | 'python' | 'ambiguous' | 'unsupported',
 *   reason: string,
 *   signals: {
 *     nodeManifests: string[],
 *     pythonManifests: string[],
 *     pythonConfigs: string[],
 *     pythonSources: string[],
 *     nodeSources: string[],
 *   }
 * }}
 */
export function detectEcosystem(rootEntries = []) {
  const nodeManifests = [];
  const pythonManifests = [];
  const pythonConfigs = [];
  const pythonSources = [];
  const nodeSources = [];

  for (const entry of rootEntries) {
    if (entry.isSymlink) continue;
    const lowerName = entry.name.toLowerCase();

    if (entry.isFile) {
      if (NODE_MANIFEST_FILES.has(lowerName)) {
        nodeManifests.push(entry.name);
      }
      if (PYTHON_MANIFEST_FILES.has(lowerName)) {
        pythonManifests.push(entry.name);
      }
      if (PYTHON_CONFIG_FILES.has(lowerName)) {
        pythonConfigs.push(entry.name);
      }
      if (lowerName.endsWith('.py')) {
        pythonSources.push(entry.name);
      }
      if (lowerName.endsWith('.js') || lowerName.endsWith('.mjs') || lowerName.endsWith('.cjs') || lowerName.endsWith('.ts')) {
        nodeSources.push(entry.name);
      }
    }
  }

  const hasNodeManifest = nodeManifests.includes('package.json');
  const hasPythonManifest = pythonManifests.length > 0;
  const hasPythonConfig = pythonConfigs.length > 0;
  const hasPythonSource = pythonSources.length > 0;
  const hasNodeSource = nodeSources.length > 0;

  // 1. Conflict / Ambiguity Check
  // Both Node manifest and Python manifest present in the root
  if (hasNodeManifest && hasPythonManifest) {
    return {
      ecosystem: ECOSYSTEMS.AMBIGUOUS,
      reason: `Ambiguous project: Both Node.js manifest (${nodeManifests.join(', ')}) and Python manifest (${pythonManifests.join(', ')}) were detected in the project root. BuildProof requires a single unambiguous project root.`,
      signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
    };
  }

  // 2. Unambiguous Node.js Manifest
  if (hasNodeManifest) {
    return {
      ecosystem: ECOSYSTEMS.NODE,
      reason: `Node.js project detected via manifest: ${nodeManifests.join(', ')}`,
      signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
    };
  }

  // 3. Unambiguous Python Manifest or Config
  if (hasPythonManifest || hasPythonConfig) {
    const primarySignals = [...pythonManifests, ...pythonConfigs];
    return {
      ecosystem: ECOSYSTEMS.PYTHON,
      reason: `Python project detected via manifest/config: ${primarySignals.join(', ')}`,
      signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
    };
  }

  // 4. Source-based Fallback (Tier 3)
  // If no manifests exist, check if source files give a clear indication
  if (hasPythonSource && !hasNodeSource) {
    return {
      ecosystem: ECOSYSTEMS.PYTHON,
      reason: `Python project detected via source files: ${pythonSources.slice(0, 5).join(', ')}`,
      signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
    };
  }

  if (hasNodeSource && !hasPythonSource) {
    return {
      ecosystem: ECOSYSTEMS.NODE,
      reason: `Node.js project detected via source files: ${nodeSources.slice(0, 5).join(', ')}`,
      signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
    };
  }

  if (hasPythonSource && hasNodeSource) {
    return {
      ecosystem: ECOSYSTEMS.AMBIGUOUS,
      reason: 'Ambiguous project: Mixed Python and JavaScript/TypeScript source files detected without a clear manifest.',
      signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
    };
  }

  // 5. Explicitly Unsupported Ecosystem Check (e.g. Go, Rust, Java, C++)
  const UNSUPPORTED_INDICATORS = [
    { name: 'go.mod', lang: 'Go' },
    { name: 'Cargo.toml', lang: 'Rust' },
    { name: 'pom.xml', lang: 'Java (Maven)' },
    { name: 'build.gradle', lang: 'Java/Kotlin (Gradle)' },
    { name: 'CMakeLists.txt', lang: 'C/C++' },
    { name: 'Makefile', lang: 'Make' },
  ];

  for (const ind of UNSUPPORTED_INDICATORS) {
    const found = rootEntries.find(
      (e) => e.name.toLowerCase() === ind.name.toLowerCase() && e.isFile && !e.isSymlink
    );
    if (found) {
      return {
        ecosystem: ECOSYSTEMS.UNSUPPORTED,
        reason: `Unsupported project type: Detected ${ind.lang} project indicator (${found.name}). BuildProof currently supports Node.js and Python verification.`,
        signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
      };
    }
  }

  // Default to Node.js for legacy/empty archives so package.json check fails with standard guidance
  return {
    ecosystem: ECOSYSTEMS.NODE,
    reason: 'No explicit Python or other ecosystem manifest found; validating as Node.js project.',
    signals: { nodeManifests, pythonManifests, pythonConfigs, pythonSources, nodeSources },
  };
}
