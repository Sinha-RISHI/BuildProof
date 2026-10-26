/**
 * services/upload.js
 *
 * What this file does:
 *   Configures multer, the library that handles multipart/form-data file
 *   uploads. It enforces size, type and count limits, and stores the uploaded
 *   file as a temporary file on disk before extraction begins.
 *
 * How it fits into BuildProof:
 *   The POST /api/scans route uses the middleware exported here. Multer reads
 *   the incoming request body, saves the file, and then passes control to our
 *   route handler, which validates the ZIP content and extracts it safely.
 *
 * Security note (ARCHITECTURE.md §9):
 *   - Only one file is accepted per request (multer's .single() enforces this).
 *   - Files larger than MAX_UPLOAD_BYTES are rejected before they are fully
 *     received, preventing the server from running out of disk space.
 *   - We do a first-pass extension check here, but the real ZIP validity check
 *     happens when yauzl tries to read the file in extract.js. A renamed
 *     non-ZIP file will pass the extension check but fail the content check.
 *
 * Field name:
 *   Per ARCHITECTURE.md Section 7, the multipart field name is "project".
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ── Paths ────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Temporary directory for incoming uploads (gitignored; created on demand)
const UPLOADS_DIR = path.resolve(__dirname, '../../data/uploads');

// ── Limits ───────────────────────────────────────────────────────────────────

/** Maximum upload size in bytes (50 MB). Multer enforces this on the stream. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// ── Storage: write to a temp file with a random UUID name ───────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create the uploads directory if it does not exist yet.
    // Using mkdirSync here is safe because this runs before any async work.
    try {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Always use a random UUID as the filename on disk.
    // We NEVER trust the user-supplied filename as a filesystem path.
    cb(null, `${crypto.randomUUID()}.zip`);
  },
});

// ── File filter: reject non-ZIP files before they are stored ─────────────────

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.zip') {
    cb(null, true); // Accept the file
  } else {
    // Returning an Error causes multer to pass it to next(err),
    // which our route handler catches and turns into a 400 response.
    cb(new Error('Only .zip files are accepted'));
  }
}

// ── Export the configured multer middleware ───────────────────────────────────

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES, // reject oversized files mid-stream
    files: 1,                   // accept no more than one file field
  },
  fileFilter,
});
