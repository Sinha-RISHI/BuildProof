/**
 * components/ScanProgress.jsx
 *
 * What this file does:
 *   Scan In Progress screen matching the Stitch reference design.
 *   Provides:
 *     - Top Project Summary Card with pulse indicator and real scan metadata.
 *     - Execution sequence stepper with discrete stage states (completed, in progress, pending).
 *     - Live terminal log stream reflecting actual progress events and logs.
 *     - Reliable polling effect that checks GET /api/scans/:id until terminal state.
 *     - Error handling if the scan fails or the server becomes unreachable.
 */

import React, { useEffect, useState, useRef } from 'react';
import { getScan, getScanLog } from '../api.js';

export default function ScanProgress({
  scanId,
  initialProjectName,
  onScanCompleted,
  onScanFailed,
}) {
  const [scan, setScan] = useState(null);
  const [activeLogs, setActiveLogs] = useState([]);
  const [pollingError, setPollingError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Timer effect for elapsed duration
  useEffect(() => {
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, []);

  // Polling effect
  useEffect(() => {
    let isCancelled = false;

    async function poll() {
      try {
        const record = await getScan(scanId);
        if (isCancelled) return;

        setScan(record);
        setPollingError(null);

        // Append log events based on status changes
        setActiveLogs((prev) => {
          const lines = [...prev];
          const timeStr = new Date().toISOString().slice(11, 19);

          const statusMessages = {
            queued: `[${timeStr}] [UPLOAD] Archive staged and verified in isolated workspace.`,
            extracting: `[${timeStr}] [EXTRACT] Unpacking project files safely with path containment.`,
            scanning: `[${timeStr}] [SCANNER] Running static inspection (package.json, lockfile, README, .env).`,
            installing: `[${timeStr}] [DOCKER] Spawning disposable container (node:20-alpine). Installing dependencies...`,
            testing: `[${timeStr}] [DOCKER] Executing tests with network isolation (--network none)...`,
            reporting: `[${timeStr}] [REPORT] Generating structured JSON and standalone HTML reports...`,
            done: `[${timeStr}] [VERDICT] Scan complete. Final verdict: ${record.verdict || 'ready'}`,
          };

          const newMsg = statusMessages[record.status];
          if (newMsg && !lines.includes(newMsg)) {
            lines.push(newMsg);
          }

          return lines;
        });

        // Check terminal state
        if (record.status === 'done') {
          clearInterval(pollIntervalRef.current);
          clearInterval(timerIntervalRef.current);

          // If install or test logs are present, fetch them to display
          if (record.checks?.some((c) => c.id === 'install')) {
            getScanLog(scanId, 'install').then((log) => {
              if (log && !isCancelled) {
                setActiveLogs((prev) => [...prev, `--- INSTALL LOG ---\n${log.slice(0, 1000)}`]);
              }
            });
          }

          // Transition to results screen after brief settle
          setTimeout(() => {
            if (!isCancelled) {
              onScanCompleted(record);
            }
          }, 800);
        } else if (record.status === 'error') {
          clearInterval(pollIntervalRef.current);
          clearInterval(timerIntervalRef.current);
          onScanFailed(record.error || 'Scan encountered an error during execution');
        }
      } catch (err) {
        if (!isCancelled) {
          setPollingError(err.message || 'Lost connection to backend server');
        }
      }
    }

    // Initial immediate poll
    poll();
    // Poll every 1200ms
    pollIntervalRef.current = setInterval(poll, 1200);

    return () => {
      isCancelled = true;
      clearInterval(pollIntervalRef.current);
      clearInterval(timerIntervalRef.current);
    };
  }, [scanId, onScanCompleted, onScanFailed]);

  // Determine stage states based on real scan.status / scan.stage
  const status = scan?.status || 'queued';
  const stage = scan?.stage || '';

  // Stages definition
  const stages = [
    {
      id: 'extract',
      title: 'Validating & extracting ZIP archive',
      description: 'Verifies archive headers, rejects path traversal and dangerous symlinks.',
      isDone: ['scanning', 'installing', 'testing', 'reporting', 'done'].includes(status),
      isActive: ['queued', 'extracting'].includes(status),
    },
    {
      id: 'static',
      title: 'Inspecting project structure & manifest',
      description: 'Checks package.json, entry points, lockfile, README, and environment variables.',
      isDone: ['installing', 'testing', 'reporting', 'done'].includes(status),
      isActive: status === 'scanning',
    },
    {
      id: 'install',
      title: 'Installing dependencies in Docker sandbox',
      description: 'Runs npm ci inside disposable node:20-alpine container with strict resource caps.',
      isDone: ['testing', 'reporting', 'done'].includes(status) || stage === 'docker_complete',
      isActive: status === 'installing',
    },
    {
      id: 'test',
      title: 'Executing automated test suite',
      description: 'Runs npm test with network disabled (--network none) and captures exit code.',
      isDone: ['reporting', 'done'].includes(status) || stage === 'docker_complete',
      isActive: status === 'testing',
    },
    {
      id: 'report',
      title: 'Generating handover report & verdict',
      description: 'Calculates verdict and generates downloadable report.json and standalone report.html.',
      isDone: status === 'done',
      isActive: status === 'reporting',
    },
  ];

  const currentPhaseIndex = stages.findIndex((s) => s.isActive);
  const phaseDisplay = currentPhaseIndex >= 0 ? currentPhaseIndex + 1 : status === 'done' ? 5 : 1;
  const projectName = scan?.projectName || initialProjectName || 'Project Archive';

  return (
    <div className="flex flex-col w-full gap-6 select-none max-w-6xl mx-auto py-2">
      {/* Polling Error Alert */}
      {pollingError && (
        <div className="p-3.5 rounded-xl bg-error-container/20 border border-error/30 text-error flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">cloud_off</span>
            <span className="text-sm font-medium">Reconnecting to scanner: {pollingError}</span>
          </div>
          <span className="font-mono text-xs">Retrying...</span>
        </div>
      )}

      {/* Top Project Summary Card */}
      <div className="bg-surface-container rounded-xl p-6 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-inner border border-outline-variant/20">
            <span className="material-symbols-outlined text-[28px]">folder_zip</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold text-on-surface truncate tracking-tight font-mono">
                {projectName}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-medium border border-primary/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                SCAN IN PROGRESS
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-1">
              Running Docker sandbox verification for Node.js project structure, manifests, and automated tests.
            </p>
            <div className="flex items-center gap-3 font-mono text-xs text-outline mt-2">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Elapsed: {elapsedSeconds}s
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-primary">
                <span className="material-symbols-outlined text-[14px]">fingerprint</span>
                Scan ID: {scanId.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {/* Phase Indicator */}
        <div className="flex items-center gap-4 shrink-0 bg-surface-container-low px-5 py-3 rounded-xl border border-outline-variant/20">
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
            {phaseDisplay}/5
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-outline font-semibold">Current Phase</span>
            <span className="text-sm font-semibold text-on-surface">Phase {phaseDisplay} of 5</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Stepper & Log Stream Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Multi-Stage Execution Stepper (5 Cols) */}
        <div className="lg:col-span-5 bg-surface-container rounded-xl p-5 shadow-sm border border-outline-variant/30 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">account_tree</span>
              <span className="font-semibold text-sm text-on-surface">Execution Sequence</span>
            </div>
            <span className="font-mono text-xs text-outline">Deterministic Engine</span>
          </div>

          {/* Stepper List */}
          <div className="flex flex-col relative py-2">
            <div className="absolute left-[17px] top-6 bottom-6 w-[2px] bg-surface-container-highest" />

            {stages.map((stg) => (
              <div
                key={stg.id}
                className={`relative flex items-start gap-3 py-3 transition-colors ${
                  stg.isActive ? 'bg-surface-container-high/60 rounded-lg px-2 -mx-2' : ''
                }`}
              >
                {/* Status Dot / Icon */}
                <div
                  className={`z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    stg.isDone
                      ? 'bg-tertiary/20 text-tertiary border border-tertiary/30'
                      : stg.isActive
                      ? 'bg-primary-container text-on-primary shadow-md'
                      : 'bg-surface-variant text-outline'
                  }`}
                >
                  {stg.isDone ? (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  ) : stg.isActive ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                  )}
                </div>

                <div className="flex flex-col min-w-0 pt-0.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold truncate ${
                        stg.isDone
                          ? 'text-on-surface'
                          : stg.isActive
                          ? 'text-primary'
                          : 'text-outline'
                      }`}
                    >
                      {stg.title}
                    </span>
                    <span
                      className={`font-mono text-[10px] shrink-0 font-medium ${
                        stg.isDone
                          ? 'text-tertiary'
                          : stg.isActive
                          ? 'text-primary'
                          : 'text-outline'
                      }`}
                    >
                      {stg.isDone ? 'COMPLETED' : stg.isActive ? 'IN PROGRESS' : 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    {stg.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Live Terminal Output (7 Cols) */}
        <div className="lg:col-span-7 bg-surface-container rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 flex flex-col">
          {/* Terminal Header Bar */}
          <div className="bg-surface-container-high px-4 py-3 flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
              </div>
              <div className="flex items-center gap-1.5 ml-2 font-mono text-xs text-on-surface">
                <span className="material-symbols-outlined text-[16px] text-tertiary">terminal</span>
                <span>Sandbox Execution Stream</span>
              </div>
            </div>
            <span className="font-mono text-[11px] text-tertiary flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-tertiary" />
              </span>
              STREAMING
            </span>
          </div>

          {/* Terminal Log Content */}
          <div className="p-4 font-mono text-xs bg-surface-container-lowest text-on-surface-variant flex-1 overflow-y-auto max-h-[380px] space-y-1.5">
            {activeLogs.length === 0 ? (
              <div className="text-outline italic">Awaiting container initialization...</div>
            ) : (
              activeLogs.map((logLine, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed whitespace-pre-wrap ${
                    logLine.includes('[VERDICT]')
                      ? 'text-tertiary font-bold'
                      : logLine.includes('[DOCKER]')
                      ? 'text-primary'
                      : logLine.includes('FAIL') || logLine.includes('error')
                      ? 'text-error'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {logLine}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
