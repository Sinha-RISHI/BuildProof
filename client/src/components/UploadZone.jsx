/**
 * components/UploadZone.jsx
 *
 * What this file does:
 *   Continuous 5-Stage Cinematic Scroll Experience for BuildProof:
 *     - Stage 1: Handover Problem & Prominent ZIP Upload Dropzone + Compact 3D Archive
 *     - Stage 2: Archive Deconstruction (5-layer strata separation: package.json, README, lockfile, tests, src)
 *     - Stage 3: Static & Dependency Inspection (Manifest syntax, lockfile determinism, setup guide sync)
 *     - Stage 4: Isolated Docker Execution (Sandboxed testing chamber, dark atmosphere, verified flags)
 *     - Stage 5: Project Handover Dossier (Actionable readiness report, real/illustrative verdict, download CTAs)
 *
 * Verified Security Controls (from server/src/services/dockerRunner.js):
 *   --network none (tests), --memory 512m, --cpus 1, --pids-limit 256, --cap-drop ALL,
 *   --security-opt no-new-privileges, --user node, node:20-alpine, ephemeral --rm.
 *
 * Reliability & Accessibility:
 *   - Driven by Motion for React (CSS 3D without Three.js)
 *   - Accessible reduced-motion fallback rendering static sequential narrative
 *   - Bidirectional reverse scroll and trackpad momentum supported naturally
 *   - Interactive stage jumper to prevent forced scrolling
 *   - Preserves all real ZIP upload, sample demo.zip staging, validation, and scan execution workflows
 */

import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react';
import ArchiveSpecimen from './dashboard/ArchiveSpecimen.jsx';
import { getReportJsonUrl, getReportHtmlUrl } from '../api.js';

// Embedded minimal valid sample project (demo.zip) containing index.js, test, package.json, lockfile, README
const SAMPLE_ZIP_BASE64 =
  'UEsDBBQAAAAIAFi3Wl0lHAZPTwEAAHQCAAAIAAAAaW5kZXguanN9kd1OhDAQRu/7FN8dsCIk/lxtMPEVjInXQMtSpS22U3fJ' +
  'ZhMfwif0SWyXFbPGyA2h0++cmaFcrRhWkJqLXfHs8Pn+gY0x/LIex1CItXuQ1BM8yUHShEE2trYTqK8JYjcaJxxoa+CkGgc' +
  'BVVOPzuuWpNGuiITHXjp0MhTD2zvB0UwnJQlH0UsGb8LKLnLFTxxbY1/QGmtFS8MUaSVjSWDAkZUtJWvGynmGmvO0ztFk8e' +
  'NBkLchH2nOK5ju2KP2qhHWzZxvy08SewbYYxQ1LtCs2WHhKz+QHIfpb8loDfct/S86R5zbViebCpxBFHGzlhwq7GN/+ZLFI' +
  'Y5c4qkXGtZrcDkvB6k2XCy/MstDT1JTQLs+oMCFMkx2SK149SFTqFpqVFWFWTn304atm+AfzCZN4mKuclxnOD7VXZJjOcvW' +
  'v68v493kuM3m6+dnWRzxC1BLAwQUAAAACABgt1pdFE5dh78BAABqBAAADQAAAGluZGV4LnRlc3QuanOdUttO20AQffdXnDfb' +
  'ke2EAJVIRCUe+lpV0H6AY0+SRZtds5eCiZD6Ef3Cfkl3YjuIQlDog2Vp5sw5Z87seDSKMIJQNT0Ujqwrbi3+/PqNldZ1XjZN' +
  '6DLge2hZLLWBWxOWXlVOaGVBD402jmosjd70NLe24JEfliy+6pqYcuGFdLlQYA0YrxQZJCp0Z1xJUaoapbVkmBdSLExp2h7R' +
  '1dMd67VXuBduPQO3kOc8zo0rKXfkFqyyFsGtkITSEGqyYqWCSafx7ermhonGURR7S7DOiMrF8yiqwj4O287hEy5h6M4LQ0m8' +
  'txmn8x7WWXoF6srjnnSP3qKs6wwbL51oZPuSvRgPsfFAxDpJHPCzAHHehJA58kobQ5WD9RvoJdy9RqOtcOInQfnNgoyNMyQL' +
  'j9jG6E3WHROvtz5UiaBM5lmOE0znAelp3/U1uEEMpzskYwe5GR7DOkkwyTlb34Yc95h3hNWtCo/uk9+2i30rnYets7PAir/9' +
  'FJ+OMjbUTdG1z78+7iPdDVwJme8bYbp5JBmqdqedHgZIrzRRdtdQHSXOFru4uL5Cm/K/W/MewXOepfiyfRQ2s9YjpzXPxn8/' +
  'AVQSwMEFAAAAAgAcrdaXbNJt7WHAAAA/gAAABEAAABwYWNrYWdlLWxvY2suanNvbqvmUlBQykvMTVWyUlBKz89P0U0sKFDSAY' +
  'mWpRYVZ+bngSQM9Qz0DCCiOfnJ2WmZOalhcFljsHhRamFpZlFqMVCgpKg0FSxWkJicnZgOFqsG8oEicBYuW8EyWG0Gy+RkJq' +
  'fmFYO1+XqGIMRT89Iz85AsgliQnwJWaWdraKEEFa7lgpG1XLVcAFBLAwQUAAAACABTt1pddoXrfbQAAAAkAQAADAAAAHBhY2' +
  'thZ2UuanNvbk2NQQrCMBBF9z3FkHVb7E4EBd25UFx4gdCMZaSdhEwqQundTRqxLv9/f95MBYBiPaDageqsNZV2TpWpfaEXsp' +
  'xAU2/qTW4NSuvJhS85gtDgeoSrNVg/BeI5jIIGggWDg2UJXgcEDU6LEHdwGqk3N2/tA6TVXGfvoGkREht8R1Fu8y+JYIoxFg' +
  'ElpBnHd1BVSywzkqD9yn6eCOfFhdwR458r7dL+sG+266ynFlkWcDnfVTEXH1BLAwQUAAAACABlt1pd/Z1cHOYBAABiAwAACQ' +
  'AAAFJFQURNRS5tZGWSTW4TQRCF932KkryJkW0gEAlFAskIL1gERSEHmHZ3jaeS/qN/wN5xCC85nU9CdY/thDCazVRVv3rvm5' +
  '7Axns9lyEIsQRLjqw08M1rXDwkKJkM5R0YWkcZd1ASapAJJCRpg0EI0T+gytD7CJ8LGX0bve8XQkwmcIc/CkW06HISYn4Wff' +
  'sBeNrIjJGrLtg2/dWlLA1XyTshuq5byzQI7oKi+inE/UAJaBxjC8aAxoBOo1OECfroLeQBwXj12BObw61U2ewW4js5hdzj8y' +
  'fDA6dwnkfYhZP/Ss2gG/d2oHyNmbHusz7lcb9rqi1jcY7cpu1lhobUywAcmg9p3HL0McdqG9gBg/Qlh5Kv27CQWl9czuDdFN' +
  'rz8RNcCVtMpmB2F+9ncDWttcs3o8aL1WywMn5OrZaecYvFJY5V3czntdfN4NdAagBNSfmfGEek3atF7bLZDipErjoNEYOPmV' +
  'UwsaXE2Zc827ZCGnwxGoJMaWRye0Scciwql4hjwNM9ey0O+z+H/W9+z2Dg+EzgRpID63UxeM1/Z1xb2UybkTOR6X8qR9tN5' +
  'b45K6nyOV27NV/PPGf1Olh5OL5/TyJBqke5qZPejVZOOax01Ncz1UBSkQKzPuz3x4N3q+WXm9XC6nOGBrzCa7n/AlBLAQIU' +
  'ABQAAAAIAFi3Wl0lHAZPTwEAAHQCAAAIAAAAAAAAAAAAAAAAAAAAAABpbmRleC5qc1BLAQIUABQAAAAIAGC3Wl0UTl2HvwEA' +
  'AGoEAAANAAAAAAAAAAAAAAAAAHUBAABpbmRleC50ZXN0LmpzUEsBAhQAFAAAAAgAcrdaXbNJt7WHAAAA/gAAABEAAAAAAAAA' +
  'AAAAAAAAXwMAAHBhY2thZ2UtbG9jay5qc29uUEsBAhQAFAAAAAgAU7daXXaF6320AAAAJAEAAAwAAAAAAAAAAAAAAAAAFQQA' +
  'AHBhY2thZ2UuanNvblBLAQIUABQAAAAIAGW3Wl39nVwc5gEAAGIDAAAJAAAAAAAAAAAAAAAAAPMEAABSRUFETUUubWRQSwUG' +
  'AAAAAAUABQAhAQAAAAcAAAAA';

const UploadZone = forwardRef(function UploadZone(
  { onScanStarted, onNavigateHowItWorks, health, lastScanRecord },
  ref
) {
  const isDockerReady = health?.docker?.reachable === true;
  const isReducedMotion = useReducedMotion();

  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualExplode, setManualExplode] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [activeStageIndex, setActiveStageIndex] = useState(1);

  const fileInputRef = useRef(null);
  const dropzoneRef = useRef(null);
  const storyContainerRef = useRef(null);

  // Expose triggerUpload method to parent (e.g. Header button)
  useImperativeHandle(ref, () => ({
    triggerUpload() {
      scrollToStage(1);
      fileInputRef.current?.click();
    },
  }));

  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

  // ── Unified Continuous Scroll Timeline (Stages 1 – 5) ─────────────────────
  // 500vh container gives ~100vh per stage for comfortable pacing
  const { scrollYProgress } = useScroll({
    target: storyContainerRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.0005,
  });

  // Track active stage for the interactive stage navigator
  useEffect(() => {
    return smoothProgress.on('change', (v) => {
      if (v < 0.20) setActiveStageIndex(1);
      else if (v < 0.40) setActiveStageIndex(2);
      else if (v < 0.60) setActiveStageIndex(3);
      else if (v < 0.80) setActiveStageIndex(4);
      else setActiveStageIndex(5);
    });
  }, [smoothProgress]);

  // Stage 4 triggers the cinematic dark atmosphere of the isolated container
  const stageBg = useTransform(
    smoothProgress,
    [0.0, 0.40, 0.58, 0.78, 0.84, 1.0],
    ['#f8fafc', '#f1f5f9', '#0d1317', '#0d1317', '#f8fafc', '#f8fafc']
  );

  // Stage 1 Overlay Transitions [0.0 -> 0.22]
  const stage1Opacity = useTransform(smoothProgress, [0.0, 0.16, 0.22], [1, 1, 0]);
  const stage1Y = useTransform(smoothProgress, [0.0, 0.16, 0.22], [0, 0, -35]);
  const stage1PointerEvents = useTransform(smoothProgress, (p) => (p < 0.20 ? 'auto' : 'none'));

  // Stage 2 Overlay Transitions [0.18 -> 0.42]
  const stage2Opacity = useTransform(smoothProgress, [0.18, 0.24, 0.36, 0.42], [0, 1, 1, 0]);
  const stage2Y = useTransform(smoothProgress, [0.18, 0.24, 0.36, 0.42], [35, 0, 0, -35]);
  const stage2PointerEvents = useTransform(smoothProgress, (p) => (p >= 0.20 && p < 0.40 ? 'auto' : 'none'));

  // Stage 3 Overlay Transitions [0.38 -> 0.62]
  const stage3Opacity = useTransform(smoothProgress, [0.38, 0.44, 0.56, 0.62], [0, 1, 1, 0]);
  const stage3Y = useTransform(smoothProgress, [0.38, 0.44, 0.56, 0.62], [35, 0, 0, -35]);
  const stage3PointerEvents = useTransform(smoothProgress, (p) => (p >= 0.40 && p < 0.60 ? 'auto' : 'none'));

  // Stage 4 Overlay Transitions [0.58 -> 0.82] (Dark Docker Chamber)
  const stage4Opacity = useTransform(smoothProgress, [0.58, 0.64, 0.76, 0.82], [0, 1, 1, 0]);
  const stage4Y = useTransform(smoothProgress, [0.58, 0.64, 0.76, 0.82], [35, 0, 0, -35]);
  const stage4PointerEvents = useTransform(smoothProgress, (p) => (p >= 0.60 && p < 0.80 ? 'auto' : 'none'));

  // Stage 5 Overlay Transitions [0.78 -> 1.0] (Readiness Dossier)
  const stage5Opacity = useTransform(smoothProgress, [0.78, 0.84, 1.0], [0, 1, 1]);
  const stage5Y = useTransform(smoothProgress, [0.78, 0.84, 1.0], [35, 0, 0]);
  const stage5PointerEvents = useTransform(smoothProgress, (p) => (p >= 0.80 ? 'auto' : 'none'));

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function validateAndSelectFile(file) {
    setErrorMsg('');
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMsg('Invalid format: Please select a valid .zip project archive.');
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMsg(
        `File too large: Archive is ${formatBytes(file.size)}, exceeding the 50 MB limit.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    showToast(`Archive selected: ${file.name} (${formatBytes(file.size)})`);
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

  function handleSimulateSample() {
    try {
      const binaryString = atob(SAMPLE_ZIP_BASE64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const sampleBlob = new Blob([bytes], { type: 'application/zip' });
      const sampleFile = new File([sampleBlob], 'demo-project.zip', {
        type: 'application/zip',
        lastModified: Date.now(),
      });
      validateAndSelectFile(sampleFile);
    } catch {
      setErrorMsg('Failed to stage sample project archive.');
    }
  }

  async function handleSubmitScan() {
    if (!selectedFile || isSubmitting) return;

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await onScanStarted(selectedFile);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initiate scan. Please check server connection.');
      setIsSubmitting(false);
    }
  }

  // Smooth jump to any stage without forced scrolling
  function scrollToStage(stageNum) {
    if (!storyContainerRef.current) return;
    const containerTop = storyContainerRef.current.offsetTop;
    const containerHeight = storyContainerRef.current.offsetHeight;
    const stageTargetOffsets = [0, 0.05, 0.28, 0.50, 0.70, 0.94];
    const targetScrollY = containerTop + containerHeight * (stageTargetOffsets[stageNum] || 0);

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  }

  return (
    <div className="w-full flex flex-col">
      {/* =========================================================================
          CONTINUOUS 5-STAGE CINEMATIC SCROLL CONTAINER
          Track Height: 500vh (~100vh per stage for unhurried narrative pacing)
          Contains persistent, transforming 3D Archive Specimen and dynamic canvas
         ========================================================================= */}
      <div
        ref={storyContainerRef}
        className={`relative w-full ${isReducedMotion ? 'min-h-auto' : 'h-[500vh]'}`}
      >
        {/* Sticky Viewport Stage with Dynamic Background */}
        <motion.div
          style={{
            backgroundColor: isReducedMotion ? '#f8fafc' : stageBg,
          }}
          className={`${
            isReducedMotion ? 'relative' : 'sticky top-16 min-h-[calc(100vh-4rem)] flex items-center'
          } w-full overflow-hidden transition-colors duration-500`}
        >
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_70%_50%,rgba(25,230,140,0.06),transparent_60%)]" />

          {/* Interactive Floating Stage Navigation Pill */}
          {!isReducedMotion && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 hidden sm:flex items-center gap-1.5 p-1.5 rounded-full bg-surface-container-lowest/80 backdrop-blur-md border border-surface-container shadow-sm text-xs font-mono">
              {[
                { num: 1, label: '01 Upload' },
                { num: 2, label: '02 Strata' },
                { num: 3, label: '03 Inspect' },
                { num: 4, label: '04 Sandbox' },
                { num: 5, label: '05 Dossier' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => scrollToStage(s.num)}
                  className={`px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
                    activeStageIndex === s.num
                      ? 'bg-primary text-on-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Content Wrapper */}
          <div className="w-full max-w-6xl mx-auto px-6 lg:px-8 py-8 md:py-12 relative z-10">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
              {/* ─────────────────────────────────────────────────────────────────
                  LEFT COLUMN: Cross-fading 5-Stage Editorial Narrative
                 ───────────────────────────────────────────────────────────────── */}
              <div className="w-full lg:w-7/12 relative min-h-[480px] sm:min-h-[520px] flex items-center">
                {/* ── STAGE 1: HANDOVER PROBLEM & PROMINENT UPLOAD ────────────── */}
                <motion.div
                  style={{
                    opacity: isReducedMotion ? 1 : stage1Opacity,
                    y: isReducedMotion ? 0 : stage1Y,
                    pointerEvents: isReducedMotion ? 'auto' : stage1PointerEvents,
                  }}
                  className={`${isReducedMotion ? 'relative w-full' : 'absolute inset-0 flex flex-col justify-center'}`}
                >
                  <div className="inline-flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-secondary-container ring-4 ring-secondary-container/20"></span>
                    <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                      Stage 01 · Handover Problem
                    </span>
                  </div>

                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-primary leading-tight mb-3">
                    Can someone else run your project?
                  </h1>

                  <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed max-w-xl mb-6">
                    BuildProof inspects your repository archive, validates dependencies, and executes your test suite inside an isolated sandbox to confirm it compiles cleanly in another engineer's hands.
                  </p>

                  {/* Hidden Native File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Primary Upload Dropzone Area */}
                  <div
                    ref={dropzoneRef}
                    id="dropzone"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => {
                      if (!selectedFile) fileInputRef.current?.click();
                    }}
                    className={`p-6 sm:p-7 rounded-2xl border-2 transition-all duration-200 ${
                      isDragging
                        ? 'bg-surface-container border-secondary-container ring-4 ring-secondary-container/30'
                        : selectedFile
                        ? 'bg-surface-container-lowest border-secondary-container/60 shadow-sm'
                        : 'bg-surface-container-lowest border-dashed border-outline-variant/60 hover:border-secondary hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {!selectedFile ? (
                      // Empty Dropzone
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-[26px]">folder_zip</span>
                            </div>
                            <div>
                              <div className="text-base font-semibold text-primary">
                                Upload Project Archive
                              </div>
                              <div className="text-xs sm:text-sm text-on-surface-variant">
                                Select or drop a <span className="font-mono text-xs">.zip</span> file (up to 50 MB)
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors text-sm font-medium inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">file_upload</span>
                            <span>Browse Files</span>
                          </button>
                        </div>

                        <div className="pt-3 border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary-container"></span>
                            Airgapped Docker container · Zero host contamination
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSimulateSample();
                            }}
                            className="text-primary hover:text-secondary underline decoration-secondary underline-offset-4 flex items-center gap-1 transition-colors cursor-pointer font-medium"
                          >
                            <span className="material-symbols-outlined text-[14px]">play_circle</span>
                            <span>Try sample project (demo.zip)</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Staged File State
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-primary truncate">
                                  {selectedFile.name}
                                </span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed shrink-0">
                                  Staged
                                </span>
                              </div>
                              <div className="text-xs text-on-surface-variant mt-0.5">
                                {formatBytes(selectedFile.size)} · Ready for isolated scan
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setErrorMsg('');
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                            <span>Change</span>
                          </button>
                        </div>

                        <div className="pt-3 border-t border-surface-container flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-secondary-container"></span>
                            Disposable container auto-removes on completion
                          </span>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmitScan();
                            }}
                            className="px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors text-sm font-medium inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <>
                                <span className="material-symbols-outlined text-[16px] animate-spin">
                                  progress_activity
                                </span>
                                <span>Spawning Container...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">security</span>
                                <span>Start Handover Check</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {errorMsg && (
                    <div className="mt-3 p-3.5 rounded-xl bg-error-container/40 border border-error/30 text-error flex items-start gap-2 text-sm">
                      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="material-symbols-outlined text-[16px] text-secondary">arrow_downward</span>
                    <span>Scroll down to open and inspect the 5 repository strata</span>
                  </div>
                </motion.div>

                {/* ── STAGE 2: ARCHIVE DECONSTRUCTION ──────────────────────────── */}
                {!isReducedMotion && (
                  <motion.div
                    style={{
                      opacity: stage2Opacity,
                      y: stage2Y,
                      pointerEvents: stage2PointerEvents,
                    }}
                    className="absolute inset-0 flex flex-col justify-center"
                  >
                    <div className="inline-flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-secondary-container ring-4 ring-secondary-container/20"></span>
                      <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                        Stage 02 · Archive Deconstruction
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-primary mb-3">
                      Every layer must hold up on another machine
                    </h2>

                    <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-6">
                      A project handover fails when dependencies drift, instructions go stale, or tests rely on local environment state. BuildProof unpacks and inspects the 5 core layers before running any code.
                    </p>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-primary">01 package.json</span>
                          <span className="text-on-surface-variant">Runtime constraints &amp; npm triggers</span>
                        </div>
                        <span className="font-mono text-[11px] text-secondary font-medium">Verified</span>
                      </div>

                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-primary">02 README.md</span>
                          <span className="text-on-surface-variant">Documented onboarding instructions</span>
                        </div>
                        <span className="font-mono text-[11px] text-secondary font-medium">Verified</span>
                      </div>

                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-primary">03 package-lock.json</span>
                          <span className="text-on-surface-variant">Deterministic immutable resolution</span>
                        </div>
                        <span className="font-mono text-[11px] text-secondary font-medium">Verified</span>
                      </div>

                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-primary">04 tests/</span>
                          <span className="text-on-surface-variant">Isolated automated test harness</span>
                        </div>
                        <span className="font-mono text-[11px] text-secondary font-medium">Verified</span>
                      </div>

                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-semibold text-primary">05 src/</span>
                          <span className="text-on-surface-variant">Clean source module boundaries</span>
                        </div>
                        <span className="font-mono text-[11px] text-secondary font-medium">Verified</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── STAGE 3: STATIC & DEPENDENCY INSPECTION ──────────────────── */}
                {!isReducedMotion && (
                  <motion.div
                    style={{
                      opacity: stage3Opacity,
                      y: stage3Y,
                      pointerEvents: stage3PointerEvents,
                    }}
                    className="absolute inset-0 flex flex-col justify-center"
                  >
                    <div className="inline-flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-secondary-container ring-4 ring-secondary-container/20"></span>
                      <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                        Stage 03 · Static &amp; Dependency Inspection
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-primary mb-3">
                      Prevent dependency drift and hidden traps
                    </h2>

                    <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-6">
                      Unpinned dependencies, mismatched lockfiles, and undocumented scripts are the leading cause of failed developer onboarding. BuildProof audits dependency integrity before spawning a container.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-2">
                            <span className="material-symbols-outlined text-[18px]">code</span>
                          </div>
                          <div className="text-xs font-semibold text-primary mb-1">Manifest Syntax</div>
                          <p className="text-[11px] text-on-surface-variant leading-normal">
                            Validates JSON syntax and confirms runnable <code className="font-mono">test</code> and <code className="font-mono">build</code> scripts.
                          </p>
                        </div>
                        <div className="pt-2 mt-2 border-t border-surface-container text-[10px] text-secondary font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check</span>
                          <span>Zero syntax errors</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-2">
                            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                          </div>
                          <div className="text-xs font-semibold text-primary mb-1">Lockfile Sync</div>
                          <p className="text-[11px] text-on-surface-variant leading-normal">
                            Ensures deterministic lock tree synchronization without wildcard range surprises.
                          </p>
                        </div>
                        <div className="pt-2 mt-2 border-t border-surface-container text-[10px] text-secondary font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check</span>
                          <span>Pinned versions</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary mb-2">
                            <span className="material-symbols-outlined text-[18px]">menu_book</span>
                          </div>
                          <div className="text-xs font-semibold text-primary mb-1">README Guide</div>
                          <p className="text-[11px] text-on-surface-variant leading-normal">
                            Inspects documented onboarding instructions to verify commands match manifest triggers.
                          </p>
                        </div>
                        <div className="pt-2 mt-2 border-t border-surface-container text-[10px] text-secondary font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">check</span>
                          <span>Verified steps</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── STAGE 4: ISOLATED DOCKER SANDBOX (Dark Visual Atmosphere) ─ */}
                {!isReducedMotion && (
                  <motion.div
                    style={{
                      opacity: stage4Opacity,
                      y: stage4Y,
                      pointerEvents: stage4PointerEvents,
                    }}
                    className="absolute inset-0 flex flex-col justify-center text-white"
                  >
                    <div className="inline-flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-secondary-container ring-4 ring-secondary-container/20"></span>
                      <span className="text-xs font-medium text-secondary-container uppercase tracking-wider">
                        Stage 04 · Sandboxed Testing
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-white mb-3">
                      Run in a clean, restricted sandbox
                    </h2>

                    <p className="text-sm sm:text-base text-surface-variant leading-relaxed mb-6">
                      "Works on my machine" is an engineering liability. BuildProof executes your project in a secure, ephemeral Docker container configured with hard resource caps and zero network access.
                    </p>

                    {/* Verified Docker Security Controls Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-secondary-container">--network none</span>
                          <span className="text-[10px] text-surface-variant">Airgap</span>
                        </div>
                        <p className="text-[11px] text-surface-variant leading-normal">
                          Test execution cuts all network sockets. Any undeclared remote calls fail immediately.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-secondary-container">--memory 512m --cpus 1</span>
                          <span className="text-[10px] text-surface-variant">Resource Cap</span>
                        </div>
                        <p className="text-[11px] text-surface-variant leading-normal">
                          Strict 1 vCPU and 512 MB memory ceilings prevent resource hogs and runaway tests.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-secondary-container">--user node --cap-drop ALL</span>
                          <span className="text-[10px] text-surface-variant">Unprivileged</span>
                        </div>
                        <p className="text-[11px] text-surface-variant leading-normal">
                          Runs as unprivileged user <code className="font-mono">node</code> with dropped kernel capabilities and <code className="font-mono">no-new-privileges</code>.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold text-secondary-container">--rm --pids-limit 256</span>
                          <span className="text-[10px] text-surface-variant">Ephemeral</span>
                        </div>
                        <p className="text-[11px] text-surface-variant leading-normal">
                          Limits active processes to 256 to stop fork bombs. Container destroys automatically on exit.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-surface-variant pt-2 border-t border-white/10">
                      <span>Docker Daemon: {isDockerReady ? 'Online & Isolated' : 'Offline'}</span>
                      <span className="font-mono text-[11px] text-secondary-container">Base: node:20-alpine</span>
                    </div>
                  </motion.div>
                )}

                {/* ── STAGE 5: READINESS REPORT DOSSIER ────────────────────────── */}
                {!isReducedMotion && (
                  <motion.div
                    style={{
                      opacity: stage5Opacity,
                      y: stage5Y,
                      pointerEvents: stage5PointerEvents,
                    }}
                    className="absolute inset-0 flex flex-col justify-center"
                  >
                    <div className="inline-flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-secondary-container ring-4 ring-secondary-container/20"></span>
                      <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                        Stage 05 · Readiness Report Dossier
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-primary mb-3">
                      Get a clear, actionable readiness verdict
                    </h2>

                    <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-5">
                      When the scan finishes, you receive a transparent audit dossier. Every check is categorized with exact console outputs and developer remediation steps.
                    </p>

                    {/* Verdict Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm mb-4">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-secondary-container/40 text-on-secondary-fixed flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">verified</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-primary">
                                {lastScanRecord?.status === 'passed'
                                  ? 'Project Passed Handover Verification'
                                  : lastScanRecord
                                  ? 'Project Needs Remediation'
                                  : 'Ready for Handover'}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-medium">
                                {lastScanRecord ? 'Live Result' : 'Sample Preview'}
                              </span>
                            </div>
                            <div className="text-[11px] text-on-surface-variant">
                              {lastScanRecord
                                ? `Scanned in ${lastScanRecord.durationSeconds || 0}s`
                                : 'Illustrative preview based on sample check'}
                            </div>
                          </div>
                        </div>

                        {lastScanRecord && (
                          <div className="flex items-center gap-2 text-xs">
                            <a
                              href={getReportHtmlUrl(lastScanRecord.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-md bg-surface-container hover:bg-secondary-container text-primary text-[11px] font-mono transition-colors"
                            >
                              HTML
                            </a>
                            <a
                              href={getReportJsonUrl(lastScanRecord.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-md bg-surface-container hover:bg-secondary-container text-primary text-[11px] font-mono transition-colors"
                            >
                              JSON
                            </a>
                          </div>
                        )}
                      </div>

                      {/* 4 Core Dimensions */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-surface border border-surface-container">
                          <div className="font-mono text-[11px] text-on-surface-variant">package.json</div>
                          <div className="text-secondary font-medium text-[11px] mt-0.5">Manifest Valid</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface border border-surface-container">
                          <div className="font-mono text-[11px] text-on-surface-variant">lockfile</div>
                          <div className="text-secondary font-medium text-[11px] mt-0.5">Synchronized</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface border border-surface-container">
                          <div className="font-mono text-[11px] text-on-surface-variant">README.md</div>
                          <div className="text-secondary font-medium text-[11px] mt-0.5">Setup Synced</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface border border-surface-container">
                          <div className="font-mono text-[11px] text-on-surface-variant">tests/</div>
                          <div className="text-secondary font-medium text-[11px] mt-0.5">Passed in Docker</div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          scrollToStage(1);
                          fileInputRef.current?.click();
                        }}
                        className="px-4 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                        <span>Upload Your Project Now</span>
                      </button>

                      {onNavigateHowItWorks && (
                        <button
                          type="button"
                          onClick={onNavigateHowItWorks}
                          className="px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-variant text-primary text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                        >
                          How It Works
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────────
                  RIGHT COLUMN: Persistent 3D Archive Specimen
                  Remains mounted across all 5 stages and transforms continuously
                 ───────────────────────────────────────────────────────────────── */}
              <div className="w-full lg:w-5/12 flex flex-col items-center">
                <div className="w-full bg-surface-container-low p-5 rounded-2xl border border-outline-variant/70 shadow-sm">
                  <div className="flex items-center justify-between mb-2 text-xs text-on-surface-variant">
                    <span className="font-semibold text-primary">Repository Archive Specimen</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-primary font-semibold">
                      Stage 0{activeStageIndex}
                    </span>
                  </div>

                  <ArchiveSpecimen
                    scrollProgress={smoothProgress}
                    isReducedMotion={isReducedMotion}
                    manualExplode={manualExplode}
                    onToggleManual={() => setManualExplode(!manualExplode)}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* =========================================================================
          REDUCED MOTION ACCESSIBLE FALLBACK
          Renders Stages 2 through 5 as accessible, non-pinned sequential sections
         ========================================================================= */}
      {isReducedMotion && (
        <div className="w-full space-y-12 py-12 border-t border-surface-container">
          {/* Stage 2 Static */}
          <section className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="max-w-2xl mb-6">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Stage 02 · Archive Deconstruction
              </span>
              <h2 className="text-2xl font-semibold text-primary mt-1">
                Every layer must hold up on another machine
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs font-semibold text-primary">01 / package.json</span>
                <p className="text-xs text-on-surface-variant mt-1">Runtime constraints and triggers.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs font-semibold text-primary">02 / README.md</span>
                <p className="text-xs text-on-surface-variant mt-1">Setup instructions validated against manifest.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs font-semibold text-primary">03 / package-lock.json</span>
                <p className="text-xs text-on-surface-variant mt-1">Deterministic resolution tree.</p>
              </div>
            </div>
          </section>

          {/* Stage 3 Static */}
          <section className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="max-w-2xl mb-6">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Stage 03 · Static &amp; Dependency Inspection
              </span>
              <h2 className="text-2xl font-semibold text-primary mt-1">
                Prevent dependency drift and hidden traps
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="text-xs font-semibold text-primary">Manifest Integrity</span>
                <p className="text-xs text-on-surface-variant mt-1">Validates scripts and engine constraints.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="text-xs font-semibold text-primary">Lockfile Determinism</span>
                <p className="text-xs text-on-surface-variant mt-1">Ensures synchronization without wildcards.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="text-xs font-semibold text-primary">Documentation Alignment</span>
                <p className="text-xs text-on-surface-variant mt-1">Confirms documented commands match manifest.</p>
              </div>
            </div>
          </section>

          {/* Stage 4 Static */}
          <section className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="max-w-2xl mb-6">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Stage 04 · Sandboxed Testing
              </span>
              <h2 className="text-2xl font-semibold text-primary mt-1">
                Run in a clean, restricted sandbox
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs text-primary font-semibold">--network none</span>
                <p className="text-xs text-on-surface-variant mt-1">Network airgapped during test phase.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs text-primary font-semibold">--memory 512m --cpus 1</span>
                <p className="text-xs text-on-surface-variant mt-1">Strict resource limits prevent leaks.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs text-primary font-semibold">--user node</span>
                <p className="text-xs text-on-surface-variant mt-1">Dropped Linux capabilities.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container">
                <span className="font-mono text-xs text-primary font-semibold">--rm --pids-limit 256</span>
                <p className="text-xs text-on-surface-variant mt-1">Container destroyed on exit.</p>
              </div>
            </div>
          </section>

          {/* Stage 5 Static */}
          <section className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="max-w-2xl mb-6">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Stage 05 · Readiness Report Dossier
              </span>
              <h2 className="text-2xl font-semibold text-primary mt-1">
                Get a clear, actionable readiness verdict
              </h2>
            </div>
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-surface-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-base font-semibold text-primary">Ready for Handover</span>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Drop your project archive above to initiate your audit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scrollToStage(1)}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium cursor-pointer"
              >
                Upload Project Archive
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Dynamic Toast Notification */}
      <div
        className={`fixed bottom-6 right-6 bg-primary text-on-primary text-sm font-medium px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 transition-all duration-300 z-50 ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <span className="material-symbols-outlined text-secondary-container text-[18px]">info</span>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
});

export default UploadZone;
