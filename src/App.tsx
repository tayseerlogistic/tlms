import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LmsProvider } from './context/LmsContext';
import { Navbar } from './components/Navbar';
import { OverviewView } from './components/OverviewView';
import { MasterDataView } from './components/MasterDataView';
import { TimetableParserView } from './components/TimetableParserView';
import { DailyManifestView } from './components/DailyManifestView';
import { CashbookView } from './components/CashbookView';
import { KmFuelView } from './components/KmFuelView';
import { DriverPortalView } from './components/DriverPortalView';
import { ShieldCheck, LogIn, Lock } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, role, loading, loginWithGoogle } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('overview');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono tracking-wider uppercase text-slate-400">Initializing TLS Logistics Hub &amp; Firebase...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Universal Navbar */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* If user is not authenticated, show a prominent invitation banner while still allowing read access */}
        {!user && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-blue-900/40 border border-blue-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Secure Firebase Authentication Available
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sign in with Google to enable real-time cloud synchronization, administrative audits, and role-based permissions.
                </p>
              </div>
            </div>
            <button
              onClick={loginWithGoogle}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition shrink-0"
            >
              <LogIn className="w-4 h-4" /> Sign In with Google
            </button>
          </div>
        )}

        {/* View Router */}
        {currentTab === 'overview' && <OverviewView onNavigate={setCurrentTab} />}
        {currentTab === 'master' && <MasterDataView />}
        {currentTab === 'timetable' && <TimetableParserView />}
        {currentTab === 'manifest' && <DailyManifestView />}
        {currentTab === 'cashbook' && <CashbookView />}
        {currentTab === 'km-fuel' && <KmFuelView />}
        {currentTab === 'driver-portal' && <DriverPortalView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-400 font-mono">
        <p>TLS Logistics Management System &bull; Tayseer Group Fleet Central Platform &bull; Real-time Firebase Firestore Sync</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LmsProvider>
        <MainAppContent />
      </LmsProvider>
    </AuthProvider>
  );
}
