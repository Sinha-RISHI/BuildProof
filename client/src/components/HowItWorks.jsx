/**
 * components/HowItWorks.jsx
 *
 * What this file does:
 *   How It Works explanation screen matching the Stitch Howitworks design.
 *   Provides:
 *     - Header block with specification ribbon
 *     - 4-stage architectural pipeline ribbon visualization:
 *       1. Unpack & Cleanse (Zip-slip and traversal mitigation)
 *       2. Static Inspection (Manifest, lockfile, README, .env parity)
 *       3. Docker Ephemeral Sandbox (cgroups limits, non-root, network none for tests)
 *       4. Deterministic Handover Reports (report.json & standalone report.html)
 *     - Deep dive breakdown for each stage with truthful security explanations.
 *     - Quick-action button returning to the Dashboard.
 */

import React from 'react';

export default function HowItWorks({ onNavigateDashboard }) {
  return (
    <div className="flex flex-col gap-8 pb-16 max-w-6xl mx-auto py-2">
      {/* Header Block with Metadata Ribbon */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-2.5 py-0.5 rounded bg-surface-container font-mono text-xs text-primary uppercase tracking-widest border border-outline-variant/30">
            SPECIFICATION // ARCH-M4
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
          <span className="font-mono text-xs text-outline">
            AUDIT ENGINE v0.1.0
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
          <div className="flex items-center gap-1.5 text-tertiary">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span className="font-mono text-xs">SANDBOX HARDENED</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">
              How BuildProof Works
            </h1>
            <p className="text-base text-on-surface-variant max-w-2xl mt-1">
              Understanding our deterministic 4-stage evidence-based handover verification process.
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateDashboard}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed transition-colors font-medium text-xs self-start md:self-auto shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span>Launch Handover Checker</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Architectural Pipeline Ribbon Visualization */}
      <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-outline uppercase tracking-wider">
            Execution Flow // Automated Pipeline
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.6)]" />
            <span className="font-mono text-xs text-on-surface-variant">Host Isolation Enforced</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-bold">
              01
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-on-surface truncate">Unpack &amp; Cleanse</span>
              <span className="font-mono text-[10px] text-outline truncate">Zip-Slip Mitigation</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-lowest text-primary font-bold">
              02
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-on-surface truncate">Static Manifest</span>
              <span className="font-mono text-[10px] text-outline truncate">8 Structural Checks</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-lowest text-tertiary font-bold">
              03
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-on-surface truncate">Docker Ephemeral</span>
              <span className="font-mono text-[10px] text-outline truncate">512MB RAM, Network None</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center gap-3">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-lowest text-secondary font-bold">
              04
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-on-surface truncate">Evidence Reports</span>
              <span className="font-mono text-[10px] text-outline truncate">JSON &amp; Standalone HTML</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Step Deep Dive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1 */}
        <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-4 hover:border-outline-variant/60 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">archive</span>
              </div>
              <div>
                <span className="font-mono text-[11px] text-primary uppercase font-medium">Stage 01 // Input Validation</span>
                <h2 className="font-bold text-base text-on-surface">1. Archive Validation &amp; Safe Extraction</h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-[11px] text-outline">
              M1 Safe Extract
            </span>
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">
            Strict extraction routine preventing malicious path overwrites and guaranteeing archive file header integrity before inspection.
          </p>

          <ul className="flex flex-col gap-2 font-mono text-xs text-on-surface">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Rejects zip-slip path traversal (.., absolute paths, Windows drive letters).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Enforces 50 MB total upload limit and maximum entry count caps.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Rejects symbolic links to avoid host filesystem referencing.</span>
            </li>
          </ul>
        </div>

        {/* Step 2 */}
        <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-4 hover:border-outline-variant/60 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">account_tree</span>
              </div>
              <div>
                <span className="font-mono text-[11px] text-primary uppercase font-medium">Stage 02 // Static Discovery</span>
                <h2 className="font-bold text-base text-on-surface">2. Static Manifest &amp; Structure Inspection</h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-[11px] text-outline">
              M2 Scanner
            </span>
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">
            Static inspections check repository conventions and files without running any project code.
          </p>

          <ul className="flex flex-col gap-2 font-mono text-xs text-on-surface">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Validates package.json presence, format, and configured test scripts.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Detects lockfiles (package-lock.json) for reproducible dependency installs.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Checks for README setup guidelines and .env.example configuration templates.</span>
            </li>
          </ul>
        </div>

        {/* Step 3 */}
        <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-4 hover:border-outline-variant/60 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">token</span>
              </div>
              <div>
                <span className="font-mono text-[11px] text-tertiary uppercase font-medium">Stage 03 // Sandbox Execution</span>
                <h2 className="font-bold text-base text-on-surface">3. Restricted Docker Execution</h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-[11px] text-outline">
              M3 Runner
            </span>
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">
            Dependency installation and test runs are executed only inside disposable, constrained containers.
          </p>

          <ul className="flex flex-col gap-2 font-mono text-xs text-on-surface">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Phase 1 (install): Runs npm ci inside disposable node:20-alpine container.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Phase 2 (tests): Runs npm test with network disabled (--network none).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span>Enforces non-root user (node), 512MB RAM, 1 CPU, and 120s timeout limits.</span>
            </li>
          </ul>
        </div>

        {/* Step 4 */}
        <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/30 flex flex-col gap-4 hover:border-outline-variant/60 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">description</span>
              </div>
              <div>
                <span className="font-mono text-[11px] text-secondary uppercase font-medium">Stage 04 // Handover Decision</span>
                <h2 className="font-bold text-base text-on-surface">4. Evidence Reports &amp; Verdict</h2>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-[11px] text-outline">
              M4 Reports
            </span>
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">
            Serializes real findings into deterministic reports with three clear verdict levels:
          </p>

          <ul className="flex flex-col gap-2 font-mono text-xs text-on-surface">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0 mt-0.5">verified</span>
              <span>Ready for Handover: All critical static, install, and test checks passed.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-error text-[16px] shrink-0 mt-0.5">cancel</span>
              <span>Not Ready: One or more critical checks, installs, or tests failed.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-300 text-[16px] shrink-0 mt-0.5">pending_actions</span>
              <span>Partially Verified: Install succeeded, but test scripts or docs were missing.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
