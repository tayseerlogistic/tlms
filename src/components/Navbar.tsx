import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLms } from '../context/LmsContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import {
  Truck, FileSpreadsheet, ClipboardList, Wallet, Gauge,
  Shield, LogOut, LogIn, Settings, Sun, Moon
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, onOpenLogin }) => {
  const { user, profile, role, logout, switchRole } = useAuth();
  const { conflicts } = useLms();
  const { theme } = useTheme();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [brandName, setBrandName] = useState(() => localStorage.getItem('tlms.brandName') || 'TLS Logistics LMS');
  const [brandSubtitle, setBrandSubtitle] = useState(() => localStorage.getItem('tlms.brandSubtitle') || 'Tayseer Group Central Fleet Operating System');
  const [brandLogoUrl, setBrandLogoUrl] = useState(() => localStorage.getItem('tlms.brandLogoUrl') || '');

  useEffect(() => {
    const syncBranding = () => {
      setBrandName(localStorage.getItem('tlms.brandName') || 'TLS Logistics LMS');
      setBrandSubtitle(localStorage.getItem('tlms.brandSubtitle') || 'Tayseer Group Central Fleet Operating System');
      setBrandLogoUrl(localStorage.getItem('tlms.brandLogoUrl') || '');
    };
    window.addEventListener('tlms-branding-updated', syncBranding);
    window.addEventListener('storage', syncBranding);
    return () => {
      window.removeEventListener('tlms-branding-updated', syncBranding);
      window.removeEventListener('storage', syncBranding);
    };
  }, []);

  const openConflictsCount = conflicts.filter(c => c.status === 'open').length;

  const navItems = [
    { id: 'overview', label: 'Command Center', icon: Gauge },
    { id: 'timetable', label: 'Timetable Dispatch', icon: FileSpreadsheet },
    { id: 'manifest', label: 'Daily Manifest', icon: ClipboardList },
    { id: 'km-fuel', label: 'KM & Fuel Balancing', icon: Truck },
    { id: 'cashbook', label: 'Cashbook Pro', icon: Wallet },
  ];

  const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
    admin: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
    editor: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/40' },
    operator: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/40' },
    dispatcher: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
    cashier: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
    driver: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
    viewer: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' },
  };

  const currentRoleColor = roleColors[role] || roleColors.operator;

  const currentDisplayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || profile?.email?.split('@')[0] || 'Guest';
  const currentEmail = profile?.email || user?.email || '';

  return (
    <header className="w-full min-w-0 bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-xl">
      <div className="w-full px-3 sm:px-5 lg:px-8 py-2.5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2">
        <div className="min-w-0 flex flex-col gap-1.5">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-lg overflow-hidden">
            {brandLogoUrl ? <img src={brandLogoUrl} alt="Website logo" className="h-full w-full object-contain bg-white" onError={e => { e.currentTarget.style.display = 'none'; }} /> : '⚡'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white truncate">{brandName}</span>
              <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700 shrink-0">v3.5</span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-[360px]">{brandSubtitle}</p>
          </div>
        </div>
      {/* Main Navigation Tabs: left aligned and allowed to wrap when space is limited */}
      <nav aria-label="Main navigation" className="w-full min-w-0 border-t border-slate-800/80 pt-1">
        <div className="flex flex-wrap items-center justify-start gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex flex-1 sm:flex-none justify-center sm:justify-start items-center gap-2 px-2 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all border-b-2 min-w-0 ${
                  isActive
                    ? 'border-blue-500 text-white bg-slate-800/60 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
        </div>

        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2 sm:gap-3 min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-2">
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {/* Quick Settings Shortcut button */}
          <button
            onClick={() => setCurrentTab('settings')}
            title="Open Settings (Master Repository, Mood, Driver Portal, Permissions, Backup)"
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
              currentTab === 'settings'
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Settings className={`w-3.5 h-3.5 ${currentTab === 'settings' ? 'text-white animate-spin-slow' : 'text-blue-400'}`} />
            <span className="hidden sm:inline">Settings</span>
            {openConflictsCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.2 rounded-full font-mono">
                {openConflictsCount}
              </span>
            )}
          </button>

          {/* Active Role Badge & Simulator */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border transition ${currentRoleColor.bg} ${currentRoleColor.text} ${currentRoleColor.border}`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="capitalize">{role}</span>
              {profile?.role === 'admin' && <span className="text-[10px] opacity-75">▾</span>}
            </button>

            {/* Admin Role Switching Menu (For Testing Permission Views) */}
            {showRoleMenu && profile?.role === 'admin' && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Simulate Role View</span>
                  <span className="text-[9px] bg-slate-900 text-indigo-300 px-1.5 py-0.2 rounded">Admin Only</span>
                </div>
                {(['admin', 'editor', 'operator', 'dispatcher', 'cashier', 'driver', 'viewer'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      switchRole(r);
                      setShowRoleMenu(false);
                      if (r === 'driver') setCurrentTab('driver-portal');
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-700 transition ${role === r ? 'font-bold text-blue-400 bg-slate-700/50' : 'text-slate-300'}`}
                  >
                    <span className="capitalize">{r}</span>
                    {role === r && <span className="text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile / Login */}
          {(user || profile) ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">{currentDisplayName}</span>
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">{currentEmail}</span>
              </div>
              <button
                onClick={logout}
                title="Sign Out of TLS Hub"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenLogin && onOpenLogin()}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
        </div>
      </div>
    </header>
  );
};
