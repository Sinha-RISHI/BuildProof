/**
 * components/AppHeader.jsx
 *
 * What this file does:
 *   Clean top header bar with consistent typography and spacing.
 *   Provides:
 *     - Brand mark with ISO/IEC 25010 spec badge
 *     - Real-time environment and Docker socket connectivity status
 *     - Navigation links: Overview, How It Works, Scan History, Compliance Spec
 *     - "Upload ZIP" quick action button
 *     - Offline SVG user avatar
 */

import React from 'react';

export default function AppHeader({
  currentView,
  onNavigate,
  onTriggerUpload,
  onOpenCompliance,
  health,
}) {
  const isDockerReady = health?.docker?.reachable === true;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-md border-b border-surface-container">
      <div className="h-16 max-w-6xl mx-auto px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand & Environment Badge */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 text-left cursor-pointer group"
          >
            <span className="text-xl font-semibold text-primary tracking-tight group-hover:text-secondary transition-colors">
              BuildProof
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onOpenCompliance?.();
              }}
              title="Click to view ISO/IEC 25010 Specification details"
              className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-container text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors"
            >
              SPEC 25010
            </span>
          </button>

          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-surface-container">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isDockerReady
                  ? 'bg-secondary-container ring-2 ring-secondary-container/30'
                  : 'bg-error ring-2 ring-error/30'
              }`}
            />
            <span className="text-xs font-medium text-on-surface-variant">
              {isDockerReady
                ? 'Node 20 LTS · Sandbox Isolated'
                : 'Server Offline · Docker Disconnected'}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`text-sm transition-colors cursor-pointer ${
              currentView === 'dashboard'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-primary font-medium'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => onNavigate('how-it-works')}
            className={`text-sm transition-colors cursor-pointer ${
              currentView === 'how-it-works'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-primary font-medium'
            }`}
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className={`text-sm transition-colors cursor-pointer ${
              currentView === 'history'
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-primary font-medium'
            }`}
          >
            Scan History
          </button>
          <button
            type="button"
            onClick={() => onOpenCompliance?.()}
            className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            Compliance Spec
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (currentView !== 'dashboard') {
                onNavigate('dashboard');
              }
              onTriggerUpload?.();
            }}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors text-sm font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">file_upload</span>
            <span>Upload ZIP</span>
          </button>

          <div
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant"
            title="Auditor Session"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
