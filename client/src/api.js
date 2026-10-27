/**
 * api.js
 *
 * What this file does:
 *   Centralized API client for all BuildProof backend communications.
 *   Provides clean, typed-like helper functions for:
 *     - Health check (GET /api/health)
 *     - Scan upload (POST /api/scans)
 *     - Scan status polling (GET /api/scans/:id)
 *     - Check log fetching (GET /api/scans/:id/logs/:checkId)
 *     - Report URLs (GET /api/scans/:id/report.json and report.html)
 *
 * Security & Reliability:
 *   - Uses relative paths (/api/...) proxied by Vite in dev and served
 *     directly in production.
 *   - Parses JSON error bodies from the backend (e.g. { error: "..." }).
 *   - Never evaluates or executes uploaded content.
 */

/**
 * getHealth()
 * Checks backend server and Docker sandbox connectivity.
 * @returns {Promise<{ ok: boolean, service: string, time: string, docker: { reachable: boolean, version: string|null, error: string|null } }>}
 */
export async function getHealth() {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      service: 'buildproof-server',
      time: new Date().toISOString(),
      docker: {
        reachable: false,
        version: null,
        error: err.message || 'Cannot reach BuildProof server',
      },
    };
  }
}

/**
 * uploadScan(file)
 * Sends a ZIP archive to POST /api/scans using multipart/form-data.
 * Field name is strictly "project" as required by ARCHITECTURE.md §7.
 *
 * @param {File} file
 * @returns {Promise<{ scanId: string, status: string, message: string, projectName: string, scanPath: string, meta: object }>}
 */
export async function uploadScan(file) {
  if (!file) {
    throw new Error('Please select a ZIP file to upload.');
  }

  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('Only .zip archives are supported.');
  }

  // 50 MB client-side limit check
  const MAX_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error('File exceeds the 50 MB size limit.');
  }

  const formData = new FormData();
  formData.append('project', file);

  const res = await fetch('/api/scans', {
    method: 'POST',
    body: formData,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Upload failed with status ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Upload failed with status ${res.status}`);
  }

  return data;
}

/**
 * getScan(scanId)
 * Fetches current scan record from GET /api/scans/:id.
 *
 * @param {string} scanId
 * @returns {Promise<{ scanId: string, status: string, stage: string|null, projectName: string|null, verdict: string|null, checks: Array, scanResult: object|null, createdAt: string }>}
 */
export async function getScan(scanId) {
  if (!scanId) {
    throw new Error('Scan ID is required');
  }

  const res = await fetch(`/api/scans/${encodeURIComponent(scanId)}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Failed to load scan with status ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch scan (HTTP ${res.status})`);
  }

  return data;
}

/**
 * getScanLog(scanId, checkId)
 * Fetches raw plain text log for a given check (e.g. 'install' or 'tests').
 *
 * @param {string} scanId
 * @param {string} checkId
 * @returns {Promise<string>}
 */
export async function getScanLog(scanId, checkId) {
  if (!scanId || !checkId) return '';

  try {
    const res = await fetch(`/api/scans/${encodeURIComponent(scanId)}/logs/${encodeURIComponent(checkId)}`);
    if (!res.ok) {
      return `[No log available for check "${checkId}" (HTTP ${res.status})]`;
    }
    return await res.text();
  } catch (err) {
    return `[Failed to retrieve log: ${err.message}]`;
  }
}

/**
 * Helper to get the download URL for JSON report
 */
export function getReportJsonUrl(scanId) {
  return `/api/scans/${encodeURIComponent(scanId)}/report.json`;
}

/**
 * Helper to get the URL for HTML report (viewable or downloadable)
 */
export function getReportHtmlUrl(scanId) {
  return `/api/scans/${encodeURIComponent(scanId)}/report.html`;
}

/**
 * listScans()
 * Fetches all historical scan summaries from GET /api/scans.
 * @returns {Promise<Array<{ id: string, scanId: string, projectName: string, originalFilename: string, status: string, stage: string|null, verdict: string|null, createdAt: string, completedAt: string|null, hasReport: boolean, checksCount: number, passedCount: number, failedCount: number }>>}
 */
export async function listScans() {
  const res = await fetch('/api/scans');
  if (!res.ok) {
    let errorMsg = `Failed to load scans (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // Ignore JSON parse error and use status message
    }
    throw new Error(errorMsg);
  }
  return await res.json();
}
