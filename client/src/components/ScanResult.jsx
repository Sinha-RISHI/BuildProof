/**
 * components/ScanResult.jsx
 *
 * What this file does:
 *   Results view matching both Stitch reference designs:
 *     - "Scan result completed" for `ready`
 *     - "ScanResult Broken" for `not_ready`
 *     - Custom styled variant for `partially_verified`
 *
 * Capabilities:
 *   - Displays overall verdict badge and explanation.
 *   - Summary counter pills (Passed, Failed, Not Verified).
 *   - Detailed checklist cards for static inspections and Docker sandbox runs.
 *   - Expandable log viewer per check (fetching real stdout/stderr via /api/scans/:id/logs/:checkId).
 *   - Direct download links for report.json and report.html.
 *   - "Verify another project" action to reset back to Dashboard.
 */

import React, { useState } from 'react';
import { getScanLog, getReportJsonUrl, getReportHtmlUrl } from '../api.js';

export default function ScanResult({ scanRecord, onReset }) {
  const [expandedLogCheckId, setExpandedLogCheckId] = useState(null);
  const [checkLogs, setCheckLogs] = useState({});
  const [logLoading, setLogLoading] = useState(false);

  const scanId = scanRecord?.scanId || 'unknown-scan';
  const projectName = scanRecord?.projectName || 'Project Archive';
  const verdict = scanRecord?.verdict || 'not_ready';
  const checks = Array.isArray(scanRecord?.checks) ? scanRecord.checks : [];
  const warnings = Array.isArray(scanRecord?.warnings) ? scanRecord.warnings : [];

  // Summary counts
  const passedCount = checks.filter((c) => c.status === 'Passed').length;
  const failedCount = checks.filter((c) => c.status === 'Failed').length;
  const notVerifiedCount = checks.filter((c) => c.status === 'Not Verified').length;

  // Toggle log viewer for a check
  async function toggleLog(checkId) {
    if (expandedLogCheckId === checkId) {
      setExpandedLogCheckId(null);
      return;
    }

    setExpandedLogCheckId(checkId);
    if (!checkLogs[checkId]) {
      setLogLoading(true);
      try {
        const logContent = await getScanLog(scanId, checkId);
        setCheckLogs((prev) => ({ ...prev, [checkId]: logContent }));
      } catch (err) {
        setCheckLogs((prev) => ({
          ...prev,
          [checkId]: `Failed to fetch log: ${err.message}`,
        }));
      } finally {
        setLogLoading(false);
      }
    }
  }

  // Verdict theming
  const verdictThemes = {
    ready: {
      title: 'Ready for Handover',
      badgeClass: 'bg-tertiary/20 text-tertiary border-tertiary/40',
      bannerBg: 'border-tertiary/30 shadow-[0_0_30px_rgba(78,222,163,0.07)]',
      iconContainer: 'bg-tertiary/15 border-tertiary/40 text-tertiary shadow-[0_0_15px_rgba(78,222,163,0.2)]',
      icon: 'verified_user',
      description:
        'All critical project integrity and sandboxed test execution checks passed successfully. The archive is clean and reproducible.',
    },
    not_ready: {
      title: 'Not Ready for Handover',
      badgeClass: 'bg-error/20 text-error border-error/40',
      bannerBg: 'bg-error-container/20 border-error/30 shadow-lg shadow-error-container/10',
      iconContainer: 'bg-error-container/40 text-error border-error/40',
      icon: 'gpp_bad',
      description:
        'One or more critical checks failed during sandbox verification. Review the failure diagnostics and suggested actions below.',
    },
    partially_verified: {
      title: 'Partially Verified',
      badgeClass: 'bg-amber-400/20 text-amber-300 border-amber-400/40',
      bannerBg: 'bg-amber-500/10 border-amber-400/30 shadow-[0_0_30px_rgba(251,191,36,0.07)]',
      iconContainer: 'bg-amber-400/15 border-amber-400/40 text-amber-300',
      icon: 'pending_actions',
      description:
        'Installation passed, but tests or documentation could not be fully verified (e.g. placeholder test script or missing README).',
    },
  };

  const vTheme = verdictThemes[verdict] || verdictThemes.not_ready;

  return (
    <div className="flex flex-col w-full gap-8 max-w-6xl mx-auto py-2">
      {/* Top Meta & File Details Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/30">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 font-mono text-xs text-outline">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-surface-container text-primary font-medium tracking-wide">
              SCAN-ID
            </span>
            <span className="text-on-surface font-mono">{scanId.slice(0, 8)}</span>
            <span>•</span>
            <span>Deterministic Node.js Sign-Off</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[28px]">folder_zip</span>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight truncate font-mono">
              Scan Results: <span className="text-primary-fixed-dim">{projectName}</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={getReportHtmlUrl(scanId)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">html</span>
            <span>Download HTML</span>
          </a>

          <a
            href={getReportJsonUrl(scanId)}
            download
            className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">data_object</span>
            <span>Download JSON</span>
          </a>

          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">replay</span>
            <span>Verify Another Project</span>
          </button>
        </div>
      </div>

      {/* Primary Verdict Banner */}
      <div className={`relative overflow-hidden rounded-xl bg-surface-container-low p-6 md:p-8 border ${vTheme.bannerBg}`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-5 max-w-3xl">
            <div
              className={`w-14 h-14 shrink-0 rounded-xl border flex items-center justify-center ${vTheme.iconContainer}`}
            >
              <span className="material-symbols-outlined text-[32px]">{vTheme.icon}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`font-mono text-sm px-3 py-1 rounded border font-semibold tracking-wider uppercase ${vTheme.badgeClass}`}>
                  {vTheme.title}
                </span>
                <span className="font-mono text-xs text-outline">
                  Sandbox: node:20-alpine • 120s limit • 512 MB RAM • 1 CPU
                </span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {vTheme.description}
              </p>
            </div>
          </div>

          {/* Quick Triage Stats Matrix */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-outline-variant/20">
            <div className="flex flex-col items-center bg-surface-container px-4 py-2.5 rounded-lg border border-outline-variant/30 min-w-[80px]">
              <span className="font-mono text-xs text-outline">Passed</span>
              <span className="text-xl text-tertiary font-bold">{passedCount}</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container px-4 py-2.5 rounded-lg border border-outline-variant/30 min-w-[80px]">
              <span className="font-mono text-xs text-outline">Failed</span>
              <span className="text-xl text-error font-bold">{failedCount}</span>
            </div>
            <div className="flex flex-col items-center bg-surface-container px-4 py-2.5 rounded-lg border border-outline-variant/30 min-w-[80px]">
              <span className="font-mono text-xs text-outline">Not Verified</span>
              <span className="text-xl text-amber-300 font-bold">{notVerifiedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings & Observations Section (if present) */}
      {warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/30">
          <div className="flex items-center gap-2 mb-2 text-amber-300 font-semibold text-sm">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>Observations &amp; Warnings</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-amber-200/90 font-mono">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Checklist Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs uppercase tracking-wider text-outline font-semibold">
            Inspection Suite Execution Results
          </span>
          <span className="font-mono text-xs text-outline">
            Total Checks: {checks.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {checks.map((chk) => {
            const isFailed = chk.status === 'Failed';
            const isPassed = chk.status === 'Passed';
            const isNotVerified = chk.status === 'Not Verified';
            const hasLog = chk.id === 'install' || chk.id === 'tests';

            return (
              <div
                key={chk.id}
                className={`bg-surface-container p-5 rounded-xl border transition-all ${
                  isFailed
                    ? 'border-error/40 bg-error-container/5'
                    : isNotVerified
                    ? 'border-amber-400/30'
                    : 'border-outline-variant/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`material-symbols-outlined text-[22px] ${
                        isPassed
                          ? 'text-tertiary'
                          : isFailed
                          ? 'text-error'
                          : 'text-amber-300'
                      }`}
                    >
                      {isPassed ? 'check_circle' : isFailed ? 'cancel' : 'help'}
                    </span>
                    <span className="font-semibold text-sm text-on-surface">
                      {chk.title || chk.name}
                    </span>
                  </div>

                  <span
                    className={`font-mono text-xs px-2.5 py-0.5 rounded font-medium border ${
                      isPassed
                        ? 'bg-tertiary/15 text-tertiary border-tertiary/30'
                        : isFailed
                        ? 'bg-error/15 text-error border-error/30'
                        : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                    }`}
                  >
                    {chk.status}
                  </span>
                </div>

                <p className="text-sm text-on-surface-variant mb-2">
                  {chk.summary}
                </p>

                {/* Command & Execution Details */}
                {chk.command && (
                  <div className="flex items-center gap-3 font-mono text-xs text-outline mb-2">
                    <span>
                      Command: <code className="text-on-surface bg-surface-container-low px-1.5 py-0.5 rounded">{chk.command}</code>
                    </span>
                    {chk.exitCode !== null && (
                      <span>
                        Exit Code:{' '}
                        <strong className={chk.exitCode === 0 ? 'text-tertiary' : 'text-error'}>
                          {chk.exitCode}
                        </strong>
                      </span>
                    )}
                    {chk.durationMs !== null && (
                      <span>Duration: {(chk.durationMs / 1000).toFixed(2)}s</span>
                    )}
                  </div>
                )}

                {/* Evidence List */}
                {Array.isArray(chk.evidence) && chk.evidence.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-outline font-semibold uppercase tracking-wider block mb-1">
                      Evidence:
                    </span>
                    <ul className="list-disc list-inside font-mono text-xs text-on-surface-variant space-y-0.5">
                      {chk.evidence.map((ev, idx) => (
                        <li key={idx}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnosis / Next Step */}
                {chk.explanation && (
                  <div className="mt-2 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs font-mono">
                    <span className="text-error font-semibold">Diagnosis: </span>
                    <span className="text-on-surface-variant">{chk.explanation}</span>
                  </div>
                )}

                {chk.nextStep && (
                  <div className="mt-2 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 text-xs font-mono">
                    <span className="text-tertiary font-semibold">Suggested Action: </span>
                    <span className="text-on-surface-variant">{chk.nextStep}</span>
                  </div>
                )}

                {/* Expandable Log Toggle */}
                {hasLog && (
                  <div className="mt-3 pt-2 border-t border-outline-variant/20 flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleLog(chk.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary-fixed transition-colors cursor-pointer self-start"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {expandedLogCheckId === chk.id ? 'expand_less' : 'terminal'}
                      </span>
                      <span>
                        {expandedLogCheckId === chk.id
                          ? 'Hide Console Logs'
                          : `View Execution Logs for ${chk.title || chk.name}`}
                      </span>
                    </button>

                    {expandedLogCheckId === chk.id && (
                      <div className="mt-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 p-3 overflow-x-auto max-h-60 font-mono text-xs text-outline leading-relaxed select-text whitespace-pre-wrap">
                        {logLoading ? 'Fetching log from backend...' : checkLogs[chk.id] || '[No log output recorded]'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Disclaimer Card */}
      <footer className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3 text-xs text-outline">
        <span className="material-symbols-outlined text-[20px] text-outline shrink-0 mt-0.5">
          shield
        </span>
        <p className="text-on-surface-variant leading-relaxed">
          <strong className="text-on-surface">Auditor Notice &amp; Scope: </strong>
          A passing check confirms that project manifests and test commands ran successfully inside the
          isolated Docker container sandbox. It does not prove the software is bug-free, secure, or
          compatible with every external environment.
        </p>
      </footer>
    </div>
  );
}
