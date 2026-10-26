/**
 * App.jsx
 *
 * What this file does:
 *   Root component for the BuildProof interactive frontend.
 *   Coordinates:
 *     - Navigation between views ('dashboard', 'progress', 'result', 'how-it-works')
 *     - System health polling for real-time API and Docker reachability
 *     - Upload initiation to POST /api/scans
 *     - Progress tracking and polling transition to final scan results
 *     - Full visual integration of Google Stitch dark navy UI designs
 */

import React, { useState, useEffect } from 'react';
import AppSidebar from './components/AppSidebar.jsx';
import AppHeader from './components/AppHeader.jsx';
import UploadZone from './components/UploadZone.jsx';
import ScanProgress from './components/ScanProgress.jsx';
import ScanResult from './components/ScanResult.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import { getHealth, uploadScan } from './api.js';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Active scan state
  const [activeScanId, setActiveScanId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState('');
  const [completedScanRecord, setCompletedScanRecord] = useState(null);
  const [scanErrorMessage, setScanErrorMessage] = useState(null);

  // Health check on mount and interval
  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const data = await getHealth();
        if (mounted) {
          setHealth(data);
          setHealthLoading(false);
        }
      } catch {
        if (mounted) {
          setHealth({
            ok: false,
            service: 'buildproof-server',
            time: new Date().toISOString(),
            docker: { reachable: false, version: null, error: 'Cannot connect to server' },
          });
          setHealthLoading(false);
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

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface antialiased flex">
      {/* Fixed Left Sidebar */}
      <AppSidebar
        currentView={currentView}
        onNavigate={(view) => {
          setScanErrorMessage(null);
          setCurrentView(view);
        }}
        health={health}
        healthLoading={healthLoading}
      />

      {/* Main Content Area (offset by sidebar width: 15rem / 60px) */}
      <div className="pl-60 w-full flex flex-col min-h-screen">
        {/* Top Header */}
        <AppHeader
          currentView={currentView}
          projectName={activeProjectName}
          onNavigate={(view) => {
            setScanErrorMessage(null);
            setCurrentView(view);
          }}
          health={health}
        />

        {/* Page Content Body (pt-16 for header clearance) */}
        <main className="relative pt-20 p-8 min-h-screen bg-surface-container-lowest">
          <div className="max-w-6xl mx-auto">
            {/* Global Error Banner if scan failed */}
            {scanErrorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-error-container/20 border border-error/30 text-error flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">error</span>
                  <span className="text-sm font-medium">Scan Error: {scanErrorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScanErrorMessage(null)}
                  className="p-1 rounded hover:bg-error-container/30 text-error cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* View Switcher */}
            {currentView === 'dashboard' && (
              <UploadZone
                onScanStarted={handleScanStarted}
                onNavigateHowItWorks={() => setCurrentView('how-it-works')}
                health={health}
              />
            )}

            {currentView === 'progress' && activeScanId && (
              <ScanProgress
                scanId={activeScanId}
                initialProjectName={activeProjectName}
                onScanCompleted={handleScanCompleted}
                onScanFailed={handleScanFailed}
              />
            )}

            {currentView === 'result' && completedScanRecord && (
              <ScanResult
                scanRecord={completedScanRecord}
                onReset={handleReset}
              />
            )}

            {currentView === 'how-it-works' && (
              <HowItWorks
                onNavigateDashboard={() => setCurrentView('dashboard')}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
