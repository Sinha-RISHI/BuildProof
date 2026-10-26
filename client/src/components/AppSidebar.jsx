/**
 * components/AppSidebar.jsx
 *
 * What this file does:
 *   Sidebar navigation matching the Stitch reference designs.
 *   Provides:
 *     - BuildProof brand logo and title
 *     - Navigation links (Dashboard, How It Works)
 *     - Real-time API Status (Connected / Connecting / Disconnected)
 *     - Real-time Docker Runtime Status (Docker OK / Docker Unavailable)
 *     - CLI / System version badge
 */

import React from 'react';

export default function AppSidebar({
  currentView,
  onNavigate,
  health,
  healthLoading,
}) {
  const isConnected = health?.ok === true;
  const isDockerOk = health?.docker?.reachable === true;

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-surface-container-lowest border-r border-outline-variant/30 z-50 flex flex-col justify-between select-none">
      {/* Brand & Navigation */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-outline-variant/20">
          <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-sm border border-primary/30">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-[15px] text-on-surface tracking-tight truncate leading-tight">
              BuildProof
            </span>
            <span className="font-mono text-[10px] text-primary tracking-widest uppercase">
              Handover Checker
            </span>
          </div>
        </div>

        {/* Audit Suite Navigation */}
        <div className="px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-outline px-2 py-1 font-semibold">
            Audit Suite
          </div>
          <nav className="flex flex-col gap-1 mt-1">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left w-full cursor-pointer ${
                currentView === 'dashboard' || currentView === 'progress' || currentView === 'result'
                  ? 'bg-surface-container-high text-primary border-l-2 border-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">terminal</span>
              <span className="text-[13px]">Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('how-it-works')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left w-full cursor-pointer ${
                currentView === 'how-it-works'
                  ? 'bg-surface-container-high text-primary border-l-2 border-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span className="text-[13px]">How It Works</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Footer System Status Panel */}
      <div className="p-4 border-t border-outline-variant/20 flex flex-col gap-3 bg-surface-dim/40">
        <div className="flex flex-col gap-2 rounded-lg bg-surface-container-low/80 p-2.5 border border-outline-variant/20">
          {/* API Status */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-on-surface-variant">API Status</span>
            <div className="flex items-center gap-1.5">
              {healthLoading ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                  </span>
                  <span className="font-mono text-[11px] text-amber-300 font-medium">Checking...</span>
                </>
              ) : isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
                  </span>
                  <span className="font-mono text-[11px] text-tertiary font-medium">Connected</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
                  </span>
                  <span className="font-mono text-[11px] text-error font-medium">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Docker Status */}
          <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
            <span className="font-mono text-[11px] text-on-surface-variant">Runtime Engine</span>
            <div className="flex items-center gap-1 text-on-surface">
              {healthLoading ? (
                <span className="font-mono text-[11px] text-outline">Detecting...</span>
              ) : isDockerOk ? (
                <>
                  <span className="material-symbols-outlined text-[14px] text-tertiary">token</span>
                  <span className="font-mono text-[11px] text-tertiary font-medium">Docker OK</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px] text-error">error</span>
                  <span className="font-mono text-[11px] text-error font-medium">Docker N/A</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Version Information */}
        <div className="flex items-center justify-between px-1 text-outline font-mono text-[11px]">
          <span>BuildProof System</span>
          <span className="text-on-surface-variant">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
