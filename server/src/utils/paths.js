/**
 * utils/paths.js
 *
 * What this file does:
 *   Provides helper functions that check whether a file path extracted from a
 *   ZIP archive is safe to write to disk.
 *
 * How it fits into BuildProof:
 *   ZIP archives can contain malicious paths such as "../../etc/passwd" or
 *   "C:\Windows\system32\evil.dll" that would overwrite files outside the
 *   intended extraction directory. Every path goes through isSafePath() before
 *   a single byte is written. This is a hard security requirement from
 *   ARCHITECTURE.md Section 9.
 *
 * Security note:
 *   We use path.resolve() so that Node.js's own path normalisation collapses
 *   any ".." segments. We then check that the resolved path starts with the
 *   resolved extraction root PLUS a separator. The trailing separator is
 *   crucial: without it, a root of "C:\project" would incorrectly allow a path
 *   like "C:\projectevil\file.txt" (which starts with "C:\project" as a string
 *   but is not inside the intended folder).
 */

import path from 'path';

/**
 * isSafePath(entryName, extractRoot)
 *
 * Returns true if entryName is safe to extract into extractRoot.
 * Returns false for any of the following:
 *   - Empty or blank paths
 *   - Absolute Unix paths (start with /)
 *   - Windows drive-letter paths (start with C: etc.)
 *   - Paths that resolve to a location outside extractRoot
 *
 * @param {string} entryName  - The file path as it appears inside the ZIP.
 * @param {string} extractRoot - The absolute path of the target directory.
 * @returns {boolean}
 */
export function isSafePath(entryName, extractRoot) {
  // Reject empty or whitespace-only paths
  if (!entryName || entryName.trim() === '') return false;

  // Reject absolute Unix/Mac paths (start with /)
  if (path.posix.isAbsolute(entryName)) return false;

  // Reject Windows absolute paths (start with a drive letter like C: or D:)
  if (/^[a-zA-Z]:/.test(entryName)) return false;

  // Reject paths that begin with a backslash (Windows UNC or absolute)
  if (entryName.startsWith('\\')) return false;

  // Let Node.js resolve the full target path, collapsing any ".." segments
  const resolvedRoot = path.resolve(extractRoot);
  const resolvedFull = path.resolve(extractRoot, entryName);

  // The resolved path must be STRICTLY inside the root (not equal to it,
  // and not a sibling/parent). The trailing path.sep makes this unambiguous.
  return resolvedFull.startsWith(resolvedRoot + path.sep);
}
