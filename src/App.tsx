import React, { useState, useEffect, lazy, Suspense } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LmsProvider } from './context/LmsContext';
import { Navbar } from './components/Navbar';
const OverviewView = lazy(() => import('./components/OverviewView').then(module => ({ default: module.OverviewView })));
const TimetableParserView = lazy(() => import('./components/TimetableParserView').then(module => ({ default: module.TimetableParserView })));
const DailyManifestView = lazy(() => import('./components/DailyManifestView').then(module => ({ default: module.DailyManifestView })));
const CashbookView = lazy(() => import('./components/CashbookView').then(module => ({ default: module.CashbookView })));
const KmFuelView = lazy(() => import('./components/KmFuelView').then(module => ({ default: module.KmFuelView })));
const SettingsView = lazy(() => import('./components/SettingsView').then(module => ({ default: module.SettingsView })));
const LoginView = lazy(() => import('./components/LoginView').then(module => ({ default: module.LoginView })));
import { ErrorBoundary } from './components/ErrorBoundary';
import { Lock, LogIn } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, profile, role, loading, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [brandName, setBrandName] = useState(() => localStorage.getItem('tlms.brandName') || 'TLS Logistics LMS');
  const [brandSubtitle, setBrandSubtitle] = useState(() => localStorage.getItem('tlms.brandSubtitle') || 'Tayseer Group Central Fleet Operating System');

  useEffect(() => {
    const syncBranding = () => {
      const nextName = localStorage.getItem('tlms.brandName') || 'TLS Logistics LMS';
      const nextSubtitle = localStorage.getItem('tlms.brandSubtitle') || 'Tayseer Group Central Fleet Operating System';
      setBrandName(nextName);
      setBrandSubtitle(nextSubtitle);
      document.title = nextName;
    };
    syncBranding();
    window.addEventListener('tlms-branding-updated', syncBranding);
    window.addEventListener('storage', syncBranding);
    return () => {
      window.removeEventListener('tlms-branding-updated', syncBranding);
      window.removeEventListener('storage', syncBranding);
    };
  }, []);

  const isAuthenticated = Boolean(user || profile);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono tracking-wider uppercase text-slate-400">Initializing TLS Logistics Hub &amp; Firebase...</p>
      </div>
    );
  }

  // If not authenticated and user hasn't explicitly chosen guest mode, show the secure Login Screen
  if (!isAuthenticated && !isGuestMode) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-8 relative">
        <Suspense fallback={<div className="text-xs text-slate-400">Loading login…</div>}>
          <LoginView
            onSuccess={() => setIsGuestMode(false)}
            onExploreGuest={() => setIsGuestMode(true)}
          />
        </Suspense>
        <footer className="mt-8 text-center text-xs text-slate-500 font-mono">
{brandName} &bull; {brandSubtitle} &bull; Test Version
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Universal Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1 w-full min-w-0 max-w-none mx-auto px-[clamp(0.75rem,2vw,2rem)] py-6">
        {/* If user is browsing in guest mode, show notice that self-registration is locked and account login is required for modifications */}
        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-blue-900/40 border border-blue-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <span>Guest View Mode &bull; Public Sign-Up Locked</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-sans">
                    Admin-Provisioned Only
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sign in with your administrator-issued corporate account (<strong className="text-white font-mono">admin@tls.com</strong>) to manage fleet data, dispatch timetables, and provision users.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Sign In to Fleet Portal
            </button>
          </div>
        )}

        {/* View Router */}
        <ErrorBoundary key={currentTab} fallbackTitle={`Error displaying ${currentTab}`}>
          <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-xs font-mono text-slate-400">Loading {currentTab.replace('-', ' ')}…</div>}>
          {currentTab === 'overview' && <OverviewView onNavigate={setCurrentTab} />}
          {currentTab === 'timetable' && <TimetableParserView />}
          {currentTab === 'manifest' && <DailyManifestView />}
          {currentTab === 'km-fuel' && <KmFuelView />}
          {currentTab === 'cashbook' && <CashbookView />}
          {currentTab === 'settings' && <SettingsView onBackToCommandCenter={() => setCurrentTab('overview')} />}
          {currentTab === 'master' && <SettingsView initialTab="master" onBackToCommandCenter={() => setCurrentTab('overview')} />}
          {currentTab === 'driver-portal' && <SettingsView initialTab="driver-portal" onBackToCommandCenter={() => setCurrentTab('overview')} />}
          {currentTab === 'users' && <SettingsView initialTab="users" onBackToCommandCenter={() => setCurrentTab('overview')} />}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Login Modal (if opened while in guest mode) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 z-10 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60"
            >
              ✕
            </button>
            <Suspense fallback={<div className="text-xs text-slate-400">Loading login…</div>}>
              <LoginView
                onSuccess={() => {
                  setIsLoginModalOpen(false);
                  setIsGuestMode(false);
                }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-400 font-mono">
        <p>{brandName} &bull; {brandSubtitle} &bull; Test Version</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LmsProvider>
          <MainAppContent />
        </LmsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
