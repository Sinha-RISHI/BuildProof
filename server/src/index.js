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
 * Run with:
 *   npm run dev   — starts the server and auto-restarts when files change
 *   npm start     — starts the server once, no auto-restart
 */

import express from 'express';
import cors from 'cors';

// Import our route modules
import healthRouter from './routes/health.js';

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
// Start listening
// -------------------------------------------------------------------
const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`BuildProof server running on http://localhost:${PORT}`);
});
