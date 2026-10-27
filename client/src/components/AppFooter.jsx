/**
 * components/AppFooter.jsx
 *
 * What this file does:
 *   Shared footer with refined typography and consistent max width.
 *   Provides standards references (ISO/IEC 25010, SOC2, NIST)
 *   and engine architecture details.
 */

import React from 'react';

export default function AppFooter({ onNavigate, onOpenCompliance }) {
  return (
    <footer className="w-full bg-surface-container-lowest mt-16 border-t border-surface-container">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand & Mission Statement */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-semibold text-primary">BuildProof</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                v4.8.2
              </span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm">
              Automated handover verification suite for software deliverables, evaluating real installability and testability before client delivery.
            </p>
          </div>

          {/* Standards & Specs */}
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Standards &amp; Specs
            </div>
            <ul className="space-y-1.5 text-sm text-on-surface-variant">
              <li>ISO/IEC 25010 Quality Model</li>
              <li>C4 Architectural Schematics</li>
              <li>SOC2 Type II Isolation</li>
              <li>NIST SP 800-218 SSDF</li>
            </ul>
          </div>

          {/* Engine Architecture */}
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Engine Architecture
            </div>
            <ul className="space-y-1.5 font-mono text-xs text-on-surface-variant">
              <li>Node 20 LTS Execution</li>
              <li>Restricted Docker Sandbox</li>
              <li>Zero Network Egress</li>
              <li>Deterministic Reports</li>
            </ul>
          </div>
        </div>

        {/* Legal & Navigation Links */}
        <div className="pt-6 border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div>
            <span>© 2025 BuildProof Architecture Labs · All rights reserved</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenCompliance}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Terms of Verification
            </button>
            <button
              type="button"
              onClick={() => onNavigate('how-it-works')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Security Architecture
            </button>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              Audit History
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
