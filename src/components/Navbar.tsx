import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLms } from '../context/LmsContext';
import { UserRole } from '../types';
import {
  Truck, FileSpreadsheet, ClipboardList, Wallet, Gauge,
  Database, Shield, LogOut, LogIn, UserCheck, Smartphone,
  Download, Upload, AlertTriangle
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { user, profile, role, loginWithGoogle, logout, switchRole, isAdmin, isDriver } = useAuth();
  const { conflicts, exportFullBackup, restoreFullBackup } = useLms();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const openConflictsCount = conflicts.filter(c => c.status === 'open').length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await restoreFullBackup(json);
        alert(res.message);
      } catch (err: any) {
        alert("Failed to parse backup JSON: " + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems = [
    { id: 'overview', label: 'Command Center', icon: Gauge },
    { id: 'master', label: 'Master Repository', icon: Database, badge: openConflictsCount > 0 ? openConflictsCount : undefined },
    { id: 'timetable', label: 'Timetable Dispatch', icon: FileSpreadsheet },
    { id: 'manifest', label: 'Daily Manifest', icon: ClipboardList },
    { id: 'cashbook', label: 'Cashbook Pro', icon: Wallet },
    { id: 'km-fuel', label: 'KM & Fuel Balancing', icon: Truck },
    { id: 'driver-portal', label: 'Driver Portal', icon: Smartphone },
  ];

  const roleColors: Record<UserRole, { bg: string; text: string; border: string }> = {
    admin: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
    dispatcher: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
    cashier: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
    driver: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-xl">
      {/* Top Banner with Brand, Auth & Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-lg">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-mono">TLS</span>
              <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent font-bold text-xs uppercase tracking-widest">LOGISTICS LMS</span>
              <span className="bg-slate-800 text-slate-400 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700">v3.0</span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Tayseer Group Central Fleet Operating System</p>
          </div>
        </div>

        {/* Auth & Role Status Bar */}
        <div className="flex items-center gap-3">
          {/* Backup & Restore controls */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60">
            <button
              onClick={exportFullBackup}
              title="Download full JSON Master Clean Backup"
              className="text-slate-300 hover:text-white px-2 py-1 text-xs font-medium rounded flex items-center gap-1 hover:bg-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" /> Backup
            </button>
            <label className="text-slate-300 hover:text-white px-2 py-1 text-xs font-medium rounded flex items-center gap-1 hover:bg-slate-700 transition cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-400" /> Restore
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
            </label>
          </div>

          {/* Active Role Badge & Simulator */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono border transition ${roleColors[role].bg} ${roleColors[role].text} ${roleColors[role].border}`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="capitalize">{role}</span>
              {profile?.role === 'admin' && <span className="text-[10px] opacity-75">▾</span>}
            </button>

            {/* Admin Role Switching Menu */}
            {showRoleMenu && profile?.role === 'admin' && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Role View</div>
                {(['admin', 'dispatcher', 'cashier', 'driver'] as UserRole[]).map((r) => (
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
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">{user.displayName || user.email}</span>
                <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 transition"
            >
              <LogIn className="w-3.5 h-3.5" /> Google Sign-In
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
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
        </div>
      </div>
    </header>
  );
};
