/**
 * components/ScanHistoryView.jsx
 *
 * What this file does:
 *   Production-grade, premium Scan History Dashboard for BuildProof.
 *   - Fetches real historical scan records from GET /api/scans
 *   - Displays 4 calculated summary metric cards (Total Scans, Ready, Not Ready, In Progress)
 *   - Client-side real-time search (by filename, project name, scan ID)
 *   - Segmented status filters (All Scans, Ready, Not Ready, Running, Failed)
 *   - Working sort controls (Newest first, Oldest first, Project name A-Z)
 *   - Responsive, elegant table with accessible mobile card fallback
 *   - Working actions for View Report, Download HTML, and Download JSON
 *   - Comprehensive loading skeleton, first-time empty state, search empty state, and error state with Retry
 *   - Motion for React animations with reduced-motion support
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { listScans, getReportHtmlUrl, getReportJsonUrl } from '../api.js';

export default function ScanHistoryView({
  onNavigateDashboard,
  onViewReport,
}) {
  const isReducedMotion = useReducedMotion();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Load scans from backend API
  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listScans();
      setScans(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load historical scan records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const data = await listScans();
        if (!cancelled) {
          setScans(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load historical scan records.');
          setLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  // Periodic poll if any scan is currently in progress
  useEffect(() => {
    const hasRunning = scans.some((s) =>
      ['queued', 'extracting', 'scanning', 'installing', 'testing', 'reporting'].includes(s.status)
    );
    if (!hasRunning) return;

    const interval = setInterval(async () => {
      try {
        const data = await listScans();
        setScans(Array.isArray(data) ? data : []);
      } catch {
        // Silently ignore background polling errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [scans]);

  // ── Metrics Calculation (From Real Scan Records) ─────────────────────────
  const metrics = useMemo(() => {
    const total = scans.length;
    let ready = 0;
    let notReady = 0;
    let inProgress = 0;
    let failed = 0;

    for (const s of scans) {
      if (['queued', 'extracting', 'scanning', 'installing', 'testing', 'reporting'].includes(s.status)) {
        inProgress++;
      } else if (s.status === 'error') {
        failed++;
      } else if (s.verdict === 'ready') {
        ready++;
      } else if (s.verdict === 'not_ready' || s.verdict === 'partially_verified') {
        notReady++;
      }
    }

    return { total, ready, notReady, inProgress, failed };
  }, [scans]);

  // ── Filtering & Sorting ───────────────────────────────────────────────────
  const filteredScans = useMemo(() => {
    let result = [...scans];

    // Status filter
    if (statusFilter === 'ready') {
      result = result.filter((s) => s.verdict === 'ready');
    } else if (statusFilter === 'not_ready') {
      result = result.filter((s) => s.verdict === 'not_ready' || s.verdict === 'partially_verified');
    } else if (statusFilter === 'running') {
      result = result.filter((s) =>
        ['queued', 'extracting', 'scanning', 'installing', 'testing', 'reporting'].includes(s.status)
      );
    } else if (statusFilter === 'failed') {
      result = result.filter((s) => s.status === 'error');
    }

    // Search query matching
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((s) => {
        const nameMatch = s.projectName?.toLowerCase().includes(query);
        const fileMatch = s.originalFilename?.toLowerCase().includes(query);
        const idMatch = (s.id || s.scanId)?.toLowerCase().includes(query);
        return nameMatch || fileMatch || idMatch;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === 'name') {
        const nameA = (a.projectName || a.originalFilename || '').toLowerCase();
        const nameB = (b.projectName || b.originalFilename || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return result;
  }, [scans, statusFilter, searchQuery, sortBy]);

  // Format timestamp in local timezone
  function formatDate(isoString) {
    if (!isoString) return 'Date unavailable';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Date unavailable';
      return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    } catch {
      return 'Date unavailable';
    }
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: isReducedMotion ? 0 : 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: isReducedMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8 md:py-12">
      {/* ── PART 3: PAGE HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-secondary-container ring-4 ring-secondary-container/20"></span>
            <span className="text-xs font-mono font-medium text-on-surface-variant uppercase tracking-wider">
              Project Handover Verification
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-primary">
            Scan History
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-1.5 max-w-2xl leading-relaxed">
            Every verification run, one place. Review project readiness, inspect reports, and revisit previous checks.
          </p>
        </div>

        {/* Action Button: New Scan */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={fetchScans}
            title="Refresh scan records"
            disabled={loading}
            className="p-2.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>

          <button
            type="button"
            onClick={onNavigateDashboard}
            className="px-4 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors text-sm font-medium inline-flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            <span>New Scan</span>
          </button>
        </div>
      </div>

      {/* ── PART 4: SUMMARY METRICS (4 CARDS) ──────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {/* 1. Total Scans */}
        <motion.div
          variants={itemVariants}
          className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Scans</span>
            <span className="material-symbols-outlined text-[20px] text-primary">inventory_2</span>
          </div>
          <div className="text-3xl font-semibold text-primary">
            {loading ? '—' : metrics.total}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            Archived verifications
          </div>
        </motion.div>

        {/* 2. Ready */}
        <motion.div
          variants={itemVariants}
          className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ready</span>
            <span className="w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-secondary/20"></span>
          </div>
          <div className="text-3xl font-semibold text-secondary">
            {loading ? '—' : metrics.ready}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {metrics.total > 0
              ? `${Math.round((metrics.ready / metrics.total) * 100)}% pass rate`
              : 'Pass criteria met'}
          </div>
        </motion.div>

        {/* 3. Not Ready */}
        <motion.div
          variants={itemVariants}
          className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Not Ready</span>
            <span className="material-symbols-outlined text-[20px] text-error">cancel</span>
          </div>
          <div className="text-3xl font-semibold text-error">
            {loading ? '—' : metrics.notReady}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {metrics.total > 0
              ? `${Math.round((metrics.notReady / metrics.total) * 100)}% remediation required`
              : 'Issues detected'}
          </div>
        </motion.div>

        {/* 4. In Progress */}
        <motion.div
          variants={itemVariants}
          className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
            <span className="material-symbols-outlined text-[20px] text-sky-600">
              {metrics.inProgress > 0 ? 'hourglass_top' : 'done_all'}
            </span>
          </div>
          <div className="text-3xl font-semibold text-primary">
            {loading ? '—' : metrics.inProgress}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">
            {metrics.inProgress > 0 ? 'Executing sandbox tests' : 'No active scans'}
          </div>
        </motion.div>
      </motion.div>

      {/* ── PART 5: SEARCH, FILTERS, AND SORTING ───────────────────────────── */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Segmented Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Scans', count: metrics.total },
              { id: 'ready', label: 'Ready', count: metrics.ready },
              { id: 'not_ready', label: 'Not Ready', count: metrics.notReady },
              { id: 'running', label: 'Running', count: metrics.inProgress },
              ...(metrics.failed > 0
                ? [{ id: 'failed', label: 'Failed', count: metrics.failed }]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    statusFilter === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input & Sort Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:max-w-md justify-end">
            {/* Search */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by filename or ID..."
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-surface-container text-primary text-xs placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary-container transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

            {/* Sort Control */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-surface-container text-primary text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-container transition-all"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Project name A–Z</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[16px]">
                expand_more
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── PART 8: LOADING SKELETON ────────────────────────────────────────── */}
      {loading && scans.length === 0 && (
        <div className="p-8 rounded-2xl bg-surface-container-lowest border border-surface-container space-y-4">
          <div className="h-5 w-48 bg-surface-container rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 w-full bg-surface-container-low rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* ── PART 8: ERROR STATE WITH RETRY ──────────────────────────────────── */}
      {error && (
        <div className="p-6 rounded-2xl bg-error-container/30 border border-error/30 text-error flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] shrink-0">error</span>
            <div>
              <div className="text-sm font-semibold">Failed to load scan history</div>
              <div className="text-xs text-error/80 mt-0.5">{error}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchScans}
            className="px-4 py-2 rounded-lg bg-error text-on-error text-xs font-medium hover:bg-error/90 transition-colors cursor-pointer shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── PART 8: FIRST-TIME EMPTY STATE ──────────────────────────────────── */}
      {!loading && !error && scans.length === 0 && (
        <div className="p-12 md:p-16 rounded-2xl bg-surface-container-lowest border border-surface-container text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined text-[28px]">folder_open</span>
          </div>
          <h2 className="text-xl font-semibold text-primary mb-2">
            Your history starts here
          </h2>
          <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
            Run your first project verification to see its results here. Every audit is cryptographically indexed and available for review.
          </p>
          <button
            type="button"
            onClick={onNavigateDashboard}
            className="px-5 py-2.5 rounded-lg bg-primary text-on-primary hover:bg-secondary-container hover:text-on-secondary-fixed text-sm font-medium transition-colors cursor-pointer shadow-sm inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">file_upload</span>
            <span>Scan a Project</span>
          </button>
        </div>
      )}

      {/* ── PART 8: SEARCH / FILTER EMPTY STATE ─────────────────────────────── */}
      {!loading && !error && scans.length > 0 && filteredScans.length === 0 && (
        <div className="p-10 rounded-2xl bg-surface-container-lowest border border-surface-container text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-3">
            <span className="material-symbols-outlined text-[24px]">filter_alt_off</span>
          </div>
          <h2 className="text-base font-semibold text-primary mb-1">No matching scans</h2>
          <p className="text-xs text-on-surface-variant max-w-sm mb-4">
            No scan records match your active search and filter parameters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-variant text-primary text-xs font-medium transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── PART 6: SCAN RECORDS (TABLE & RESPONSIVE LIST) ───────────────────── */}
      {!loading && filteredScans.length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs overflow-hidden">
          {/* Table Header (Desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-surface-container-low border-b border-surface-container text-xs font-mono font-medium text-on-surface-variant uppercase tracking-wider">
            <div className="col-span-5">Project Archive</div>
            <div className="col-span-2">Scan Date</div>
            <div className="col-span-2">Readiness</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Body */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="divide-y divide-surface-container"
          >
            {filteredScans.map((scan) => {
              const scanId = scan.id || scan.scanId;
              const isRunning = ['queued', 'extracting', 'scanning', 'installing', 'testing', 'reporting'].includes(
                scan.status
              );
              const isDone = scan.status === 'done';
              const isError = scan.status === 'error';

              // Readiness Badge
              let readinessBadge;
              if (scan.verdict === 'ready') {
                readinessBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Ready
                  </span>
                );
              } else if (scan.verdict === 'not_ready') {
                readinessBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                    Not Ready
                  </span>
                );
              } else if (scan.verdict === 'partially_verified') {
                readinessBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    Partially Verified
                  </span>
                );
              } else if (isRunning) {
                readinessBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse"></span>
                    Pending
                  </span>
                );
              } else {
                readinessBadge = (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs">
                    Not Available
                  </span>
                );
              }

              // Lifecycle Status Badge
              let lifecycleBadge;
              if (isRunning) {
                lifecycleBadge = (
                  <span className="text-xs font-mono text-sky-700 font-medium">
                    Running
                  </span>
                );
              } else if (isDone) {
                lifecycleBadge = (
                  <span className="text-xs font-mono text-on-surface font-medium">
                    Completed
                  </span>
                );
              } else if (isError) {
                lifecycleBadge = (
                  <span className="text-xs font-mono text-error font-medium">
                    Failed
                  </span>
                );
              } else {
                lifecycleBadge = (
                  <span className="text-xs font-mono text-on-surface-variant">
                    {scan.status || 'Unknown'}
                  </span>
                );
              }

              return (
                <motion.div
                  key={scanId}
                  variants={itemVariants}
                  className="px-6 py-4 hover:bg-surface-container-low/60 transition-colors flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 md:items-center"
                >
                  {/* Column 1: Project Archive */}
                  <div className="md:col-span-5 min-w-0 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center shrink-0 mt-0.5 text-primary">
                      <span className="material-symbols-outlined text-[20px]">folder_zip</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          title={scan.originalFilename || scan.projectName}
                          className="text-sm font-semibold text-primary truncate"
                        >
                          {scan.originalFilename || scan.projectName}
                        </span>
                        {scan.projectName && scan.projectName !== scan.originalFilename && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant shrink-0 font-medium">
                            {scan.projectName}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium shrink-0 uppercase border ${
                          scan.ecosystem === 'python'
                            ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        }`}>
                          {scan.ecosystem === 'python' ? 'Python' : 'Node'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-on-surface-variant mt-0.5 truncate">
                        ID: {scanId}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Scan Date */}
                  <div className="md:col-span-2 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1.5 md:block">
                      <span className="md:hidden font-medium text-primary">Scanned: </span>
                      <span>{formatDate(scan.createdAt)}</span>
                    </div>
                  </div>

                  {/* Column 3: Readiness */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <span className="md:hidden text-xs font-medium text-primary">Readiness: </span>
                    {readinessBadge}
                  </div>

                  {/* Column 4: Scan Lifecycle */}
                  <div className="md:col-span-1">
                    <div className="flex items-center gap-2 md:block">
                      <span className="md:hidden text-xs font-medium text-primary">Status: </span>
                      {lifecycleBadge}
                    </div>
                  </div>

                  {/* Column 5: Actions */}
                  <div className="md:col-span-2 flex items-center md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-surface-container">
                    {/* View Report */}
                    {onViewReport && (isDone || scan.hasReport) && (
                      <button
                        type="button"
                        onClick={() => onViewReport(scanId)}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="View comprehensive scan report"
                      >
                        <span>View</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    )}

                    {/* Download HTML */}
                    {(isDone || scan.hasReport) && (
                      <a
                        href={getReportHtmlUrl(scanId)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        title="Download HTML Report"
                      >
                        <span className="material-symbols-outlined text-[16px]">html</span>
                      </a>
                    )}

                    {/* Download JSON */}
                    {(isDone || scan.hasReport) && (
                      <a
                        href={getReportJsonUrl(scanId)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        title="Download JSON Report"
                      >
                        <span className="material-symbols-outlined text-[16px]">data_object</span>
                      </a>
                    )}

                    {isRunning && (
                      <span className="text-xs text-on-surface-variant font-mono">
                        Running tests...
                      </span>
                    )}

                    {isError && !scan.hasReport && (
                      <span className="text-xs text-error font-mono">
                        Aborted
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
}
