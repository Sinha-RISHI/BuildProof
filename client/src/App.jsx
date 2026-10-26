/**
 * App.jsx
 *
 * What this file does:
 *   The main page of BuildProof. It shows two status cards:
 *     1. Backend — is the Express server reachable?
 *     2. Docker  — is Docker running and what version is it?
 *
 * How it fits into BuildProof:
 *   This is Step 2 of the build: just the system-status skeleton.
 *   File upload, scan results and report views come in later steps.
 *
 * How the data flows:
 *   1. Page loads → useEffect runs → calls getHealth() from api.js
 *   2. getHealth() fetches /api/health (Vite proxies it to port 4000)
 *   3. Result is saved in React state → cards re-render with real data
 *   4. "Check again" button repeats step 1 on demand
 */

import { useState, useEffect } from 'react';
import { getHealth } from './api.js';
import StatusCard from './components/StatusCard.jsx';

export default function App() {
  // "loading" | "ok" | "error" — tracks the overall request state
  const [status, setStatus] = useState('loading');

  // Holds the JSON object returned by /api/health (or null while loading / on error)
  const [health, setHealth] = useState(null);

  // A human-readable message about why the backend call failed (if it did)
  const [backendError, setBackendError] = useState(null);

  /**
   * runCheck()
   * Fetches /api/health and updates state.
   * All failures are caught here — no unhandled promise rejections.
   */
  async function runCheck() {
    setStatus('loading');
    setHealth(null);
    setBackendError(null);

    try {
      const data = await getHealth();
      setHealth(data);
      setStatus('ok');
    } catch (err) {
      setBackendError(err.message);
      setStatus('error');
    }
  }

  // Run the check automatically when the page first loads
  useEffect(() => {
    runCheck();
  }, []); // Empty array means "run once on mount"

  // --- Derive the props for each StatusCard from state ---

  // Backend card
  const backendCard = (() => {
    if (status === 'loading') {
      return { state: 'loading', message: 'Contacting server...' };
    }
    if (status === 'error') {
      return {
        state: 'error',
        message: 'Backend not reachable. Start it with:  cd server  →  npm run dev',
      };
    }
    return { state: 'ok', message: 'Server is running' };
  })();

  // Docker card
  const dockerCard = (() => {
    if (status === 'loading') {
      return { state: 'loading', message: 'Contacting server...' };
    }
    if (status === 'error') {
      return {
        state: 'error',
        message: 'Unknown — backend is not reachable',
      };
    }
    // Backend responded; inspect the docker sub-object
    const docker = health?.docker;
    if (docker?.reachable) {
      return {
        state: 'ok',
        message: 'Docker is running',
        detail: `Version ${docker.version}`,
      };
    }
    return {
      state: 'error',
      message: docker?.error ?? 'Docker is not reachable',
    };
  })();

  return (
    // Full-height dark navy page background
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-4 py-16">

      {/* ── Header ── */}
      <header className="mb-12 text-center">
        {/* Blue accent on the title */}
        <h1 className="text-5xl font-bold tracking-tight text-blue-400 mb-2">
          BuildProof
        </h1>
        <p className="text-gray-400 text-lg">
          Project Handover Readiness Checker
        </p>
      </header>

      {/* ── Status cards ── */}
      <main className="w-full max-w-lg flex flex-col gap-4">
        <StatusCard title="Backend" {...backendCard} />
        <StatusCard title="Docker"  {...dockerCard}  />

        {/* "Check again" button — disabled while a request is in flight */}
        <div className="flex justify-center mt-4">
          <button
            onClick={runCheck}
            disabled={status === 'loading'}
            className="
              rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white
              hover:bg-blue-500 active:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150
            "
          >
            {status === 'loading' ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 text-center text-gray-600 text-xs">
        Step 2 skeleton — upload and verification come in later steps.
      </footer>

    </div>
  );
}
