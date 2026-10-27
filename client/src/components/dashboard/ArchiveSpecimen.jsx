/**
 * components/dashboard/ArchiveSpecimen.jsx
 *
 * What this file does:
 *   Continuous CSS 3D repository archive composition driven by Motion for React.
 *   Serves as the continuous visual anchor evolving across all 5 stages:
 *     - Stage 1: Compact, unopened isometric repository package
 *     - Stage 2: Exploded strata revealing package.json, README, lockfile, tests, src
 *     - Stage 3: Structured inspection plane with manifest syntax & lockfile integrity badges
 *     - Stage 4: Suspended inside an isolated Docker sandbox container rig (verified flags)
 *     - Stage 5: Compact, certified handover dossier with verification seal
 *
 * Visual Clarity & Contrast:
 *   - Solid opaque white document surfaces with crisp borders and restrained shadows
 *   - High-contrast typography and verified green accents (text-secondary #416900)
 *   - Zero backdrop-blur on the 3D canvas to eliminate all blurriness and washed-out artifacts
 *   - High-contrast pill banners for Stage 4 Docker telemetry
 *   - Full support for prefers-reduced-motion and manual exploration toggle
 */

import React from 'react';
import { motion, useTransform } from 'motion/react';

export default function ArchiveSpecimen({
  scrollProgress,
  isReducedMotion = false,
  manualExplode = false,
  onToggleManual,
}) {
  // Continuous 3D rotation and scale values across all 5 stages (scrollProgress 0.0 -> 1.0)
  // Stage 1: Isometric package [56deg, -32deg]
  // Stage 2: Exploded architectural view [42deg, -18deg]
  // Stage 3: Upright inspection plane [14deg, -2deg]
  // Stage 4: Docker container chamber [36deg, -20deg]
  // Stage 5: Solid certified dossier [8deg, 0deg]
  const rotateX = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [56, 42, 14, 12, 36, 14, 8]
  );

  const rotateZ = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [-32, -18, -4, 0, -20, -4, 0]
  );

  const scale = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [1, 1, 1, 1, 1, 1, 1] : [1.0, 1.06, 1.0, 1.0, 1.0, 1.0, 1.02]
  );

  // Layer translations along Z-axis (separation distance)
  // Layer 1: package.json (Top)
  const layer1Z = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [75, 160, 105, 95, 60, 28, 20]
  );
  const layer1Y = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [0, -30, -42, -45, -16, -6, -4]
  );

  // Layer 2: README.md
  const layer2Z = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [35, 80, 52, 48, 30, 14, 10]
  );
  const layer2Y = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [0, -15, -20, -22, -8, -3, -2]
  );

  // Layer 3: package-lock.json (Center Anchor)
  const layer3Z = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    [0, 0, 0, 0, 0, 0, 0]
  );

  // Layer 4: tests/
  const layer4Z = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [-35, -80, -52, -48, -30, -14, -10]
  );
  const layer4Y = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [0, 15, 20, 22, 8, 3, 2]
  );

  // Layer 5: src/ (Foundation)
  const layer5Z = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [-70, -160, -105, -95, -60, -28, -20]
  );
  const layer5Y = useTransform(
    scrollProgress,
    [0.0, 0.18, 0.36, 0.54, 0.72, 0.88, 1.0],
    isReducedMotion ? [0, 0, 0, 0, 0, 0, 0] : [0, 30, 42, 45, 16, 6, 4]
  );

  // Stage-specific contextual badge opacities
  // Stage 3 Inspection verification badges: active around ~0.40 to 0.60
  const stage3BadgeOpacity = useTransform(scrollProgress, [0.38, 0.44, 0.56, 0.62], [0, 1, 1, 0]);

  // Stage 4 Sandboxed Testing badges: active around ~0.60 to 0.82
  const stage4BadgeOpacity = useTransform(scrollProgress, [0.60, 0.66, 0.76, 0.82], [0, 1, 1, 0]);

  // Stage 4 Docker Container Cage wireframe: active around ~0.60 to 0.82
  const stage4CageOpacity = useTransform(scrollProgress, [0.58, 0.66, 0.76, 0.82], [0, 1, 1, 0]);

  // Stage 5 Certified Dossier Seal: active around ~0.80 to 1.0
  const stage5SealOpacity = useTransform(scrollProgress, [0.80, 0.88, 1.0], [0, 1, 1]);

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* 3D Viewport Box */}
      <div
        className="relative h-[340px] sm:h-[390px] w-full flex items-center justify-center overflow-visible"
        style={{ perspective: isReducedMotion ? 'none' : '1200px' }}
      >
        {/* Stage 4: Docker Sandbox Enclosure Wireframe (Clean, unblurred frame) */}
        {!isReducedMotion && (
          <motion.div
            style={{ opacity: stage4CageOpacity }}
            className="absolute inset-x-0 inset-y-0 rounded-2xl border-2 border-dashed border-secondary/60 pointer-events-none flex flex-col justify-between p-2.5 z-30 transition-opacity duration-300"
          >
            {/* Top Telemetry Chip */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#13191c] text-white shadow-sm">
                <span className="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
                <span className="font-mono text-[11px] font-semibold text-white">DOCKER ISOLATION RIG</span>
                <span className="font-mono text-[10px] text-secondary-container px-1 py-0.2 rounded bg-white/10 font-medium">
                  node:20-alpine
                </span>
              </div>
              <span className="px-2 py-1 rounded-md bg-[#13191c] text-secondary-container font-mono text-[10px] font-semibold shadow-sm">
                MOUNT: /app
              </span>
            </div>

            {/* Bottom Security Controls Chip */}
            <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-[#13191c] text-white shadow-sm text-[10px] font-mono">
              <span className="text-secondary-container font-medium">--network none · --user node</span>
              <span className="text-surface-variant font-medium">--memory 512m · --cpus 1</span>
            </div>
          </motion.div>
        )}

        {/* The Continuous Specimen Rig */}
        <motion.div
          id="specimenRig"
          className="relative w-64 h-72 will-change-transform"
          style={{
            transformStyle: isReducedMotion ? 'flat' : 'preserve-3d',
            rotateX: manualExplode && !isReducedMotion ? 42 : rotateX,
            rotateZ: manualExplode && !isReducedMotion ? -18 : rotateZ,
            scale: manualExplode && !isReducedMotion ? 1.08 : scale,
          }}
        >
          {/* Layer 1: package.json (Top) */}
          <motion.div
            className="absolute inset-0 bg-white rounded-xl shadow-md shadow-slate-900/10 p-4 flex flex-col justify-between border border-slate-300 transition-shadow duration-300 hover:shadow-lg"
            style={{
              transform: isReducedMotion
                ? 'none'
                : manualExplode
                ? 'translate3d(0, -30px, 160px)'
                : undefined,
              z: isReducedMotion || manualExplode ? undefined : layer1Z,
              y: isReducedMotion || manualExplode ? undefined : layer1Y,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-semibold text-primary">package.json</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-fixed font-bold tracking-wide">
                MANIFEST
              </span>
            </div>

            {/* Middle Content: Dynamically reflects stage inspection data */}
            <div className="relative overflow-hidden min-h-[36px] flex items-center">
              {/* Default descriptor */}
              <div className="font-mono text-[11px] text-slate-600 leading-relaxed">
                scripts, dependencies &amp; engines
              </div>

              {/* Stage 3 Inspection Indicator */}
              <motion.div
                style={{ opacity: stage3BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span>Valid JSON · scripts.test defined</span>
              </motion.div>

              {/* Stage 4 Sandboxed Indicator */}
              <motion.div
                style={{ opacity: stage4BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">shield</span>
                <span>Sandboxed Mount · /app</span>
              </motion.div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Entrypoint Manifest
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-semibold">Layer 01</span>
            </div>
          </motion.div>

          {/* Layer 2: README.md */}
          <motion.div
            className="absolute inset-0 bg-white rounded-xl shadow-md shadow-slate-900/10 p-4 flex flex-col justify-between border border-slate-300 transition-shadow duration-300 hover:shadow-lg"
            style={{
              transform: isReducedMotion
                ? 'none'
                : manualExplode
                ? 'translate3d(0, -15px, 80px)'
                : undefined,
              z: isReducedMotion || manualExplode ? undefined : layer2Z,
              y: isReducedMotion || manualExplode ? undefined : layer2Y,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-semibold text-primary">README.md</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                DOCS
              </span>
            </div>

            <div className="relative overflow-hidden min-h-[36px] flex items-center">
              <div className="text-xs text-slate-600 leading-relaxed">
                Documented setup instructions
              </div>

              {/* Stage 3 Inspection Indicator */}
              <motion.div
                style={{ opacity: stage3BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span>Setup commands match manifest</span>
              </motion.div>

              {/* Stage 4 Sandboxed Indicator */}
              <motion.div
                style={{ opacity: stage4BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">terminal</span>
                <span>Docs verified in container</span>
              </motion.div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Setup Verification
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-semibold">Layer 02</span>
            </div>
          </motion.div>

          {/* Layer 3: package-lock.json (Anchor) */}
          <motion.div
            className="absolute inset-0 bg-white rounded-xl shadow-md shadow-slate-900/10 p-4 flex flex-col justify-between border border-slate-300 transition-shadow duration-300 hover:shadow-lg"
            style={{
              transform: isReducedMotion
                ? 'none'
                : manualExplode
                ? 'translate3d(0, 0, 0px)'
                : undefined,
              z: isReducedMotion || manualExplode ? undefined : layer3Z,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-semibold text-primary">package-lock.json</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                LOCKFILE
              </span>
            </div>

            <div className="relative overflow-hidden min-h-[36px] flex items-center">
              <div className="font-mono text-[11px] text-slate-600 leading-relaxed">
                Deterministic pinned dependencies
              </div>

              {/* Stage 3 Inspection Indicator */}
              <motion.div
                style={{ opacity: stage3BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span>Deterministic tree · No drift</span>
              </motion.div>

              {/* Stage 4 Sandboxed Indicator */}
              <motion.div
                style={{ opacity: stage4BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">lock</span>
                <span>npm ci --prefer-offline</span>
              </motion.div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Immutable Lock Tree
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-semibold">Layer 03</span>
            </div>
          </motion.div>

          {/* Layer 4: tests/ */}
          <motion.div
            className="absolute inset-0 bg-white rounded-xl shadow-md shadow-slate-900/10 p-4 flex flex-col justify-between border border-slate-300 transition-shadow duration-300 hover:shadow-lg"
            style={{
              transform: isReducedMotion
                ? 'none'
                : manualExplode
                ? 'translate3d(0, 15px, -80px)'
                : undefined,
              z: isReducedMotion || manualExplode ? undefined : layer4Z,
              y: isReducedMotion || manualExplode ? undefined : layer4Y,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-semibold text-primary">tests/</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                TESTS
              </span>
            </div>

            <div className="relative overflow-hidden min-h-[36px] flex items-center">
              <div className="text-xs text-slate-600 leading-relaxed">
                Automated regression test suites
              </div>

              {/* Stage 3 Inspection Indicator */}
              <motion.div
                style={{ opacity: stage3BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span>Test runner discovered (exit 0)</span>
              </motion.div>

              {/* Stage 4 Sandboxed Indicator */}
              <motion.div
                style={{ opacity: stage4BadgeOpacity }}
                className="absolute inset-0 bg-white flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">play_arrow</span>
                <span>npm test under airgap</span>
              </motion.div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Docker Sandbox Runner
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-semibold">Layer 04</span>
            </div>
          </motion.div>

          {/* Layer 5: src/ */}
          <motion.div
            className="absolute inset-0 bg-slate-100 rounded-xl p-4 flex flex-col justify-between border border-slate-300 transition-shadow duration-300"
            style={{
              transform: isReducedMotion
                ? 'none'
                : manualExplode
                ? 'translate3d(0, 30px, -160px)'
                : undefined,
              z: isReducedMotion || manualExplode ? undefined : layer5Z,
              y: isReducedMotion || manualExplode ? undefined : layer5Y,
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs font-semibold text-primary">src/</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 font-semibold border border-slate-200">
                SOURCE
              </span>
            </div>

            <div className="relative overflow-hidden min-h-[36px] flex items-center">
              <div className="text-xs text-slate-600 leading-relaxed">
                Application source code files
              </div>

              {/* Stage 3 Inspection Indicator */}
              <motion.div
                style={{ opacity: stage3BadgeOpacity }}
                className="absolute inset-0 bg-slate-100 flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span>Safe boundaries · Zero slip paths</span>
              </motion.div>

              {/* Stage 4 Sandboxed Indicator */}
              <motion.div
                style={{ opacity: stage4BadgeOpacity }}
                className="absolute inset-0 bg-slate-100 flex items-center gap-1.5 text-[11px] font-mono text-secondary font-semibold"
              >
                <span className="material-symbols-outlined text-[15px] text-secondary">folder</span>
                <span>Read-only workspace mount</span>
              </motion.div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                Clean Module Boundaries
              </span>
              <span className="font-mono text-[10px] text-slate-400 font-semibold">Layer 05</span>
            </div>
          </motion.div>

          {/* Stage 5: Handover Readiness Certified Seal Overlay */}
          {!isReducedMotion && (
            <motion.div
              style={{ opacity: stage5SealOpacity }}
              className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-40 bg-secondary-container text-on-secondary-fixed p-3 rounded-xl shadow-xl border border-secondary flex items-center justify-between pointer-events-none"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-on-secondary-fixed">verified</span>
                <span className="text-xs font-bold uppercase tracking-wider text-on-secondary-fixed">
                  Handover Ready
                </span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/10 text-on-secondary-fixed font-bold">
                AUDITED
              </span>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Manual Explode / Stack Action & Accessibility Status */}
      <div className="mt-3 pt-3 w-full flex items-center justify-between border-t border-slate-200 text-xs">
        <span className="text-slate-600 font-medium">
          Scroll to explore or toggle manually
        </span>
        <button
          type="button"
          onClick={onToggleManual}
          className="px-3 py-1 bg-surface-container hover:bg-secondary-container hover:text-on-secondary-fixed text-primary rounded-md transition-colors font-medium cursor-pointer"
        >
          {manualExplode ? 'Stack Layers' : 'Separate Layers'}
        </button>
      </div>
    </div>
  );
}
