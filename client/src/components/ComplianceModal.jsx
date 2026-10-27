/**
 * components/ComplianceModal.jsx
 *
 * What this file does:
 *   Interactive modal displaying ISO/IEC 25010:2023 handover readiness
 *   specification sub-factors and compliance criteria.
 */

import React from 'react';

export default function ComplianceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container-lowest max-w-2xl w-full rounded-xl shadow-2xl border border-surface-container overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-container"></span>
            <span className="font-headline-sm text-headline-sm text-primary uppercase">
              ISO/IEC 25010:2023 Conformance
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="font-body-md text-body-md text-on-surface-variant">
            BuildProof automates verification of software deliverables against international standard
            <strong className="text-primary"> ISO/IEC 25010 Systems and Software Quality Models</strong>,
            specifically evaluating suitability for third-party engineering handover:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-surface-container-low rounded border border-surface-container">
              <span className="font-caption-caps text-caption-caps text-secondary font-bold block mb-1">
                7.1 FUNCTIONAL SUITABILITY
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Guarantees clean compilation and automated test suite pass without manual patching.
              </p>
            </div>

            <div className="p-3 bg-surface-container-low rounded border border-surface-container">
              <span className="font-caption-caps text-caption-caps text-secondary font-bold block mb-1">
                7.2 PERFORMANCE EFFICIENCY
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Enforces bounded memory ceiling (512 MB) and CPU resource utilization under isolation.
              </p>
            </div>

            <div className="p-3 bg-surface-container-low rounded border border-surface-container">
              <span className="font-caption-caps text-caption-caps text-secondary font-bold block mb-1">
                7.3 COMPATIBILITY &amp; COEXISTENCE
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Ensures zero ambient host reliance, strict LTS node runtime, and deterministic lockfile resolution.
              </p>
            </div>

            <div className="p-3 bg-surface-container-low rounded border border-surface-container">
              <span className="font-caption-caps text-caption-caps text-secondary font-bold block mb-1">
                7.4 PORTABILITY &amp; INSTALLABILITY
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Validates documented 1-click bootstrap scripts in README against actual runnable lifecycles.
              </p>
            </div>
          </div>

          <div className="p-4 bg-surface-container rounded font-label-technical text-label-technical text-on-surface-variant">
            <div className="text-primary font-bold mb-1">Mathematical Attestation</div>
            <div>All verification digests are signed using ED25519 cryptography to provide non-repudiation during handover audits.</div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-surface-container-low border-t border-surface-container flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-label-technical text-label-technical px-4 py-2 rounded bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors cursor-pointer"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
}
