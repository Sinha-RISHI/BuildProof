/**
 * services/adapters/index.js
 *
 * What this file does:
 *   Adapter registry and lookup factory for BuildProof supported ecosystems.
 */

import { detectEcosystem, ECOSYSTEMS } from './detector.js';
import { NodeAdapter } from './nodeAdapter.js';
import { PythonAdapter } from './pythonAdapter.js';

const nodeAdapter = new NodeAdapter();
const pythonAdapter = new PythonAdapter();

export { detectEcosystem, ECOSYSTEMS };

/**
 * getAdapterForEcosystem(ecosystem)
 *
 * @param {'node'|'python'|string} ecosystem
 * @returns {import('./baseAdapter.js').BaseAdapter | null}
 */
export function getAdapterForEcosystem(ecosystem) {
  if (ecosystem === ECOSYSTEMS.NODE) {
    return nodeAdapter;
  }
  if (ecosystem === ECOSYSTEMS.PYTHON) {
    return pythonAdapter;
  }
  return null;
}

/**
 * resolveAdapter(rootEntries)
 *
 * Detects ecosystem and returns the matching adapter, or returns diagnostic status.
 *
 * @param {Array<{ name: string, isFile: boolean, isDir: boolean, isSymlink: boolean }>} rootEntries
 * @returns {{
 *   ecosystem: 'node' | 'python' | 'ambiguous' | 'unsupported',
 *   adapter: import('./baseAdapter.js').BaseAdapter | null,
 *   reason: string,
 *   signals: object
 * }}
 */
export function resolveAdapter(rootEntries) {
  const detection = detectEcosystem(rootEntries);
  const adapter = getAdapterForEcosystem(detection.ecosystem);

  return {
    ...detection,
    adapter,
  };
}
