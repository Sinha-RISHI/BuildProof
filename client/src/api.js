/**
 * api.js
 *
 * What this file does:
 *   This is the ONLY place in the frontend that communicates with the
 *   BuildProof backend server. All fetch() calls live here.
 *
 * How it fits into BuildProof:
 *   Other components (like App.jsx) call these functions instead of
 *   calling fetch() directly. That way, if the API ever changes, we only
 *   have to update one file, not hunt through every component.
 *
 * Note on the URL:
 *   We use "/api/health" (a path, not a full URL). Vite's dev-server proxy
 *   (configured in vite.config.js) automatically forwards any /api request
 *   to the backend at http://localhost:4000. In production, the real server
 *   would serve both the frontend and the API from the same host.
 */

/**
 * getHealth()
 *
 * Calls GET /api/health on the backend.
 * Returns the parsed JSON object on success.
 * Throws a clear Error on network failure or non-OK HTTP status.
 */
export async function getHealth() {
  const response = await fetch('/api/health');

  if (!response.ok) {
    // response.ok is false for status codes like 404, 500, etc.
    throw new Error(`Backend returned status ${response.status}`);
  }

  return response.json();
}
