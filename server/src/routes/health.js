/**
 * routes/health.js
 *
 * What this file does:
 *   Defines the GET /api/health endpoint.
 *   It tells callers two things:
 *     1. The BuildProof server is alive (ok: true).
 *     2. Whether Docker is reachable, and if so, which version is running.
 *
 * How it fits into BuildProof:
 *   The frontend dashboard can call this to show a "system ready" indicator
 *   before the user uploads anything. We also use it during development to
 *   confirm the server started correctly.
 *
 * Important rule:
 *   "ok" is ALWAYS true as long as the Express server itself is running.
 *   A Docker problem only shows up inside the "docker" object.
 *   We never return an HTTP error just because Docker is unavailable.
 */

import { Router } from 'express';
import { checkDocker } from '../services/dockerCheck.js';

const router = Router();

// GET /api/health
// (Mounted at /api/health in index.js, so the route path here is just "/")
router.get('/', async (req, res) => {
  try {
    // Ask our Docker checker how Docker is doing
    const docker = await checkDocker();

    // Build the response object in exactly the shape required by ARCHITECTURE.md §7
    const response = {
      ok: true,                         // server is alive
      service: 'buildproof-server',
      time: new Date().toISOString(),   // current time in ISO 8601 format
      docker,                           // { reachable, version, error }
    };

    res.json(response);
  } catch (err) {
    // This should never happen because checkDocker() never throws,
    // but we guard anyway so one bad request cannot crash the server.
    // The error-handling middleware in index.js will catch this.
    throw err;
  }
});

export default router;
