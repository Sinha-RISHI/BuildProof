/**
 * index.js
 *
 * What this file does:
 *   This is the entry point for the BuildProof backend server.
 *   It creates an Express app, attaches middleware (CORS, JSON parsing),
 *   registers all routes, and starts listening on a port.
 *
 * How it fits into BuildProof:
 *   Every HTTP request from the browser (or from curl during testing) comes
 *   here first. Express then forwards it to the right route handler.
 *
 * Exports:
 *   The `app` object is exported so that test files can import it and start
 *   the server on a random port without touching port 4000.
 *
 * Run with:
 *   npm run dev   — starts the server and auto-restarts when files change
 *   npm start     — starts the server once, no auto-restart
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Import our route modules
import healthRouter from './routes/health.js';
import scansRouter  from './routes/scans.js';

// -------------------------------------------------------------------
// Create the Express application
// -------------------------------------------------------------------
const app = express();

// CORS middleware — allows the React frontend (running on a different port
// during development) to call this API without the browser blocking it.
app.use(cors());

// JSON middleware — automatically parses incoming request bodies that are
// JSON, so we can read req.body in route handlers.
app.use(express.json());

// -------------------------------------------------------------------
// Routes
// -------------------------------------------------------------------

// Health check: GET /api/health
app.use('/api/health', healthRouter);

// Scan lifecycle: POST /api/scans  (Step 4: upload + extraction)
app.use('/api/scans', scansRouter);

// -------------------------------------------------------------------
// 404 handler
// Catches any request that did not match a route above.
// Note: we use app.use() with no path string (not "*" or "/*") because
// wildcard syntax differs between Express versions and can cause errors.
// -------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// -------------------------------------------------------------------
// Global error handler
// Express identifies this as an error handler because it has exactly
// four parameters: (err, req, res, next).
// If any route or middleware calls next(err) or throws (in async routes
// wrapped with a try/catch that re-throws), it lands here.
// This prevents one bad request from crashing the whole server.
// -------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// -------------------------------------------------------------------
// Start listening — only when this file is run directly (not imported
// by the test suite, which starts its own server on a random port).
// -------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);

// import.meta.url gives the URL of this file; process.argv[1] gives the
// path of the entry-point file Node.js was asked to run.
// They match when this IS the entry point, and differ when it is imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT ?? 4000;
  app.listen(PORT, () => {
    console.log(`BuildProof server running on http://localhost:${PORT}`);
  });
}

export default app;
