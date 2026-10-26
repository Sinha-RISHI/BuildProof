/**
 * services/extract.js
 *
 * What this file does:
 *   Safely extracts a ZIP archive into a target directory, one entry at a time.
 *   Every entry is validated before any bytes are written to disk.
 *
 * How it fits into BuildProof:
 *   After multer saves the uploaded ZIP to a temp file, the POST /api/scans
 *   route calls extractZip(). If extraction succeeds, the project files are
 *   in <scanDir>/project/ ready for the scanner (Step 5). If extraction fails,
 *   the caller cleans up both the temp file and the partial scan directory.
 *
 * Security checks implemented (ARCHITECTURE.md §9):
 *   ✓ Invalid/corrupt ZIP → yauzl fails to open the file
 *   ✓ Unsafe entry paths → isSafePath() rejects them
 *   ✓ Path traversal (../) → caught by isSafePath()
 *   ✓ Absolute paths (/etc, C:\) → caught by isSafePath()
 *   ✓ Symbolic links → detected via Unix external attribute mode bits
 *   ✓ Duplicate paths → tracked with a Set, case-normalised
 *   ✓ ZIP bombs – entry count limit → MAX_ENTRIES
 *   ✓ ZIP bombs – single file size → MAX_ENTRY_UNCOMPRESSED_BYTES
 *   ✓ ZIP bombs – total uncompressed size → MAX_TOTAL_UNCOMPRESSED_BYTES
 *   ✓ No code is executed; we only write files
 *
 * Library choice:
 *   yauzl (ARCHITECTURE.md §2) is used with lazyEntries: true so we pull one
 *   entry at a time and can abort cleanly on the first problem. We never call
 *   shell commands for path handling.
 */

import yauzl from 'yauzl';
import path from 'path';
import fs from 'fs';
import { mkdir } from 'fs/promises';
import { isSafePath } from '../utils/paths.js';

// ── Limits (documented here and enforced below) ───────────────────────────────

/** Maximum number of entries in a ZIP. Prevents pathological archives. */
const MAX_ENTRIES = 1000;

/**
 * Maximum uncompressed size of a single entry (50 MB).
 * A single huge file could still consume all disk space without this check.
 */
const MAX_ENTRY_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

/**
 * Maximum total uncompressed size across all entries (200 MB).
 * Prevents ZIP bombs where many small entries add up to gigabytes.
 */
const MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

// ── Unix file-type constants for the external attributes field ─────────────────

/** Mask to extract the file-type bits from a Unix mode (octal 0170000). */
const S_IFMT   = 0o170000;
/** Symbolic link file type (octal 0120000). */
const S_IFLNK  = 0o120000;

/**
 * extractZip(zipPath, extractDir)
 *
 * Opens the ZIP at zipPath, validates every entry, and extracts regular files
 * and directories into extractDir.
 *
 * Resolves with { entryCount, totalUncompressedBytes } on success.
 * Rejects with a descriptive Error on any validation failure or I/O error.
 *
 * This function NEVER throws. Every error path rejects the promise.
 * The caller is responsible for cleaning up extractDir on rejection.
 *
 * @param {string} zipPath    - Absolute path to the uploaded ZIP file.
 * @param {string} extractDir - Absolute path of the directory to extract into.
 *                              Must already exist.
 * @returns {Promise<{ entryCount: number, totalUncompressedBytes: number }>}
 */
export function extractZip(zipPath, extractDir) {
  return new Promise((resolve, reject) => {
    // ── Settle-once guard ──────────────────────────────────────────────────
    // Both 'error' events and 'end' events can fire in edge cases.
    // We track whether we have already settled to avoid double-resolving.
    let settled = false;

    function fail(err) {
      if (!settled) {
        settled = true;
        try { zipfile && zipfile.close(); } catch (_) {}
        reject(err);
      }
    }

    function succeed(result) {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    }

    // ── Open the ZIP ───────────────────────────────────────────────────────
    let zipfile;
    yauzl.open(zipPath, { lazyEntries: true, decodeStrings: true }, (openErr, zf) => {
      if (openErr) {
        // yauzl could not parse the file as a ZIP at all
        return fail(new Error('Invalid or corrupt ZIP file. Only valid ZIP archives are accepted.'));
      }

      zipfile = zf;

      // Counters for limit enforcement
      let entryCount = 0;
      let totalUncompressedBytes = 0;

      // Tracks normalised paths we have already seen (case-insensitive, / separator)
      const seenPaths = new Set();

      // Read the first entry (lazyEntries mode: we must call readEntry() manually)
      zipfile.readEntry();

      // ── Entry handler ────────────────────────────────────────────────────
      zipfile.on('entry', (entry) => {
        // ── 1. Entry count limit ───────────────────────────────────────────
        entryCount++;
        if (entryCount > MAX_ENTRIES) {
          return fail(new Error(
            `ZIP contains too many entries (limit: ${MAX_ENTRIES}). ` +
            'This may indicate a ZIP bomb.'
          ));
        }

        const entryName = entry.fileName; // path as stored in the ZIP

        // ── 2. Path safety (traversal, absolute, drive-letter) ─────────────
        if (!isSafePath(entryName, extractDir)) {
          return fail(new Error(
            `ZIP contains an unsafe file path: "${entryName}". ` +
            'Absolute paths, drive letters, and path traversal (..) are not allowed.'
          ));
        }

        // ── 3. Symbolic link detection ────────────────────────────────────
        // The upper 16 bits of externalFileAttributes carry the Unix file mode
        // for ZIPs created on Unix/Mac systems.
        const unixMode = entry.externalFileAttributes >>> 16;
        if (unixMode !== 0) { // 0 means no Unix mode info (e.g. Windows ZIP)
          const fileType = unixMode & S_IFMT;
          if (fileType === S_IFLNK) {
            return fail(new Error(
              `ZIP contains a symbolic link: "${entryName}". ` +
              'Symbolic links are not allowed for security reasons.'
            ));
          }
        }

        // ── 4. Duplicate path check ───────────────────────────────────────
        // Normalise to forward slashes and lowercase for case-insensitive
        // comparison (ZIP paths can have mixed case on case-sensitive systems).
        const normalisedName = entryName.replace(/\\/g, '/').toLowerCase();
        if (seenPaths.has(normalisedName)) {
          return fail(new Error(
            `ZIP contains a duplicate path: "${entryName}". ` +
            'Each path in the archive must be unique.'
          ));
        }
        seenPaths.add(normalisedName);

        // ── 5. Individual entry size limit ────────────────────────────────
        // entry.uncompressedSize comes from the ZIP central directory.
        // We check it before reading the stream so we fail fast.
        if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
          return fail(new Error(
            `ZIP entry "${entryName}" is too large ` +
            `(${Math.round(entry.uncompressedSize / 1024 / 1024)} MB, ` +
            `limit: ${MAX_ENTRY_UNCOMPRESSED_BYTES / 1024 / 1024} MB).`
          ));
        }

        // ── 6. Cumulative total size limit ────────────────────────────────
        totalUncompressedBytes += entry.uncompressedSize;
        if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          return fail(new Error(
            `ZIP total uncompressed size exceeds the limit of ` +
            `${MAX_TOTAL_UNCOMPRESSED_BYTES / 1024 / 1024} MB. ` +
            'This may indicate a ZIP bomb.'
          ));
        }

        // ── 7. Determine target path on disk ──────────────────────────────
        const destPath = path.join(extractDir, entryName);

        // ── 8. Directory entry ────────────────────────────────────────────
        if (entryName.endsWith('/')) {
          // This is a directory entry; create it and move to the next entry.
          mkdir(destPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(fail);
          return;
        }

        // ── 9. File entry: open read stream and pipe to disk ───────────────
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) {
            return fail(new Error(`Failed to read ZIP entry "${entryName}": ${streamErr.message}`));
          }

          // Create the parent directory if it does not exist yet.
          // (Many ZIPs omit directory entries and only include files.)
          mkdir(path.dirname(destPath), { recursive: true })
            .then(() => {
              // Open a write stream. { flags: 'wx' } means: create the file,
              // fail if it already exists. This prevents overwriting files
              // even if our duplicate-path check somehow missed an edge case.
              const writeStream = fs.createWriteStream(destPath, { flags: 'wx' });

              readStream.pipe(writeStream);

              writeStream.on('finish', () => {
                // File written successfully; read the next entry
                zipfile.readEntry();
              });

              writeStream.on('error', (writeErr) => {
                fail(new Error(`Failed to write "${entryName}": ${writeErr.message}`));
              });

              readStream.on('error', (readErr) => {
                fail(new Error(`Failed to read "${entryName}" from ZIP: ${readErr.message}`));
              });
            })
            .catch(fail);
        });
      });

      // ── 'end' fires when all entries have been processed ─────────────────
      zipfile.on('end', () => {
        succeed({ entryCount, totalUncompressedBytes });
      });

      // ── zipfile-level errors ──────────────────────────────────────────────
      zipfile.on('error', (zipErr) => {
        const msg = (zipErr && zipErr.message) || '';
        if (
          msg.includes('invalid relative path') ||
          msg.includes('absolute path') ||
          msg.includes('invalid characters')
        ) {
          fail(new Error(
            `ZIP contains an unsafe file path: "${msg}". ` +
            'Absolute paths, drive letters, and path traversal (..) are not allowed.'
          ));
        } else {
          fail(new Error(`Invalid or corrupt ZIP archive: ${msg}`));
        }
      });
    });
  });
}
