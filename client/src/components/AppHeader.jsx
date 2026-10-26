/**
 * components/AppHeader.jsx
 *
 * What this file does:
 *   Top header bar matching the Stitch designs.
 *   Provides:
 *     - Breadcrumb navigation display
 *     - Backend connectivity status chip
 *     - Help button leading to How It Works
 */

import React from 'react';

export default function AppHeader({ currentView, projectName, onNavigate, health }) {
  const isConnected = health?.ok === true;

  return (
    <header className="fixed top-0 left-60 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant/30 z-40 px-8 flex items-center justify-between">
      {/* Left Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-outline text-[18px]">developer_board</span>
        <div className="flex items-center gap-1.5 font-mono text-[13px] text-outline">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="hover:text-on-surface-variant transition-colors cursor-pointer"
          >
            Workspace
          </button>
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-medium capitalize">
            {currentView === 'how-it-works'
              ? 'How It Works'
              : projectName
              ? projectName
              : 'Dashboard'}
          </span>
        </div>
      </div>

      {/* Right Actions & Status */}
      <div className="flex items-center gap-4">
        {/* Backend Connection Chip */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected
                ? 'bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.6)]'
                : 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.6)]'
            }`}
          />
          <span className="font-mono text-[11px] text-on-surface-variant">
            Backend:{' '}
            <span className={isConnected ? 'text-tertiary font-medium' : 'text-error font-medium'}>
              {isConnected ? 'Connected :4000' : 'Disconnected'}
            </span>
          </span>
        </div>

        {/* Help Link */}
        <button
          type="button"
          onClick={() => onNavigate('how-it-works')}
          className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          title="How BuildProof Works"
        >
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
        </button>
      </div>
    </header>
  );
}
