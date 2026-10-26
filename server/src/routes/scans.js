/**
 * routes/scans.js
 *
 * What this file does:
 *   Defines the HTTP endpoints for the scan lifecycle.
 *   Currently implements:
 *     POST /api/scans  — accept a ZIP upload and extract it safely
 *
 * How it fits into BuildProof:
 *   This is M1 of the build roadmap (ARCHITECTURE.md §12): "POST /api/scans
 *   accepts a ZIP and extracts it safely; unsafe ZIPs are rejected."
 *   After extraction succeeds, later steps (scanner, Docker runner, reporter)
 *   will advance the scan through its remaining stages.
 *
 * API design (ARCHITECTURE.md §7):
 *   POST /api/scans
 *     Body:    multipart/form-data, field name "project", one ZIP file
 *     Success: 202 { scanId, status, message, scanPath }
 *     Errors:  400 bad file / invalid ZIP / security violation
 *              413 file too large
 *              500 unexpected server error (handled by global error middleware)
 *
 * Security (ARCHITECTURE.md §9):
 *   - Uploaded filename is never used as a filesystem path.
 *   - Extracted files are inside server/data/scans/<scanId>/project/ only.
 *   - No uploaded code is executed.
 *   - Temp files and partial scan directories are deleted on failure.
 *   - Stack traces and absolute paths are never sent to the client.
 */

import { Router } from 'express';
import path from 'path';
import { rm, unlink, mkdir } from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { uploadMiddleware } from '../services/upload.js';
import { extractZip } from '../services/extract.js';
import { createScan, updateScan, getScan } from '../services/scanStore.js';
import { scanProject } from '../services/scanner.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/** Absolute path to the directory where scan sub-directories are created. */
const SCANS_DATA_DIR = path.resolve(__dirname, '../../data/scans');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * safeDelete(p)
 * Deletes a file or directory tree silently. Used in cleanup paths so that
 * a cleanup failure does not mask the original error.
 */
async function safeDelete(p, isDir = false) {
  try {
    if (isDir) {
      await rm(p, { recursive: true, force: true });
    } else {
      await unlink(p);
    }
  } catch (_) {
    // Ignore cleanup errors
  }
}

/**
 * isSafeExtractionError(message)
 * Returns true for error messages that are safe to show directly to the
 * client (they describe the problem with the uploaded file, not internals).
 */
function isSafeExtractionError(message) {
  const safeKeywords = [
    'Invalid or corrupt ZIP',
    'unsafe file path',
    'too many entries',
    'is too large',
    'total uncompressed size',
    'symbolic link',
    'duplicate path',
    'ZIP read error',
  ];
  return safeKeywords.some((kw) => message.includes(kw));
}

// ── POST /api/scans ───────────────────────────────────────────────────────────

router.post('/', (req, res, next) => {
  // Step 1: run multer to receive the uploaded file.
  // We wrap it in a callback so we can intercept multer errors (file too
  // large, wrong type, etc.) and turn them into clean JSON responses.
  uploadMiddleware.single('project')(req, res, async (uploadErr) => {
    // ── Handle multer errors ────────────────────────────────────────────────
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large. Maximum upload size is 50 MB.',
        });
      }
      // Wrong file type (fileFilter rejection) or other multer error
      return res.status(400).json({ error: uploadErr.message || 'Upload failed.' });
    }

    // ── No file was sent ────────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Send a ZIP file in the "project" form field.',
      });
    }

    // Path of the temp file multer saved to disk
    const tempFilePath = req.file.path;

    // ── Create a unique scan ID and directories ─────────────────────────────
    const scanId     = crypto.randomUUID();
    const scanDir    = path.join(SCANS_DATA_DIR, scanId);
    const projectDir = path.join(scanDir, 'project');

    try {
      await mkdir(projectDir, { recursive: true });
    } catch (mkdirErr) {
      await safeDelete(tempFilePath);
      return next(mkdirErr); // unexpected I/O error → 500
    }

    // ── Register the scan in the store ─────────────────────────────────────
    const projectName = path.basename(req.file.originalname, '.zip');
    createScan(scanId, {
      status: 'extracting',
      projectName,
    });

    // ── Extract the ZIP ────────────────────────────────────────────────────
    try {
      const { entryCount, totalUncompressedBytes } = await extractZip(tempFilePath, projectDir);

      // Clean up the temp upload now that extraction is done
      await safeDelete(tempFilePath);

      // Advance scan state to 'scanning' and run the static scanner (Milestone M2)
      updateScan(scanId, { status: 'scanning' });
      const scanResult = await scanProject(projectDir);

      // Store static findings and advance to 'installing' (Milestone M3 Docker runner)
      updateScan(scanId, {
        status: 'installing',
        stage: 'static_scan_complete',
        checks: scanResult.checks,
        scanResult,
      });

      // Respond with 202 Accepted (ARCHITECTURE.md §7)
      return res.status(202).json({
        scanId,
        status: 'queued',
        message: 'ZIP uploaded and extracted successfully. Ready for scanning.',
        projectName,
        // A relative path so we never expose absolute host filesystem paths
        scanPath: `scans/${scanId}`,
        meta: {
          filesExtracted: entryCount,
          totalUncompressedBytes,
        },
      });
    } catch (extractErr) {
      // Extraction or scan failed — clean up everything we created
      await safeDelete(tempFilePath);
      await safeDelete(scanDir, true); // remove the partial scan directory

      updateScan(scanId, { status: 'error', error: extractErr.message });

      // If the error describes a problem with the uploaded file, send 400.
      // Otherwise let the global error handler send 500 without leaking details.
      if (isSafeExtractionError(extractErr.message)) {
        return res.status(400).json({ error: extractErr.message });
      }

      return next(extractErr);
    }
  });
});

// ── GET /api/scans/:id ───────────────────────────────────────────────────────
// Returns current scan status and checks accumulated so far (ARCHITECTURE.md §7).
router.get('/:id', (req, res) => {
  const scan = getScan(req.params.id);
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  return res.json({
    scanId: scan.scanId,
    status: scan.status,
    stage: scan.stage ?? null,
    projectName: scan.projectName ?? null,
    checks: scan.checks ?? [],
    scanResult: scan.scanResult ?? null,
    createdAt: scan.createdAt,
  });
});

export default router;
