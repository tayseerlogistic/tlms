import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLms } from '../context/LmsContext';
import { MasterDataView } from './MasterDataView';
import { DriverPortalView } from './DriverPortalView';
import { UserManagementView } from './UserManagementView';
import {
  Settings, Sun, Moon, Database, Smartphone, Shield, Download, Upload,
  CheckCircle2, Sparkles, RefreshCw, HardDrive, Check, AlertTriangle, ArrowLeft
} from 'lucide-react';

interface SettingsViewProps {
  initialTab?: 'mood' | 'master' | 'driver-portal' | 'users' | 'backup';
  onBackToCommandCenter?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialTab = 'mood',
  onBackToCommandCenter
}) => {
  const { theme, toggleTheme } = useTheme();
  const { role, isAdmin } = useAuth();
  const {
    trucks, drivers, equipment, schedules, manifests, kmRecords,
    cashTransactions, conflicts, exportFullBackup, restoreFullBackup
  } = useLms();

  const [activeTab, setActiveTab] = useState<'mood' | 'master' | 'driver-portal' | 'users' | 'backup'>(initialTab);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);
  const [brandName, setBrandName] = useState(() => localStorage.getItem('tlms.brandName') || 'TLS Logistics LMS');
  const [brandSubtitle, setBrandSubtitle] = useState(() => localStorage.getItem('tlms.brandSubtitle') || 'Tayseer Group Central Fleet Operating System');
  const [brandLogoUrl, setBrandLogoUrl] = useState(() => localStorage.getItem('tlms.brandLogoUrl') || '');
  const [brandSaved, setBrandSaved] = useState(false);

  const saveBranding = () => {
    localStorage.setItem('tlms.brandName', brandName.trim() || 'TLS Logistics LMS');
    localStorage.setItem('tlms.brandSubtitle', brandSubtitle.trim() || 'Tayseer Group Central Fleet Operating System');
    localStorage.setItem('tlms.brandLogoUrl', brandLogoUrl.trim());
    window.dispatchEvent(new CustomEvent('tlms-branding-updated'));
    setBrandSaved(true);
  };

  const openConflictsCount = conflicts.filter(c => c.status === 'open').length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoring(true);
    setRestoreFeedback(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await restoreFullBackup(json);
        setRestoreFeedback(res.message);
      } catch (err: any) {
        setRestoreFeedback('Failed to parse backup JSON: ' + err.message);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const navItems = [
    { id: 'mood' as const, label: 'Change Mood', icon: theme === 'dark' ? Sun : Moon, desc: 'Dark / Light theme styling' },
    { id: 'master' as const, label: 'Master Repository', icon: Database, desc: 'Fleet trucks, equipment, drivers & rates', badge: openConflictsCount > 0 ? openConflictsCount : undefined },
    { id: 'driver-portal' as const, label: 'Driver Portal', icon: Smartphone, desc: 'Driver mobile trip sheets & logger' },
    { id: 'users' as const, label: 'User & Permissions', icon: Shield, desc: 'RBAC roles & admin provisioning' },
    { id: 'backup' as const, label: 'Backup & Restore', icon: HardDrive, desc: 'Full JSON system snapshots' },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">System Settings &amp; Administration</h2>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full">
                TLS Hub v3.5
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Centralized controls: Theme Mood, Fleet Master Repository, Driver Portal, Role Permissions &amp; Data Backups
            </p>
          </div>
        </div>

        {onBackToCommandCenter && (
          <button
            onClick={onBackToCommandCenter}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        )}
      </div>

      {/* Modern Settings Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 rounded-xl text-left transition flex flex-col gap-1 cursor-pointer relative ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                {item.badge !== undefined && (
                  <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                {item.label}
              </span>
              <span className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                {item.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-Tab 1: CHANGE MOOD (THEME) */}
      {activeTab === 'mood' && (
        <div className="space-y-6">
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Interface Mood &amp; Visual Theme
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Customize the visual look of TLS Logistics LMS. Changes apply instantly across all modules with high-contrast text and border tuning.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
              <h4 className="text-sm font-bold text-white">Website Name &amp; Logo</h4>
              <p className="text-xs text-slate-400">Change the title shown in the navigation header. Logo must be an image URL; leave blank to use the default lightning icon. This setting is saved in this browser.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-300 space-y-1 block">
                  <span>Website name</span>
                  <input value={brandName} onChange={e => { setBrandName(e.target.value); setBrandSaved(false); }} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="TLS Logistics LMS" />
                </label>
                <label className="text-xs font-semibold text-slate-300 space-y-1 block">
                  <span>Header subtitle</span>
                  <input value={brandSubtitle} onChange={e => { setBrandSubtitle(e.target.value); setBrandSaved(false); }} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="Tayseer Group Central Fleet Operating System" />
                </label>
              </div>
              <label className="text-xs font-semibold text-slate-300 space-y-1 block">
                <span>Logo image URL (optional)</span>
                <input value={brandLogoUrl} onChange={e => { setBrandLogoUrl(e.target.value); setBrandSaved(false); }} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="https://example.com/logo.png" />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">{brandSaved ? 'Branding saved for this browser.' : 'Save to apply the branding to the header.'}</span>
                <button type="button" onClick={saveBranding} className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white">Save Branding</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dark Mood Card */}
              <div
                onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                className={`p-5 rounded-2xl border-2 transition cursor-pointer relative overflow-hidden ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-slate-900 shadow-xl shadow-blue-500/20'
                    : 'border-slate-700 bg-slate-900/40 hover:border-slate-600 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-slate-800 text-amber-400 rounded-xl border border-slate-700">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">Dark Mood (Midnight Slate)</h4>
                      <p className="text-[11px] text-slate-400">Low eye strain for dispatch centers &amp; night operations</p>
                    </div>
                  </div>
                  {theme === 'dark' && (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono">
                      <Check className="w-3 h-3" /> Active Mood
                    </span>
                  )}
                </div>

                {/* Preview Mini UI */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Fleet Dispatch Preview</span>
                    <span className="text-emerald-400 font-bold">● 64 Drivers Active</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-20 bg-blue-600 rounded flex items-center justify-center text-[10px] text-white font-bold">Action</div>
                    <div className="h-6 flex-1 bg-slate-800 rounded px-2 flex items-center text-[10px] text-slate-300 font-mono">Yanbu &rarr; Riyadh</div>
                  </div>
                </div>
              </div>

              {/* Light Mood Card */}
              <div
                onClick={() => { if (theme !== 'light') toggleTheme(); }}
                className={`p-5 rounded-2xl border-2 transition cursor-pointer relative overflow-hidden ${
                  theme === 'light'
                    ? 'border-blue-500 bg-white shadow-xl shadow-blue-500/20'
                    : 'border-slate-700 bg-slate-900/40 hover:border-slate-600 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Light Mood (Clean Studio Day)</h4>
                      <p className="text-[11px] text-slate-500">Crisp high-contrast corporate look for daytime offices</p>
                    </div>
                  </div>
                  {theme === 'light' && (
                    <span className="bg-emerald-500/20 text-emerald-600 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 font-mono">
                      <Check className="w-3 h-3" /> Active Mood
                    </span>
                  )}
                </div>

                {/* Preview Mini UI */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-600 font-medium">Fleet Dispatch Preview</span>
                    <span className="text-emerald-600 font-bold">● 64 Drivers Active</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-20 bg-blue-600 rounded flex items-center justify-center text-[10px] text-white font-bold">Action</div>
                    <div className="h-6 flex-1 bg-white border border-slate-300 rounded px-2 flex items-center text-[10px] text-slate-700 font-mono">Yanbu &rarr; Riyadh</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400">
              <span>Theme preference is saved locally and applies across browser reloads.</span>
              <button
                onClick={toggleTheme}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-200" />}
                Toggle to {theme === 'dark' ? 'Light Mood' : 'Dark Mood'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: MASTER REPOSITORY */}
      {activeTab === 'master' && (
        <div className="space-y-4">
          <MasterDataView />
        </div>
      )}

      {/* Sub-Tab 3: DRIVER PORTAL */}
      {activeTab === 'driver-portal' && (
        <div className="space-y-4">
          <DriverPortalView />
        </div>
      )}

      {/* Sub-Tab 4: USER & PERMISSIONS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <UserManagementView />
        </div>
      )}

      {/* Sub-Tab 5: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-sky-400" /> Database Backup &amp; Disaster Recovery
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Download clean, complete JSON snapshots of your entire fleet database or restore from a previously exported backup file.
            </p>
          </div>

          {/* Database Vital Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">TRUCKS</span>
              <div className="text-lg font-black text-white font-mono mt-0.5">{trucks.length} Units</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">EQUIPMENT</span>
              <div className="text-lg font-black text-sky-400 font-mono mt-0.5">{equipment.length} Tankers</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">DRIVERS</span>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">{drivers.length} Master</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">SCHEDULES</span>
              <div className="text-lg font-black text-indigo-400 font-mono mt-0.5">{Object.keys(schedules).length} Dates</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">MANIFESTS</span>
              <div className="text-lg font-black text-purple-400 font-mono mt-0.5">{Object.keys(manifests).length} Verified</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase text-slate-400">KM RECORDS</span>
              <div className="text-lg font-black text-amber-400 font-mono mt-0.5">{kmRecords.length} Logs</div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Export Snapshot Card */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Download Full Master Clean JSON</h4>
                  <p className="text-[11px] text-slate-400">Includes all 64 drivers, 46 trucks, tankers, dispatches, manifests &amp; KM records</p>
                </div>
              </div>
              <button
                onClick={exportFullBackup}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download JSON Backup Snapshot
              </button>
            </div>

            {/* Restore Card */}
            <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Restore from JSON File</h4>
                  <p className="text-[11px] text-slate-400">Select a previously saved master JSON file to restore the database</p>
                </div>
              </div>
              <label className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" /> {isRestoring ? 'Restoring...' : 'Upload & Restore JSON'}
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" disabled={isRestoring} />
              </label>
            </div>
          </div>

          {restoreFeedback && (
            <div className="p-3.5 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{restoreFeedback}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
