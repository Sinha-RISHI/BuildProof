/**
 * components/UploadZone.jsx
 *
 * What this file does:
 *   Dashboard screen and upload component matching the Stitch Dashboard design.
 *   Provides:
 *     - Drag-and-drop & file picker for project ZIP archives.
 *     - Real file preview (actual file name, size in MB).
 *     - Validation (50 MB limit, .zip extension check).
 *     - Submit action that triggers real upload to POST /api/scans.
 *     - Sandbox isolation policy card.
 *     - Three technical feature cards (Project Structure, Dependency Readiness, Test Verification).
 *     - System Environment Runtime Status Ribbon connected to real health data.
 */

import React, { useState, useRef } from 'react';

export default function UploadZone({
  onScanStarted,
  onNavigateHowItWorks,
  health,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

  function validateAndSelectFile(file) {
    setErrorMsg('');
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMsg('Invalid file type: Please upload a .zip archive.');
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMsg('File too large: Archive exceeds the maximum allowed 50 MB limit.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  }

  function handleReset(e) {
    if (e) e.stopPropagation();
    setSelectedFile(null);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleAnalyze() {
    if (!selectedFile || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onScanStarted(selectedFile);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start scan.');
      setIsSubmitting(false);
    }
  }

  const isDockerOk = health?.docker?.reachable === true;
  const dockerVersion = health?.docker?.version || 'Available';

  return (
    <div className="relative w-full overflow-hidden">
      {/* Ambient subtle background glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[280px] bg-primary-container/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-48 right-10 w-[320px] h-[220px] bg-tertiary/5 blur-[90px] rounded-full pointer-events-none" />

      {/* Header & Welcome Section */}
      <section className="flex flex-col items-center text-center max-w-3xl mx-auto pt-2 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/90 text-primary mb-4 shadow-sm border border-outline-variant/30">
          <span className="material-symbols-outlined text-[15px]">verified</span>
          <span className="font-mono text-[11px] tracking-wider uppercase font-medium">
            Deterministic Node.js Sign-Off
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-on-surface tracking-tight leading-tight mb-3">
          Is your project ready for handover?
        </h1>
        <p className="text-[15px] text-on-surface-variant max-w-2xl leading-relaxed">
          Upload a Node.js project archive to inspect structure integrity, manifest parity, and sandboxed test execution before contract sign-off.
        </p>
      </section>

      {/* Upload Card */}
      <section className="w-full max-w-4xl mx-auto mb-10">
        <div className="bg-surface-container rounded-xl shadow-xl border border-outline-variant/30 overflow-hidden">
          {/* Interactive Dropzone Panel */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={`relative m-4 p-8 md:p-10 rounded-xl bg-surface-container-lowest/80 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center border-2 border-dashed ${
              isDragging
                ? 'border-primary bg-primary/5'
                : selectedFile
                ? 'border-outline-variant/40 cursor-default'
                : 'border-outline-variant/40 hover:border-outline'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Error Banner */}
            {errorMsg && (
              <div className="w-full max-w-xl mb-4 p-3 rounded-lg bg-error-container/20 border border-error/30 text-error flex items-center gap-2 text-left text-sm">
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {!selectedFile ? (
              /* Unselected State */
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-primary mb-4 transition-transform duration-200">
                  <span className="material-symbols-outlined text-[28px]">upload_file</span>
                </div>
                <h3 className="text-lg font-semibold text-on-surface mb-1">
                  Drag and drop your project ZIP here
                </h3>
                <p className="text-sm text-outline mb-5">
                  or choose an archive directly from your local filesystem
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-md cursor-pointer mb-5"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                  <span>Choose ZIP File</span>
                </button>
                <div className="flex items-center gap-3 text-outline font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    .ZIP archives only
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    Max size 50 MB
                  </span>
                </div>
              </div>
            ) : (
              /* Staged / Selected File Preview State */
              <div className="w-full max-w-xl flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">folder_zip</span>
                    </div>
                    <div className="flex flex-col text-left min-w-0">
                      <span className="font-mono text-sm text-on-surface font-semibold truncate">
                        {selectedFile.name}
                      </span>
                      <span className="font-mono text-[11px] text-outline">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for sandbox mounting
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isSubmitting}
                      className="p-1.5 rounded-lg hover:bg-surface-variant text-outline hover:text-error transition-colors cursor-pointer"
                      title="Remove archive"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors text-sm cursor-pointer disabled:opacity-50"
                  >
                    Change Archive
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">
                          progress_activity
                        </span>
                        <span>Uploading Archive...</span>
                      </>
                    ) : (
                      <>
                        <span>Analyze Project</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Technical Isolation & Security Policy Banner */}
          <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/20 flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5 shrink-0">
              shield
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                Sandbox Isolation &amp; Security Policy
              </span>
              <span className="text-sm text-on-surface-variant leading-relaxed">
                Your project runs inside a disposable Docker container with limited CPU, memory, and time.
                Dependencies are installed with network access. Tests run with network isolation disabled.
                Containers reduce risk but are not perfect security.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Three Technical Feature Cards */}
      <section className="w-full max-w-4xl mx-auto mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Feature 1 */}
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/30 flex flex-col justify-between hover:bg-surface-container-high transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined text-[20px]">account_tree</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-sm text-on-surface">Project Structure</h4>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary">
                  Static
                </span>
              </div>
              <p className="text-xs text-outline leading-relaxed">
                Verifies mandatory manifest declarations, lockfile parity, README instructions, and environment variable templates.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-outline font-mono text-[11px] bg-surface-container-low/50 px-2.5 py-1 rounded">
              <span>Rule suite</span>
              <span className="text-on-surface font-medium">8 static checks</span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/30 flex flex-col justify-between hover:bg-surface-container-high transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-secondary mb-4">
                <span className="material-symbols-outlined text-[20px]">inventory_2</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-sm text-on-surface">Dependency Readiness</h4>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  package.json
                </span>
              </div>
              <p className="text-xs text-outline leading-relaxed">
                Verifies lockfile consistency with npm ci. Detects missing peer dependencies and lockfile version drift.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-outline font-mono text-[11px] bg-surface-container-low/50 px-2.5 py-1 rounded">
              <span>Package manager</span>
              <span className="text-on-surface font-medium">npm (node:20)</span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/30 flex flex-col justify-between hover:bg-surface-container-high transition-colors">
            <div>
              <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-tertiary mb-4">
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-sm text-on-surface">Test Verification</h4>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-tertiary/10 text-tertiary font-medium">
                  Sandboxed
                </span>
              </div>
              <p className="text-xs text-outline leading-relaxed">
                Executes the project's own npm test script inside a disposable container with network disabled and exit code capture.
              </p>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-outline font-mono text-[11px] bg-surface-container-low/50 px-2.5 py-1 rounded">
              <span>Resource caps</span>
              <span className="text-on-surface font-medium">120s, 512MB RAM, 1 CPU</span>
            </div>
          </div>
        </div>
      </section>

      {/* Guide link */}
      <div className="flex justify-center mb-8">
        <button
          type="button"
          onClick={onNavigateHowItWorks}
          className="inline-flex items-center gap-2 text-xs font-medium text-outline hover:text-primary transition-colors py-1 px-3 rounded-lg hover:bg-surface-container cursor-pointer"
        >
          <span>Learn how BuildProof validates handovers</span>
          <span className="material-symbols-outlined text-[16px]">arrow_right_alt</span>
        </button>
      </div>

      {/* System Environment Runtime Status Ribbon */}
      <section className="w-full max-w-4xl mx-auto">
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-outline font-mono text-[11px]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isDockerOk ? 'bg-tertiary' : 'bg-error'
                } opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isDockerOk ? 'bg-tertiary' : 'bg-error'
                }`}
              />
            </div>
            <span className="text-on-surface-variant font-medium">
              {isDockerOk ? 'Host Engine Active' : 'Docker Host Unavailable'}
            </span>
            <span className="text-outline-variant hidden sm:inline">•</span>
            <span className="text-on-surface font-mono hidden sm:inline">Node.js 20</span>
            <span className="text-outline-variant hidden sm:inline">•</span>
            <span className="text-on-surface font-mono hidden sm:inline">Docker {dockerVersion}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-tertiary">timer</span>
              <span>120s limit, 512 MB memory, 1 CPU</span>
            </div>
            <span className="text-outline font-mono">v0.1.0</span>
          </div>
        </div>
      </section>
    </div>
  );
}
