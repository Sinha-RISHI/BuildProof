/**
 * App.jsx
 *
 * What this file does:
 *   Root application coordinator for BuildProof.
 *   Implements the updated Google Stitch design system layout:
 *     - Fixed top navigation header with health telemetry and quick actions
 *     - Main view router ('dashboard', 'progress', 'result', 'how-it-works', 'history')
 *     - Shared professional footer with ISO/IEC 25010 standards attribution
 *     - ISO/IEC 25010 Compliance Specification modal
 *     - System health polling for real-time Docker reachability
 *     - Real upload workflow connecting to POST /api/scans
 *     - Scan status polling and transitions
 */

import React, { useState, useEffect, useRef } from 'react';
import AppHeader from './components/AppHeader.jsx';
import AppFooter from './components/AppFooter.jsx';
import ComplianceModal from './components/ComplianceModal.jsx';
import UploadZone from './components/UploadZone.jsx';
import ScanProgress from './components/ScanProgress.jsx';
import ScanResult from './components/ScanResult.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import ScanHistoryView from './components/ScanHistoryView.jsx';
import { getHealth, uploadScan, getScan } from './api.js';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);

  // Active scan state
  const [activeScanId, setActiveScanId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState('');
  const [completedScanRecord, setCompletedScanRecord] = useState(null);
  const [scanErrorMessage, setScanErrorMessage] = useState(null);

  const uploadZoneRef = useRef(null);

  // Health check on mount and periodic interval
  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const data = await getHealth();
        if (mounted) {
          setHealth(data);
        }
      } catch {
        if (mounted) {
          setHealth({
            ok: false,
            service: 'buildproof-server',
            time: new Date().toISOString(),
            docker: { reachable: false, version: null, error: 'Cannot connect to server' },
          });
        }
      }
    }

    loadHealth();
    const interval = setInterval(loadHealth, 10000); // Check every 10s

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle upload initiation from UploadZone
  async function handleScanStarted(file) {
    setScanErrorMessage(null);
    const result = await uploadScan(file);
    setActiveScanId(result.scanId);
    setActiveProjectName(result.projectName || file.name.replace(/\.zip$/i, ''));
    setCurrentView('progress');
  }

  // Handle scan completion from ScanProgress
  function handleScanCompleted(record) {
    setCompletedScanRecord(record);
    setCurrentView('result');
  }

  // Handle scan failure from ScanProgress
  function handleScanFailed(error) {
    setScanErrorMessage(error);
    setCurrentView('dashboard');
  }

  // Reset journey to upload another project
  function handleReset() {
    setActiveScanId(null);
    setActiveProjectName('');
    setCompletedScanRecord(null);
    setScanErrorMessage(null);
    setCurrentView('dashboard');
  }

  // Handle viewing a report from the historical audit ledger
  async function handleViewReportFromHistory(scanId) {
    try {
      const record = await getScan(scanId);
      setCompletedScanRecord(record);
      setActiveProjectName(record.projectName || 'Project Archive');
      setActiveScanId(scanId);
      setCurrentView('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setScanErrorMessage(`Failed to open report for scan ${scanId}: ${err.message}`);
    }
  }

  function handleTriggerUpload() {
    if (uploadZoneRef.current) {
      uploadZoneRef.current.triggerUpload();
    }
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased flex flex-col selection:bg-secondary-container selection:text-on-secondary-fixed">
      {/* Fixed Top Header */}
      <AppHeader
        currentView={currentView}
        onNavigate={(view) => {
          setScanErrorMessage(null);
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onTriggerUpload={handleTriggerUpload}
        onOpenCompliance={() => setIsComplianceOpen(true)}
        health={health}
      />

      {/* Main Content Stage */}
      <main className="w-full pt-16 bg-surface min-h-[calc(100vh-16rem)] flex-1">
        {/* Global Error Banner if scan or network failed */}
        {scanErrorMessage && (
          <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-6">
            <div className="p-4 rounded-xl bg-error-container/40 border border-error/30 text-error flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span className="text-sm font-medium">Scan Error: {scanErrorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setScanErrorMessage(null)}
                className="p-1 rounded hover:bg-error-container/60 text-error cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* View Routing */}
        {currentView === 'dashboard' && (
          <UploadZone
            ref={uploadZoneRef}
            onScanStarted={handleScanStarted}
            onNavigateHowItWorks={() => setCurrentView('how-it-works')}
            health={health}
            lastScanRecord={completedScanRecord}
          />
        )}

        {currentView === 'progress' && activeScanId && (
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
            <ScanProgress
              scanId={activeScanId}
              initialProjectName={activeProjectName}
              onScanCompleted={handleScanCompleted}
              onScanFailed={handleScanFailed}
            />
          </div>
        )}

        {currentView === 'result' && completedScanRecord && (
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
            <ScanResult
              scanRecord={completedScanRecord}
              onReset={handleReset}
            />
          </div>
        )}

        {currentView === 'how-it-works' && (
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
            <HowItWorks
              onNavigateDashboard={() => setCurrentView('dashboard')}
            />
          </div>
        )}

        {currentView === 'history' && (
          <ScanHistoryView
            onNavigateDashboard={() => {
              setCurrentView('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onViewReport={handleViewReportFromHistory}
          />
        )}
      </main>

      {/* Shared Footer */}
      <AppFooter
        onNavigate={(view) => {
          setCurrentView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenCompliance={() => setIsComplianceOpen(true)}
      />

      {/* Compliance Specification Modal */}
      <ComplianceModal
        isOpen={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
      />
    </div>
  );
}
