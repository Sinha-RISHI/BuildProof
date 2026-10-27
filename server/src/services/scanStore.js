/**
 * services/scanStore.js
 *
 * What this file does:
 *   Maintains an in-memory record of every scan that has been started in this
 *   server process. Each scan is identified by its unique scanId (UUID).
 *
 * How it fits into BuildProof:
 *   When a ZIP is uploaded, the POST /api/scans handler creates a new record
 *   here and updates it as extraction (and later, scanning and Docker runs)
 *   progress. A future GET /api/scans/:id endpoint will read from this store
 *   to answer the frontend's polling requests.
 *
 * Implementation note:
 *   This is an in-memory store, so data is lost when the server restarts. For
 *   the hackathon prototype that is acceptable (ARCHITECTURE.md §2: no
 *   database). The scan files on disk persist independently.
 *
 * Scan status lifecycle (ARCHITECTURE.md §4):
 *   queued → extracting → scanning → installing → testing → reporting → done
 *   Any stage can transition to 'error' if BuildProof itself fails (which is
 *   different from a project check failing).
 */

/** @type {Map<string, object>} scanId → scan record */
const scans = new Map();

/**
 * createScan(scanId, initialData)
 * Stores a new scan record. Adds createdAt automatically.
 *
 * @param {string} scanId
 * @param {object} initialData  e.g. { status, projectName }
 */
export function createScan(scanId, initialData) {
  scans.set(scanId, {
    scanId,
    createdAt: new Date().toISOString(),
    ...initialData,
  });
}

/**
 * getScan(scanId)
 * Returns the scan record, or undefined if not found.
 *
 * @param {string} scanId
 * @returns {object|undefined}
 */
export function getScan(scanId) {
  return scans.get(scanId);
}

/**
 * updateScan(scanId, updates)
 * Merges updates into the existing scan record.
 * Returns false if the scanId is unknown.
 *
 * @param {string} scanId
 * @param {object} updates
 * @returns {boolean}
 */
export function updateScan(scanId, updates) {
  const current = scans.get(scanId);
  if (!current) return false;
  scans.set(scanId, { ...current, ...updates });
  return true;
}

/**
 * listScans()
 * Returns all recorded scans in reverse chronological order (newest first).
 * Sanitizes fields to ensure internal sensitive paths/logs are not exposed.
 *
 * @returns {Array<object>}
 */
export function listScans() {
  return Array.from(scans.values())
    .map((scan) => ({
      id: scan.scanId,
      scanId: scan.scanId,
      projectName: scan.projectName || 'Project Archive',
      originalFilename: scan.originalFilename || (scan.projectName ? `${scan.projectName}.zip` : 'project.zip'),
      ecosystem: scan.ecosystem || scan.scanResult?.ecosystem || 'node',
      status: scan.status,
      stage: scan.stage ?? null,
      verdict: scan.verdict ?? null,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt ?? null,
      hasReport: Boolean(scan.status === 'done' || (scan.reports && scan.reports.json)),
      checksCount: Array.isArray(scan.checks) ? scan.checks.length : 0,
      passedCount: Array.isArray(scan.checks) ? scan.checks.filter((c) => c.status === 'Passed').length : 0,
      failedCount: Array.isArray(scan.checks) ? scan.checks.filter((c) => c.status === 'Failed').length : 0,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
