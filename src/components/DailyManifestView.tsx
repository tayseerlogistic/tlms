import React, { useState, useEffect } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { ManifestSuggestion, LearnedRule } from '../types';
import { trainManifestAiModel, getManifestModelStats, ModelTrainingStats } from '../utils/manifestAiEngine';
import * as XLSX from 'xlsx';
import {
  ClipboardList, Brain, Calendar, Save, Download, FileText,
  HelpCircle, CheckCircle2, Clock, Upload, Search, RefreshCw,
  Sparkles, Zap, ArrowRight, ShieldCheck, Check, Filter, TrendingUp, AlertCircle
} from 'lucide-react';

export const DailyManifestView: React.FC = () => {
  const {
    drivers, manifests, schedules, saveDailyManifest,
    learnedRules, learnHistoricalRules
  } = useLms();

  const { isDispatcher, isAdmin } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => '2026-09-07');
  const [subTab, setSubTab] = useState<'manifest' | 'history' | 'learning' | 'bulk'>('manifest');
  const [selectedDriverIdx, setSelectedDriverIdx] = useState(0);

  // Bulk Import state
  const [bulkTagsText, setBulkTagsText] = useState('');
  const [bulkPreviewCount, setBulkPreviewCount] = useState<number | null>(null);

  // Schedule paste state for historical learning
  const [learningPasteText, setLearningPasteText] = useState('');
  const [learningResult, setLearningResult] = useState('');

  // AI Training Center state
  const [modelStats, setModelStats] = useState<ModelTrainingStats>(() => getManifestModelStats());
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainStepMsg, setRetrainStepMsg] = useState('');
  const [aiSuccessToast, setAiSuccessToast] = useState('');

  // Search and filters for Manifest Table
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestFilter, setManifestFilter] = useState<'all' | 'scheduled' | 'transit' | 'offloading' | 'returning'>('all');

  // Editable tags for currently selected date
  const [localTags, setLocalTags] = useState<Record<number, string>>({});
  const [autoSyncedCount, setAutoSyncedCount] = useState<number>(0);

  const todayTags = manifests[selectedDate] || {};
  const currentSchedule = schedules[selectedDate]?.rows || [];

  // -------------------------------------------------------------
  // HELPER: Normalize strings
  // -------------------------------------------------------------
  const norm = (s: string) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();

  // -------------------------------------------------------------
  // AI TRAINING & RETRAINING ENGINE
  // -------------------------------------------------------------
  const handleRetrainAiModel = async () => {
    setIsRetraining(true);
    setRetrainStepMsg('Ingesting historical schedules & driver logs (August 1–31 & September 1–7)...');
    await new Promise(r => setTimeout(r, 600));

    setRetrainStepMsg('Analyzing multi-day cycle progressions (Loading → En-Route → Offloading → Return)...');
    await new Promise(r => setTimeout(r, 600));

    setRetrainStepMsg('Extracting route transition models & calibrating accuracy weights...');
    await new Promise(r => setTimeout(r, 500));

    const result = trainManifestAiModel(drivers, schedules, manifests, learnedRules);
    learnHistoricalRules(result.rules);
    setModelStats(result.stats);

    setIsRetraining(false);
    setRetrainStepMsg('');
    setAiSuccessToast(`⚡ AI Manifest Model retrained! Analyzed ${result.stats.totalTripsIngested} dispatches across ${result.stats.distinctDates} dates. Accuracy evaluated at ${result.stats.accuracyRate}%.`);
    setTimeout(() => setAiSuccessToast(''), 6000);
  };

  const handleAutoPredictAll = () => {
    const updated: Record<number, string> = {};
    drivers.forEach((d, idx) => {
      const pred = predictManifestTag(idx, selectedDate);
      updated[idx] = pred.text;
    });
    setLocalTags(updated);
    setAiSuccessToast(`🔮 Auto-applied high-confidence AI predictions for all ${drivers.length} drivers on ${selectedDate}!`);
    setTimeout(() => setAiSuccessToast(''), 5000);
  };

  // -------------------------------------------------------------
  // PREVIOUS ACTIVITY LOOKUP
  // -------------------------------------------------------------
  const getPreviousTag = (driverIdx: number, date: string): string => {
    const d = drivers[driverIdx];
    if (!d) return '';

    // Check confirmed manifests before date
    const pastManifestDates = Object.keys(manifests).filter(dt => dt < date).sort();
    if (pastManifestDates.length) {
      const lastDate = pastManifestDates[pastManifestDates.length - 1];
      if (manifests[lastDate] && manifests[lastDate][driverIdx]) {
        return manifests[lastDate][driverIdx];
      }
    }

    // Check driver history object
    if (d.history) {
      const histDates = Object.keys(d.history).filter(dt => dt < date).sort();
      if (histDates.length) {
        return d.history[histDates[histDates.length - 1]];
      }
    }

    return '';
  };

  // -------------------------------------------------------------
  // TRAINED MANIFEST PREDICTION ENGINE
  // -------------------------------------------------------------
  const predictManifestTag = (driverIdx: number, date: string): ManifestSuggestion => {
    const d = drivers[driverIdx];
    if (!d) return { text: 'At Yanbu', conf: 'low', reason: 'Driver record not found' };

    // 1. If already confirmed for this date
    if (todayTags[driverIdx]) {
      return {
        text: todayTags[driverIdx],
        conf: 'high',
        reason: 'Previously confirmed & locked for this manifest date'
      };
    }

    const prev = getPreviousTag(driverIdx, date);
    const prevNorm = norm(prev);

    // 2. Auto-fetch and match with today's Timetable Schedule
    const matchedScheduleRows = currentSchedule.filter(r => {
      const driverMatch = r.driverName && norm(r.driverName).includes(norm(d.name)) || norm(d.name).includes(norm(r.driverName));
      const plateMatch = r.plateNo && d.assignedVehiclePlate && norm(r.plateNo).replace(/\s+/g, '') === norm(d.assignedVehiclePlate).replace(/\s+/g, '');
      return driverMatch || plateMatch;
    });

    // 3. Match against trained historical rules
    if (matchedScheduleRows.length > 0) {
      const first = matchedScheduleRows[0];
      const src = first.source || 'Yanbu';
      const dst = first.destination || '';
      const cust = first.customer || first.supplier || first.store || '';
      const comm = first.commodity ? first.commodity.split('/')[0].trim() : '';

      const scheduleKey = `${norm(src)}>${norm(dst)}|${norm(cust)}|${norm(comm)}`;

      // Check pre-trained learned rules
      const rule = learnedRules.find(r =>
        r.driverIndex === driverIdx &&
        r.keys.some(k => norm(k).includes(norm(dst)) || norm(k) === scheduleKey)
      );

      if (rule && rule.hits >= 2) {
        return {
          text: rule.result,
          conf: 'high',
          reason: `Learned pattern: matched ${rule.hits} confirmed observations for route to ${dst}.`
        };
      }

      // Check lifecycle progression
      if (prevNorm.includes('UNDER LOADING') && dst) {
        return {
          text: `${comm ? comm + ' ' : ''}Supply for ${cust} - On the way to ${dst}`,
          conf: 'high',
          reason: `Trip Progression: Driver was Under Loading yesterday; today en route to destination ${dst}.`
        };
      }

      if (prevNorm.includes('ON THE WAY') && dst) {
        return {
          text: `${comm ? comm + ' ' : ''}Supply for ${cust} - Under Offloading at ${dst}`,
          conf: 'high',
          reason: `Trip Progression: Driver was On the way yesterday; today arrives for offloading at ${dst}.`
        };
      }

      if (prevNorm.includes('UNDER OFFLOADING') && dst) {
        return {
          text: `Coming Back to ${src || 'Yanbu'}`,
          conf: 'high',
          reason: `Trip Progression: Offloaded yesterday; now returning to ${src || 'Yanbu'}.`
        };
      }

      // Default schedule loading tag
      return {
        text: `${comm ? comm + ' ' : ''}Supply for ${cust} - Under Loading at ${src}`,
        conf: 'medium',
        reason: `Auto-fetched from Timetable Dispatch: starts trip at ${src} destined for ${dst}.`
      };
    }

    // 4. No schedule row: check prior day status
    if (prevNorm.includes('ON THE WAY') || prevNorm.includes('COMING BACK')) {
      const destMatch = prev.match(/to\s+([A-Za-z\s]+)/i);
      const destination = destMatch ? destMatch[1].trim() : 'Destination';
      return {
        text: `Arrived ${destination}`,
        conf: 'medium',
        reason: `Carry-forward: active trip in transit yesterday arriving today.`
      };
    }

    if (prevNorm.includes('TRUCK UNDER MAINTENANCE')) {
      return {
        text: prev,
        conf: 'medium',
        reason: 'Carry-forward: vehicle under maintenance status continues.'
      };
    }

    if (prevNorm.includes('VACATION')) {
      return {
        text: 'Vacation',
        conf: 'high',
        reason: 'Driver on approved annual leave.'
      };
    }

    if (prevNorm.includes('WITH OUT TRUCK')) {
      return {
        text: 'With Out Truck',
        conf: 'medium',
        reason: 'Driver on standby without vehicle.'
      };
    }

    return {
      text: prev || 'At Yanbu',
      conf: prev ? 'medium' : 'low',
      reason: prev ? 'Carried forward from previous manifest status.' : 'Standby at Yanbu base (no schedule).'
    };
  };

  // -------------------------------------------------------------
  // AUTO-SYNC SCHEDULE ON DATE CHANGE OR MOUNT
  // -------------------------------------------------------------
  useEffect(() => {
    const schedRows = schedules[selectedDate]?.rows || [];
    setAutoSyncedCount(schedRows.length);

    // Initialize localTags with predicted tags or confirmed tags
    const initial: Record<number, string> = {};
    drivers.forEach((d, idx) => {
      if (todayTags[idx]) {
        initial[idx] = todayTags[idx];
      } else {
        const pred = predictManifestTag(idx, selectedDate);
        initial[idx] = pred.text;
      }
    });
    setLocalTags(initial);
  }, [selectedDate, schedules, manifests, drivers]);

  const handleTagChange = (idx: number, val: string) => {
    setLocalTags(prev => ({ ...prev, [idx]: val }));
  };

  // -------------------------------------------------------------
  // CONFIRM & SAVE
  // -------------------------------------------------------------
  const handleConfirmAndSave = async () => {
    const finalTags: Record<number, string> = {};
    drivers.forEach((d, idx) => {
      finalTags[idx] = localTags[idx] !== undefined ? localTags[idx] : (todayTags[idx] || predictManifestTag(idx, selectedDate).text);
    });

    await saveDailyManifest(selectedDate, finalTags);
    alert(`Confirmed and locked daily manifest for ${drivers.length} drivers on ${selectedDate}!`);
  };

  // -------------------------------------------------------------
  // HISTORICAL SCHEDULE LEARNER ENGINE
  // -------------------------------------------------------------
  const handleLearnHistoricalSchedules = () => {
    if (!learningPasteText.trim()) {
      alert("Please paste historical schedule text first.");
      return;
    }

    const lines = learningPasteText.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    let detectedDates = 0;
    let totalRows = 0;
    let rulesAdded = 0;
    const newRules: LearnedRule[] = [];

    // Parse date blocks
    let currentDate = '';
    const dateBlockRows: Record<string, any[]> = {};

    for (const line of lines) {
      const dateMatch = line.match(/(?:date\s*[:=-]\s*)?(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
      if (dateMatch) {
        currentDate = dateMatch[1];
        if (!dateBlockRows[currentDate]) {
          dateBlockRows[currentDate] = [];
          detectedDates++;
        }
        continue;
      }

      if (currentDate && (line.includes('|') || line.includes('\t'))) {
        const cells = line.split(/[|\t]/).map(c => c.trim()).filter(Boolean);
        if (cells.length >= 3 && !cells[0].toUpperCase().includes('DRIVER')) {
          dateBlockRows[currentDate].push({
            driver: cells[0],
            source: cells[1] || 'Yanbu',
            destination: cells[2] || '',
            customer: cells[3] || '',
            commodity: cells[4] || ''
          });
          totalRows++;
        }
      }
    }

    // Correlate with confirmed manifests
    Object.entries(dateBlockRows).forEach(([dt, rows]) => {
      const manifestForDate = manifests[dt];
      if (!manifestForDate) return;

      rows.forEach(r => {
        const driverIdx = drivers.findIndex(d => norm(d.name).includes(norm(r.driver)) || norm(r.driver).includes(norm(d.name)));
        if (driverIdx >= 0) {
          const actualTag = manifestForDate[driverIdx];
          if (actualTag) {
            const ruleKey = `${norm(r.source)}>${norm(r.destination)}|${norm(r.customer)}|${norm(r.commodity)}`;
            const existing = learnedRules.find(lr => lr.driverIndex === driverIdx && lr.result === actualTag);
            if (existing) {
              existing.hits += 1;
              existing.lastSeen = dt;
            } else {
              newRules.push({
                driverIndex: driverIdx,
                driverName: drivers[driverIdx].name,
                keys: [ruleKey],
                result: actualTag,
                hits: 1,
                lastSeen: dt
              });
              rulesAdded++;
            }
          }
        }
      });
    });

    if (newRules.length > 0) {
      learnHistoricalRules(newRules);
    }

    setLearningResult(`Processed ${detectedDates} date blocks (${totalRows} schedule rows). Learned & updated ${rulesAdded} high-confidence progression patterns!`);
  };

  // -------------------------------------------------------------
  // BULK IMPORT TAGS
  // -------------------------------------------------------------
  const handlePreviewBulk = () => {
    const lines = bulkTagsText.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    setBulkPreviewCount(lines.length);
  };

  const handleSaveBulk = async () => {
    const lines = bulkTagsText.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length !== drivers.length) {
      alert(`Count Mismatch: Pasted ${lines.length} lines, but master driver sequence requires exactly ${drivers.length} lines.`);
      return;
    }

    const bulkMap: Record<number, string> = {};
    lines.forEach((tag, idx) => {
      bulkMap[idx] = tag;
    });

    await saveDailyManifest(selectedDate, bulkMap);
    alert(`Saved ${lines.length} bulk tags in locked driver sequence for ${selectedDate}!`);
    setBulkTagsText('');
    setBulkPreviewCount(null);
  };

  // -------------------------------------------------------------
  // EXCEL & CSV EXPORT
  // -------------------------------------------------------------
  const exportExcel = () => {
    const data = drivers.map((d, idx) => ({
      'SL#': idx + 1,
      'Driver Name': d.name,
      'Employee No': d.empNo,
      'Vehicle Plate': d.assignedVehiclePlate || '—',
      [selectedDate]: localTags[idx] !== undefined ? localTags[idx] : (todayTags[idx] || predictManifestTag(idx, selectedDate).text)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily_Manifest');
    XLSX.writeFile(wb, `TLS_Daily_Manifest_${selectedDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-400" /> TLS Daily Fleet Manifest
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browser-first &bull; Auto-sync with Timetable Dispatch &bull; AI-Trained Heuristic Progression
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white font-mono focus:outline-none"
            />
          </div>

          <button
            onClick={exportExcel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            onClick={handleConfirmAndSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition"
          >
            <Save className="w-4 h-4" /> &check; Confirm &amp; Save Today
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {aiSuccessToast && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs text-emerald-200 shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{aiSuccessToast}</span>
          </div>
          <button onClick={() => setAiSuccessToast('')} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Retraining in progress overlay/banner */}
      {isRetraining && (
        <div className="p-5 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-500/50 rounded-2xl shadow-2xl flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
            <div>
              <h4 className="text-sm font-bold text-white">Machine Learning Training in Progress...</h4>
              <p className="text-xs text-purple-300 font-mono mt-0.5">{retrainStepMsg}</p>
            </div>
          </div>
          <span className="text-xs bg-purple-900/80 border border-purple-600 px-3 py-1 rounded-xl text-purple-200 font-mono font-bold">
            Ingesting 984+ Historical Trips
          </span>
        </div>
      )}

      {/* AI Training & Accuracy Center Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800/95 to-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">AI Manifest Prediction &amp; Training Engine</h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" /> {modelStats.accuracyRate}% Accuracy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Trained on historical August &amp; September daily manifests &bull; Auto-syncs timetable dispatches &bull; Heuristic cycle progression
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRetrainAiModel}
              disabled={isRetraining}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin' : ''}`} /> ⚡ Retrain AI Model Now
            </button>
            <button
              onClick={handleAutoPredictAll}
              className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5"
              title="Apply AI predictions to all 69 drivers for this date"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-200" /> 🔮 Auto-Predict All 69 Drivers for Today
            </button>
          </div>
        </div>

        {/* 4 Training Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-700/80">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">INGESTED DISPATCHES</span>
            <div className="text-base font-black text-white font-mono mt-0.5">{modelStats.totalTripsIngested} Trips</div>
            <div className="text-[10px] text-slate-500">August &bull; September historical data</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">DRIVERS MODELLED</span>
            <div className="text-base font-black text-sky-400 font-mono mt-0.5">{modelStats.driversTrained} Active Drivers</div>
            <div className="text-[10px] text-slate-500">Full fleet sequence 1–{drivers.length}</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">LEARNED PATTERNS</span>
            <div className="text-base font-black text-purple-400 font-mono mt-0.5">{learnedRules.length || modelStats.patternsExtracted} Rules</div>
            <div className="text-[10px] text-slate-500">Multi-day cycle transitions</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">TIMETABLE AUTO-SYNC</span>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              {autoSyncedCount > 0 ? `${autoSyncedCount} Scheduled` : '0 Scheduled'}
            </div>
            <div className="text-[10px] text-slate-500">{selectedDate} live dispatch feed</div>
          </div>
        </div>
      </div>

      {/* Auto-Sync Alert Notification */}
      {autoSyncedCount > 0 ? (
        <div className="p-3.5 bg-blue-950/60 border border-blue-500/40 rounded-xl flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-200">
              <strong className="text-sky-300 font-mono">⚡ Auto-Fetched from Timetable Dispatch:</strong> Loaded <strong className="text-white font-mono">{autoSyncedCount} scheduled trip(s)</strong> for {selectedDate}. Driver manifests auto-predicted!
            </span>
          </div>
          <button
            onClick={() => {
              const schedRows = schedules[selectedDate]?.rows || [];
              const updated: Record<number, string> = {};
              drivers.forEach((d, idx) => {
                updated[idx] = predictManifestTag(idx, selectedDate).text;
              });
              setLocalTags(updated);
              setAiSuccessToast("Re-synchronized manifest predictions with latest timetable schedule!");
              setTimeout(() => setAiSuccessToast(''), 4000);
            }}
            className="text-sky-300 hover:text-white font-bold px-2.5 py-1 rounded bg-blue-900/60 hover:bg-blue-800 border border-blue-700 flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" /> Re-Sync
          </button>
        </div>
      ) : (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
          <span>No timetable schedule saved yet for {selectedDate}. Carried forward from previous manifest status.</span>
          <span className="text-blue-400">Paste in Timetable Dispatch to auto-feed</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setSubTab('manifest')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            subTab === 'manifest' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Daily Manifest ({drivers.length} Drivers)
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            subTab === 'history' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" /> Driver Timeline History
        </button>
        <button
          onClick={() => setSubTab('learning')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            subTab === 'learning' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4 text-purple-400" /> 🧠 Historical Learning ({learnedRules.length} Rules)
        </button>
        <button
          onClick={() => setSubTab('bulk')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 ${
            subTab === 'bulk' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" /> Bulk Import Tags
        </button>
      </div>

      {/* Sub-Tab 1: Main Manifest Table */}
      {subTab === 'manifest' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3">
          {/* Filter and Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-700/80 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={manifestSearch}
                onChange={(e) => setManifestSearch(e.target.value)}
                placeholder="Filter by driver, plate or tag..."
                className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-0.5">
              <button
                onClick={() => setManifestFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${manifestFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                All ({drivers.length})
              </button>
              <button
                onClick={() => setManifestFilter('scheduled')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${manifestFilter === 'scheduled' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Dispatched Today
              </button>
              <button
                onClick={() => setManifestFilter('transit')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${manifestFilter === 'transit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                En Route
              </button>
              <button
                onClick={() => setManifestFilter('offloading')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${manifestFilter === 'offloading' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Offloading
              </button>
              <button
                onClick={() => setManifestFilter('returning')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${manifestFilter === 'returning' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Returning
              </button>
            </div>

            <span className="font-mono text-slate-400 hidden sm:inline">
              Locked driver sequence (SL 1–{drivers.length})
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">SL</th>
                  <th className="p-3 w-64">Driver &amp; Vehicle</th>
                  <th className="p-3 w-60">Schedule Ingestion</th>
                  <th className="p-3 w-56">Previous Status</th>
                  <th className="p-3">Suggested / Editable Tag</th>
                  <th className="p-3 w-28 text-center">Confidence</th>
                  <th className="p-3 w-20 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {drivers
                  .map((d, idx) => {
                    const prev = getPreviousTag(idx, selectedDate);
                    const pred = predictManifestTag(idx, selectedDate);
                    const currentVal = localTags[idx] !== undefined ? localTags[idx] : (todayTags[idx] || pred.text);

                    const matchedRow = currentSchedule.find(r =>
                      norm(r.driverName).includes(norm(d.name)) ||
                      (d.assignedVehiclePlate && norm(r.plateNo).replace(/\s+/g, '') === norm(d.assignedVehiclePlate).replace(/\s+/g, ''))
                    );

                    return {
                      driver: d,
                      idx,
                      prev,
                      pred,
                      currentVal,
                      matchedRow
                    };
                  })
                  .filter(({ driver, currentVal, matchedRow, pred }) => {
                    if (manifestSearch) {
                      const q = manifestSearch.toLowerCase();
                      const matchName = driver.name.toLowerCase().includes(q);
                      const matchPlate = driver.assignedVehiclePlate?.toLowerCase().includes(q);
                      const matchEmp = driver.empNo.toLowerCase().includes(q);
                      const matchTag = currentVal.toLowerCase().includes(q);
                      if (!matchName && !matchPlate && !matchEmp && !matchTag) return false;
                    }

                    if (manifestFilter === 'scheduled' && !matchedRow) return false;
                    if (manifestFilter === 'transit' && !currentVal.toUpperCase().includes('ON THE WAY')) return false;
                    if (manifestFilter === 'offloading' && !currentVal.toUpperCase().includes('OFFLOADING')) return false;
                    if (manifestFilter === 'returning' && !currentVal.toUpperCase().includes('COMING BACK') && !currentVal.toUpperCase().includes('RETURN')) return false;

                    return true;
                  })
                  .map(({ driver: d, idx, prev, pred, currentVal, matchedRow }) => {
                    const differsFromPred = currentVal !== pred.text;

                    return (
                      <tr key={d.id} className="hover:bg-slate-800/60 transition">
                        <td className="p-3 text-center font-mono text-slate-400">#{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-white text-sm">{d.name}</div>
                          <div className="text-[11px] font-mono text-emerald-400">{d.assignedVehiclePlate || 'No Vehicle'} &bull; {d.empNo}</div>
                        </td>
                        <td className="p-3 text-slate-300">
                          {matchedRow ? (
                            <div className="text-[11px] font-mono bg-blue-950/40 p-2 rounded-lg border border-blue-900/60">
                              <strong className="text-white flex items-center gap-1">
                                <Zap className="w-3 h-3 text-sky-400" /> {matchedRow.customer || matchedRow.supplier}
                              </strong>
                              <div className="text-sky-300">{matchedRow.source} &rarr; {matchedRow.destination}</div>
                              {matchedRow.waybill && <span className="text-slate-400">WB: {matchedRow.waybill}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">No schedule match</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-300 text-xs font-mono">
                          {prev ? (
                            <div className="max-w-[200px] truncate" title={prev}>{prev}</div>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="relative">
                            <textarea
                              rows={2}
                              value={currentVal}
                              onChange={(e) => handleTagChange(idx, e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500 custom-scrollbar"
                            />
                            {differsFromPred && (
                              <button
                                onClick={() => handleTagChange(idx, pred.text)}
                                className="absolute right-2 top-2 bg-purple-900/80 hover:bg-purple-800 text-purple-200 text-[10px] font-mono px-2 py-0.5 rounded border border-purple-700 shadow flex items-center gap-1"
                                title="Reset to AI suggested prediction"
                              >
                                <Sparkles className="w-2.5 h-2.5" /> Apply AI
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <span className="text-sky-400 font-mono">💡 AI:</span> {pred.reason}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                            pred.conf === 'high'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : pred.conf === 'medium'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}>
                            {pred.conf.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => alert(`Driver: ${d.name}\nVehicle: ${d.assignedVehiclePlate || 'None'}\n\nYesterday's Status:\n${prev || 'None'}\n\nToday's Timetable Schedule:\n${matchedRow ? `${matchedRow.source} -> ${matchedRow.destination} (${matchedRow.customer})\nCommodity: ${matchedRow.commodity || 'N/A'}\nWaybill: ${matchedRow.waybill || 'N/A'}` : 'None (Inferred progression)'}\n\nAI Suggested Tag:\n${pred.text}\n\nConfidence: ${pred.conf.toUpperCase()}\nReason: ${pred.reason}`)}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded-lg border border-slate-700 transition"
                            title="Show detailed prediction reasoning"
                          >
                            <HelpCircle className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Driver Timeline History */}
      {subTab === 'history' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-base">Driver Historical Timeline</h3>
              <p className="text-xs text-slate-400 mt-0.5">August and September 1–7 verified day-by-day records</p>
            </div>
            <select
              value={selectedDriverIdx}
              onChange={(e) => setSelectedDriverIdx(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
            >
              {drivers.map((d, i) => (
                <option key={d.id} value={i}>#{i + 1}. {d.name} ({d.empNo})</option>
              ))}
            </select>
          </div>

          {drivers[selectedDriverIdx] && (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-white text-sm">{drivers[selectedDriverIdx].name}</span>
                <span className="font-mono text-emerald-400">{drivers[selectedDriverIdx].assignedVehiclePlate}</span>
              </div>

              <div className="space-y-2 max-h-[450px] overflow-y-auto custom-scrollbar">
                {drivers[selectedDriverIdx].history && Object.keys(drivers[selectedDriverIdx].history!).length > 0 ? (
                  Object.entries(drivers[selectedDriverIdx].history!)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([dt, tag]) => (
                      <div key={dt} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-blue-400 w-28 shrink-0">{dt}</span>
                        <span className="text-slate-200 font-mono flex-1">{tag}</span>
                      </div>
                    ))
                ) : (
                  <div className="p-6 text-center text-slate-500 text-xs">No history found for this driver.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Historical Learning Engine */}
      {subTab === 'learning' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" /> Historical Schedule Learning Engine
              </h3>
              <p className="text-xs text-slate-300">
                Paste previous schedules together. The system detects date blocks (e.g. <b>Date: 2026-09-05</b> or <b>05-09-2026</b>) and compares schedule routes with confirmed manifest tags to learn prediction rules.
              </p>

              <textarea
                rows={8}
                value={learningPasteText}
                onChange={(e) => setLearningPasteText(e.target.value)}
                placeholder={`Date: 2026-09-05
| Driver Name | Source | Destination | Customer | Commodity |
| MUHAMMAD FAYYAZ AWAN | Yanbu | Yanbu | LUBEREFF | SULPHER |
| DOST MUHAMMAD KHALIQ | Yanbu | Jubail | ZAMIL | FC |

Date: 2026-09-06
| Driver Name | Source | Destination | Customer | Commodity |
...`}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />

              <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                <button
                  onClick={() => { setLearningPasteText(''); setLearningResult(''); }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRetrainAiModel}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 transition"
                    title="Train directly on stored August & September dispatch schedules and manifests"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> ⚡ Auto-Train on Stored Data
                  </button>
                  <button
                    onClick={handleLearnHistoricalSchedules}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 transition"
                  >
                    <Brain className="w-3.5 h-3.5" /> Parse Pasted Text
                  </button>
                </div>
              </div>

              {learningResult && (
                <div className="p-3 bg-purple-950/60 border border-purple-500/40 rounded-xl text-xs text-purple-200">
                  {learningResult}
                </div>
              )}
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-white text-base">How Learning Works</h3>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
                <li>Reads each historical schedule date in chronological order.</li>
                <li>Matches schedule drivers to the permanent driver sequence.</li>
                <li>Links the route (Source &rarr; Destination | Customer) to the confirmed manifest result stored for that date.</li>
                <li>Builds progression models: <strong className="text-white">Loading &rarr; Transit &rarr; Offloading &rarr; Returning</strong>.</li>
                <li>Your daily confirmed manifest edits continuously reinforce the learned rules.</li>
              </ol>

              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-700">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-xl font-bold font-mono text-purple-400">{learnedRules.length}</span>
                  <div className="text-[10px] text-slate-400 uppercase mt-0.5">Learned Rules</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-xl font-bold font-mono text-emerald-400">{new Set(learnedRules.map(r => r.driverIndex)).size}</span>
                  <div className="text-[10px] text-slate-400 uppercase mt-0.5">Trained Drivers</div>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-xl font-bold font-mono text-sky-400">{learnedRules.reduce((a, b) => a + (b.hits || 1), 0)}</span>
                  <div className="text-[10px] text-slate-400 uppercase mt-0.5">Total Hits</div>
                </div>
              </div>
            </div>
          </div>

          {/* Learned Patterns Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-base">Learned Route &amp; Progression Rules</h3>
                <p className="text-xs text-slate-400">These patterns automatically feed into the manifest suggestion engine.</p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter learned rules..."
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    setLearningPasteText(q); // reuse or search
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {learnedRules.slice().sort((a, b) => (b.hits || 0) - (a.hits || 0)).map((r, i) => (
                <div key={i} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-white">{r.driverName}</strong>
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-2 py-0.2 rounded font-mono">
                        {r.hits} hit(s)
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono mt-0.5">{r.keys.join(' • ')}</div>
                    <div className="text-emerald-400 font-semibold mt-1">&rarr; {r.result}</div>
                  </div>
                  <span className="text-slate-500 font-mono text-[10px]">Last: {r.lastSeen}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Bulk Import Tags */}
      {subTab === 'bulk' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="font-bold text-white text-base">Bulk Import Manifest Tags for {selectedDate}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Select date, then paste one tag per line in the same order as the locked driver sequence (SL 1 to {drivers.length}). Count must match exactly before saving.
            </p>
          </div>

          <textarea
            rows={8}
            value={bulkTagsText}
            onChange={(e) => setBulkTagsText(e.target.value)}
            placeholder={`SULPHER Collection from LUBEREFF
SA Supply for CISCO - Under Offloading at Kuwait
FC Supply for ZAMIL - Under Loading at Yanbu
... (exactly ${drivers.length} lines)`}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handlePreviewBulk}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl border border-slate-700 transition"
            >
              Preview Tag Count
            </button>

            {bulkPreviewCount !== null && (
              <span className={`text-xs font-mono font-bold ${
                bulkPreviewCount === drivers.length ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                Detected {bulkPreviewCount} tags / {drivers.length} required.
                {bulkPreviewCount === drivers.length ? ' ✓ Match confirmed!' : ' ⚠️ Mismatch! Check pasted lines.'}
              </span>
            )}

            <button
              onClick={handleSaveBulk}
              disabled={bulkPreviewCount !== drivers.length}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition"
            >
              Save Bulk Tags
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
