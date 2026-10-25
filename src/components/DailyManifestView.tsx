import React, { useState, useEffect, useMemo } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { ManifestSuggestion, LearnedRule } from '../types';
import { ksaDateISO, shiftISODate } from '../utils/dateUtils';
import {
  trainManifestAiModel, getManifestModelStats, ModelTrainingStats,
  predictManifestForDriver
} from '../utils/manifestAiEngine';
import {
  parseMultiDayManifest, SAMPLE_OCTOBER_1_4_MANIFEST_TEXT, MultiDayParseResult
} from '../utils/multiDayManifestParser';
import * as XLSX from 'xlsx';
import {
  ClipboardList, Brain, Calendar, Save, Download, FileText,
  HelpCircle, CheckCircle2, Clock, Upload, Search, RefreshCw,
  Sparkles, Zap, ArrowRight, ShieldCheck, Check, Filter, TrendingUp, AlertCircle,
  FileSpreadsheet, Database, Layers, ArrowDown
} from 'lucide-react';

// -------------------------------------------------------------
// HELPER FUNCTIONS (Declared at module scope to avoid TDZ / hoisting issues)
// -------------------------------------------------------------
function norm(s: string): string {
  return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function shiftDateStr(dateStr: string, deltaDays: number): string {
  return shiftISODate(dateStr, deltaDays);
}

function localTodayISO(): string {
  return ksaDateISO();
}


export const DailyManifestView: React.FC = () => {
  const {
    drivers, manifests, schedules, saveDailyManifest, saveMultiDayManifests,
    learnedRules, learnHistoricalRules
  } = useLms();

  const { isDispatcher, isAdmin } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => localTodayISO());
  // Archived drivers remain available for historical dates, but never enter a new/current manifest.
  const operationalDrivers = useMemo(() => selectedDate < localTodayISO() ? drivers : drivers.filter(driver => driver.active !== false), [selectedDate, drivers]);
  const [subTab, setSubTab] = useState<'manifest' | 'history' | 'learning' | 'bulk' | 'paste-multi'>('manifest');
  const [selectedDriverIdx, setSelectedDriverIdx] = useState(0);

  // Bulk Import state
  const [bulkTagsText, setBulkTagsText] = useState('');
  const [bulkPreviewCount, setBulkPreviewCount] = useState<number | null>(null);

  // Multi-day manifest direct paste state
  const [multiPasteText, setMultiPasteText] = useState('');
  const [multiPasteMonth, setMultiPasteMonth] = useState('2026-10');
  const [parsedMultiResult, setParsedMultiResult] = useState<MultiDayParseResult | null>(null);
  const [isSyncingMulti, setIsSyncingMulti] = useState(false);

  // Schedule paste state for historical learning
  const [learningPasteText, setLearningPasteText] = useState('');
  const [learningResult, setLearningResult] = useState('');

  // AI Training Center state
  const [modelStats, setModelStats] = useState<ModelTrainingStats>(() => getManifestModelStats());
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainStepMsg, setRetrainStepMsg] = useState('');
  // Notification & Feedback Banner state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Inspector modal for driver prediction reasoning
  const [inspectModal, setInspectModal] = useState<{
    driver: any;
    pred: ManifestSuggestion;
    prev: string;
    matchedRow: any;
    sl: number;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 6000);
  };

  // Search and filters for Manifest Table
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestFilter, setManifestFilter] = useState<'all' | 'scheduled' | 'transit' | 'offloading' | 'returning'>('all');

  // Editable tags for currently selected date
  const [localTags, setLocalTags] = useState<Record<string, string>>({});
  const [autoSyncedCount, setAutoSyncedCount] = useState<number>(0);

  const todayTags = manifests[selectedDate] || {};
  const currentSchedule = schedules[selectedDate]?.rows || [];
  const getDriverTag = (tags: Record<string, string>, driverId: string, driverIdx: number) => tags[driverId] ?? '';

  // Identify temporary / 1-day rental drivers in today's schedule who are NOT in the 64 master fleet sequence
  const temporaryRentScheduleDrivers = React.useMemo(() => {
    const map = new Map<string, { driverName: string; customer?: string; destination?: string; commodity?: string }>();
    currentSchedule.forEach(r => {
      if (!r.driverName) return;
      const rName = r.driverName.trim();
      const isMaster = drivers.some(d => {
        const dNorm = norm(d.name);
        const check = norm(rName);
        return dNorm === check || dNorm.includes(check) || check.includes(dNorm);
      });
      if (!isMaster) {
        if (!map.has(rName)) {
          map.set(rName, {
            driverName: rName,
            customer: r.customer || r.supplier || 'Plant',
            destination: r.destination || 'KSA',
            commodity: r.commodity || 'Freight'
          });
        }
      }
    });
    return Array.from(map.values());
  }, [currentSchedule, drivers]);

  // -------------------------------------------------------------
  // AI TRAINING & RETRAINING ENGINE
  // -------------------------------------------------------------
  const handleRetrainAiModel = async () => {
    setIsRetraining(true);
    setRetrainStepMsg('Analyzing available driver histories, manifests, and timetable records…');
    // Yield once so the working state renders; progress is not simulated.
    await new Promise(resolve => setTimeout(resolve, 0));
    try {
      const result = trainManifestAiModel(drivers, schedules, manifests, learnedRules);
      await learnHistoricalRules(result.rules);
      setModelStats(result.stats);
      showToast('Model refreshed from ' + result.stats.totalTripsIngested + ' distinct recorded driver/date/status observations. Accuracy remains unmeasured without a separate validation set.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? 'Model training failed: ' + error.message : 'Model training failed.', 'error');
    } finally {
      setIsRetraining(false);
      setRetrainStepMsg('');
    }
  };

  const handleAutoPredictAll = () => {
    const updated: Record<string, string> = {};
    operationalDrivers.forEach(driver => {
      const idx = drivers.findIndex(item => item.id === driver.id);
      updated[driver.id] = predictManifestTag(idx, selectedDate).text;
    });
    setLocalTags(updated);
    showToast('Generated heuristic suggestions for ' + operationalDrivers.length + ' drivers on ' + selectedDate + '. Review suggestions before confirming the manifest.', 'info');
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
      if (manifests[lastDate]) {
        const tag = getDriverTag(manifests[lastDate], d.id, driverIdx);
        if (tag) return tag;
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

    const confirmed = manifests[date]?.[d.id] || manifests[date]?.[String(driverIdx)];
    const prev = getPreviousTag(driverIdx, date);
    const daySchedule = schedules[date]?.rows || [];

    return predictManifestForDriver(
      driverIdx,
      d,
      date,
      daySchedule,
      prev,
      learnedRules,
      confirmed
    );
  };

  // -------------------------------------------------------------
  // MULTI-DAY PREVIOUS MANIFEST INGESTION HANDLERS
  // -------------------------------------------------------------
  const handleParseMulti = (customText?: string) => {
    const textToUse = customText !== undefined ? customText : multiPasteText;
    if (!textToUse.trim()) {
      showToast("Please paste the previous daily manifest sheet text first.", 'error');
      return;
    }

    const res = parseMultiDayManifest(textToUse, drivers, multiPasteMonth);
    setParsedMultiResult(res);
  };

  const handleLoadSampleMulti = () => {
    setMultiPasteText(SAMPLE_OCTOBER_1_4_MANIFEST_TEXT);
    setMultiPasteMonth('2026-10');
    handleParseMulti(SAMPLE_OCTOBER_1_4_MANIFEST_TEXT);
  };

  const handleApplyMultiSync = async () => {
    if (!parsedMultiResult || !parsedMultiResult.mappedDriversCount) return;
    setIsSyncingMulti(true);
    try {
      await saveMultiDayManifests(parsedMultiResult.manifestByDate);
      const retrain = trainManifestAiModel(drivers, schedules, manifests, learnedRules);
      await learnHistoricalRules(retrain.rules);
      setModelStats(retrain.stats);
      showToast(
        'Synchronized ' + parsedMultiResult.totalEntriesCount + ' manifest tags across ' + parsedMultiResult.detectedDates.length + ' dates. Accuracy remains unmeasured until an independent validation set is available.',
        'success'
      );
      setSelectedDate(localTodayISO());
      setSubTab('manifest');
    } catch (error) {
      showToast(error instanceof Error ? 'Multi-day manifest sync failed: ' + error.message : 'Multi-day manifest sync failed. Check the connection and retry after verifying the saved dates.', 'error');
    } finally {
      setIsSyncingMulti(false);
    }
  };

  // -------------------------------------------------------------
  // AUTO-SYNC SCHEDULE ON DATE CHANGE OR MOUNT
  // -------------------------------------------------------------
  useEffect(() => {
    const schedRows = schedules[selectedDate]?.rows || [];
    setAutoSyncedCount(schedRows.length);

    // Initialize localTags with predicted tags or confirmed tags
    const initial: Record<string, string> = {};
    operationalDrivers.forEach(driver => {
      const idx = drivers.findIndex(item => item.id === driver.id);
      const existing = getDriverTag(todayTags, driver.id, idx);
      initial[driver.id] = existing || predictManifestTag(idx, selectedDate).text;
    });
    setLocalTags(initial);
  }, [selectedDate, schedules, manifests, drivers, operationalDrivers]);

  const handleTagChange = (driverId: string, val: string) => {
    setLocalTags(prev => ({ ...prev, [driverId]: val }));
  };

  // -------------------------------------------------------------
  // CONFIRM & SAVE
  // -------------------------------------------------------------
  const handleConfirmAndSave = async () => {
    const finalTags: Record<string, string> = {};
    operationalDrivers.forEach(driver => {
      const idx = drivers.findIndex(item => item.id === driver.id);
      finalTags[driver.id] = localTags[driver.id] !== undefined ? localTags[driver.id] :
        (getDriverTag(todayTags, driver.id, idx) || predictManifestTag(idx, selectedDate).text);
    });
    try {
      await saveDailyManifest(selectedDate, finalTags);
      showToast('Confirmed and saved the manifest for ' + operationalDrivers.length + ' drivers on ' + selectedDate + '.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? 'Manifest was not saved: ' + error.message : 'Manifest was not saved. Check the connection and permissions.', 'error');
    }
  };

  // -------------------------------------------------------------
  // HISTORICAL SCHEDULE LEARNER ENGINE
  // -------------------------------------------------------------
  const handleLearnHistoricalSchedules = async () => {
    if (!learningPasteText.trim()) {
      showToast("Please paste historical schedule text first.", 'error');
      return;
    }

    const lines = learningPasteText.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    let detectedDates = 0;
    let totalRows = 0;
    let rulesAdded = 0;
    const stagedRules = new Map<string, LearnedRule>();

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
          const actualTag = manifestForDate[drivers[driverIdx].id] || manifestForDate[String(driverIdx)];
          if (actualTag) {
            const ruleKey = `${norm(r.source)}>${norm(r.destination)}|${norm(r.customer)}|${norm(r.commodity)}`;
            const driver = drivers[driverIdx];
            const stableRuleKey = `${driver.id}__${actualTag}`;
            const existing = stagedRules.get(stableRuleKey) ||
              learnedRules.find(rule => (rule.driverId ? rule.driverId === driver.id : rule.driverIndex === driverIdx) && rule.result === actualTag);
            stagedRules.set(stableRuleKey, {
              driverId: driver.id,
              driverIndex: driverIdx,
              driverName: driver.name,
              keys: Array.from(new Set([...(existing?.keys || []), ruleKey])),
              result: actualTag,
              hits: (existing?.hits || 0) + 1,
              lastSeen: !existing || dt > existing.lastSeen ? dt : existing.lastSeen
            });
            if (!existing) rulesAdded++;
          }
        }
      });
    });

    const newRules = Array.from(stagedRules.values());
    if (newRules.length > 0) await learnHistoricalRules(newRules);

    setLearningResult(`Processed ${detectedDates} date blocks (${totalRows} schedule rows). Persisted ${newRules.length} stable-driver route rules (${rulesAdded} new patterns).`);
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
    if (lines.length !== operationalDrivers.length) {
      showToast(`Count Mismatch: Pasted ${lines.length} lines, but the driver sequence for ${selectedDate} requires exactly ${operationalDrivers.length} lines.`, 'error');
      return;
    }

    const bulkMap: Record<string, string> = {};
    lines.forEach((tag, idx) => { if (operationalDrivers[idx]) bulkMap[operationalDrivers[idx].id] = tag; });

    try {
      await saveDailyManifest(selectedDate, bulkMap);
      showToast('Saved ' + lines.length + ' bulk tags in the driver sequence for ' + selectedDate + '.', 'success');
      setBulkTagsText('');
      setBulkPreviewCount(null);
    } catch (error) {
      showToast(error instanceof Error ? 'Bulk manifest was not saved: ' + error.message : 'Bulk manifest was not saved. Verify the data and retry.', 'error');
    }
  };

  // -------------------------------------------------------------
  // EXCEL & CSV EXPORT
  // -------------------------------------------------------------
  const exportExcel = () => {
    const data = operationalDrivers.map(driver => {
      const idx = drivers.findIndex(item => item.id === driver.id);
      return {
        'SL#': driver.seq || idx + 1,
        'Driver Name': driver.name,
        'Employee No': driver.empNo,
        'Vehicle Plate': driver.assignedVehiclePlate || '—',
        [selectedDate]: localTags[driver.id] !== undefined ? localTags[driver.id] : (getDriverTag(todayTags, driver.id, idx) || predictManifestTag(idx, selectedDate).text)
      };
    });

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
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2 py-1">
            <button
              onClick={() => setSelectedDate(shiftDateStr(selectedDate, -1))}
              title="Previous Day"
              className="p-1 hover:bg-slate-700 text-slate-300 rounded font-bold transition text-xs cursor-pointer"
            >
              ◀
            </button>
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
            />
            <button
              onClick={() => setSelectedDate(shiftDateStr(selectedDate, 1))}
              title="Next Day"
              className="p-1 hover:bg-slate-700 text-slate-300 rounded font-bold transition text-xs cursor-pointer"
            >
              ▶
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-900 border border-slate-700/80 p-1 rounded-xl text-[11px] font-mono">
            {Array.from({ length: 7 }, (_, index) => {
              const dt = shiftDateStr(localTodayISO(), index - 3);
              const dayDate = new Date(`${dt}T12:00:00`);
              const label = `${Number(dt.slice(8))} ${dayDate.toLocaleDateString('en-US', { weekday: 'short' })}${dt === localTodayISO() ? ' Today' : ''}`;
              return { dt, label };
            }).map(({ dt, label }) => {
              const isSelected = selectedDate === dt;
              const hasData = manifests[dt] && Object.keys(manifests[dt]).length > 0;
              const hasSchedule = schedules[dt] && schedules[dt].rows && schedules[dt].rows.length > 0;
              return (
                <button
                  key={dt}
                  onClick={() => setSelectedDate(dt)}
                  className={`px-2 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`${label}: ${hasData ? `${Object.keys(manifests[dt]).length} manifests` : '0 manifests'}, ${hasSchedule ? `${schedules[dt].rows.length} scheduled trips` : '0 scheduled trips'}`}
                >
                  {label}
                  {hasData && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`}></span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={exportExcel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            onClick={handleConfirmAndSave}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Check className="w-4 h-4" /> Confirm & Save Today
          </button>
        </div>
      </div>

      {/* Dynamic In-App Notification Toast */}
      {notification && (
        <div className={`p-3.5 border rounded-2xl flex items-center justify-between text-xs shadow-xl animate-fade-in ${
          notification.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
            : notification.type === 'info'
            ? 'bg-sky-950/90 border-sky-500/60 text-sky-200'
            : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : notification.type === 'info' ? (
              <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white font-bold ml-2 cursor-pointer">✕</button>
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
            Historical manifest learning
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
                <span className="bg-slate-700/70 text-slate-300 border border-slate-600 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-slate-400" /> Accuracy not measured
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Learns patterns from available manifest history &bull; Auto-syncs timetable dispatches &bull; Heuristic cycle progression
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
              className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              title={`Apply heuristic suggestions to all ${operationalDrivers.length} drivers for ${selectedDate}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-200" /> 🔮 Auto-Predict All {operationalDrivers.length} Drivers for {selectedDate}
            </button>
          </div>
        </div>

        {/* 4 Training Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-700/80">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">INGESTED DISPATCHES</span>
            <div className="text-base font-black text-white font-mono mt-0.5">{modelStats.totalTripsIngested} Trips</div>
            <div className="text-[10px] text-slate-500">Available historical records</div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400">DRIVERS MODELLED</span>
            <div className="text-base font-black text-sky-400 font-mono mt-0.5">{operationalDrivers.length} Operational Drivers</div>
            <div className="text-[10px] text-slate-500">Archived drivers remain available on historical dates.</div>
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

      {/* 1-Day Rental / Temporary Drivers Exclusion Notice */}
      {temporaryRentScheduleDrivers.length > 0 && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-lg">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-amber-300">
                  {temporaryRentScheduleDrivers.length} Temporary / 1-Day Rental Driver(s) in Schedule
                </h4>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  Excluded from Manifest
                </span>
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5">
                Drivers on 1-day rental ({temporaryRentScheduleDrivers.map(d => d.driverName).join(', ')}) are scheduled for trips today but <strong>are not included in the permanent daily manifest</strong> as per fleet policy.
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-amber-300/80 bg-amber-900/30 px-3 py-1.5 rounded-xl border border-amber-500/30 shrink-0">
            Manifest sequence for {selectedDate}: {operationalDrivers.length} drivers
          </div>
        </div>
      )}

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
              const updated: Record<string, string> = {};
              operationalDrivers.forEach(driver => {
                const idx = drivers.findIndex(item => item.id === driver.id);
                updated[driver.id] = predictManifestTag(idx, selectedDate).text;
              });
              setLocalTags(updated);
              showToast("Re-synchronized manifest predictions with latest timetable schedule!", 'info');
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
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setSubTab('manifest')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            subTab === 'manifest' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Daily Manifest ({operationalDrivers.length} Drivers)
        </button>
        <button
          onClick={() => setSubTab('paste-multi')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            subTab === 'paste-multi'
              ? 'border-sky-500 text-white bg-sky-950/40 rounded-t-lg shadow-inner'
              : 'border-transparent text-sky-400/90 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-sky-400" /> 📋 Paste Multi-Day Manifest / Sync
        </button>
        <button
          onClick={() => setSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            subTab === 'history' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" /> Driver Timeline History
        </button>
        <button
          onClick={() => setSubTab('learning')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            subTab === 'learning' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4 text-purple-400" /> 🧠 Historical Learning ({learnedRules.length} Rules)
        </button>
        <button
          onClick={() => setSubTab('bulk')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
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
                All ({operationalDrivers.length})
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
              Driver sequence for {selectedDate}; master sequence numbers are preserved
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
                {operationalDrivers
                  .map((d) => {
                    const idx = drivers.findIndex(item => item.id === d.id);
                    const prev = getPreviousTag(idx, selectedDate);
                    const pred = predictManifestTag(idx, selectedDate);
                    const currentVal = localTags[d.id] !== undefined ? localTags[d.id] : (getDriverTag(todayTags, d.id, idx) || pred.text);

                    const matchedRow = currentSchedule.find(r => {
                      const rn = norm(r.driverName);
                      const dn = norm(d.name);
                      const nameMatch = rn && dn && (rn === dn || rn.includes(dn) || dn.includes(rn));
                      const plateMatch = Boolean(
                        d.assignedVehiclePlate &&
                        r.plateNo &&
                        norm(r.plateNo).replace(/\s+/g, '') === norm(d.assignedVehiclePlate).replace(/\s+/g, '')
                      );
                      return nameMatch || plateMatch;
                    });

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
                              onChange={(e) => handleTagChange(d.id, e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500 custom-scrollbar"
                            />
                            {differsFromPred && (
                              <button
                                onClick={() => handleTagChange(d.id, pred.text)}
                                className="absolute right-2 top-2 bg-purple-900/80 hover:bg-purple-800 text-purple-200 text-[10px] font-mono px-2 py-0.5 rounded border border-purple-700 shadow flex items-center gap-1 cursor-pointer"
                                title="Reset to AI suggested prediction"
                              >
                                <Sparkles className="w-2.5 h-2.5" /> Apply AI
                              </button>
                            )}
                          </div>
                          {/* Quick Status Chips */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {[
                              'At Yanbu',
                              'Under Loading at Yanbu',
                              'On the way to Riyadh',
                              'Under Offloading at Destination',
                              'Coming Back to Yanbu',
                              'Truck Under Maintenance',
                              'Standby at Base'
                            ].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleTagChange(d.id, preset)}
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition border ${
                                  currentVal === preset
                                    ? 'bg-blue-600 text-white border-blue-400 font-bold'
                                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                                }`}
                              >
                                {preset.replace(' at Destination', '').replace(' at Yanbu', '')}
                              </button>
                            ))}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
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
                            onClick={() => setInspectModal({ driver: d, pred, prev, matchedRow, sl: idx + 1 })}
                            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 rounded-lg border border-slate-700 transition cursor-pointer"
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
              <p className="text-xs text-slate-400 mt-0.5">Recorded day-by-day data available in this workspace</p>
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
                    title="Train on the available stored dispatch schedules and manifests"
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
              Select a date, then paste one tag per line in that date's driver sequence ({operationalDrivers.length} drivers). Past dates include archived drivers so historical records can be maintained.
            </p>
          </div>

          <textarea
            rows={8}
            value={bulkTagsText}
            onChange={(e) => setBulkTagsText(e.target.value)}
            placeholder={`SULPHER Collection from LUBEREFF
SA Supply for CISCO - Under Offloading at Kuwait
FC Supply for ZAMIL - Under Loading at Yanbu
... (exactly ${operationalDrivers.length} lines)`}
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
                bulkPreviewCount === operationalDrivers.length ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                Detected {bulkPreviewCount} tags / {operationalDrivers.length} required.
                {bulkPreviewCount === drivers.length ? ' ✓ Match confirmed!' : ' ⚠️ Mismatch! Check pasted lines.'}
              </span>
            )}

            <button
              onClick={handleSaveBulk}
              disabled={bulkPreviewCount !== operationalDrivers.length}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition"
            >
              Save Bulk Tags
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tab 5: Paste Multi-Day Manifest / Sync */}
      {subTab === 'paste-multi' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  Multi-Day Manifest Ingestion &amp; Sync Engine
                  <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    Multi-Date Auto-Aligner
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Paste multi-column daily manifests directly from your dispatch spreadsheet (with dates like Thursday 1, Friday 2, Saturday 3, Sunday 4). Automatically synchronizes historical records and trains the predictive suggestion engine for upcoming dispatches.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadSampleMulti}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                title="Populate with the 59-driver Oct 1–4 manifest provided in prompt"
              >
                <Layers className="w-3.5 h-3.5" /> 📥 Load Oct 1–4 Provided Sample (59 Drivers)
              </button>
            </div>
          </div>

          {/* Column Layout Instructions */}
          <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs space-y-1.5">
            <div className="text-slate-300 font-bold flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-400" /> Supported Spreadsheet Column Structure:
            </div>
            <div className="font-mono text-[11px] text-slate-400 overflow-x-auto whitespace-nowrap bg-slate-950 p-2 rounded-lg border border-slate-800">
              Driver Name &bull; Iqama # &bull; Nationality &bull; Contact Number &bull; Equipment# &bull; Transporter &bull; Vehicle Plate No &bull; Driver card &bull; Employee No. &bull; Working For &bull; <span className="text-sky-300 font-bold">Thursday, 1</span> &bull; <span className="text-sky-300 font-bold">Friday, 2</span> &bull; <span className="text-sky-300 font-bold">Saturday, 3</span> &bull; <span className="text-sky-300 font-bold">Sunday, 4</span> ...
            </div>
            <div className="text-[11px] text-slate-400">
              Matches drivers automatically by <strong className="text-white">Driver Name</strong>, <strong className="text-white">Iqama #</strong>, <strong className="text-white">Employee No</strong>, or <strong className="text-white">Vehicle Plate</strong>. Missing drivers or external transporters are highlighted.
            </div>
          </div>

          {/* Paste Input Area */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">Paste Spreadsheet Rows (TSV / Tab-Separated):</span>
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[10px] uppercase text-slate-400">Target Month:</span>
                  <input
                    type="month"
                    value={multiPasteMonth}
                    onChange={(e) => setMultiPasteMonth(e.target.value)}
                    className="bg-transparent text-white font-mono text-xs focus:outline-none"
                  />
                </div>
              </div>
              <span>{multiPasteText.length > 0 ? `${multiPasteText.split('\n').length} raw line(s)` : 'Awaiting input'}</span>
            </div>

            <textarea
              rows={9}
              value={multiPasteText}
              onChange={(e) => setMultiPasteText(e.target.value)}
              placeholder={`Driver Name\tIqama #\tNationality\tContact Number\tEquipment#\tTransporter\tVehicle Plate No\tDriver card\t\tEmployee No.\tWorking For\tThursday, 1 \tFriday, 2 \tSaturday, 3 \tSunday, 4 \nMUHAMMAD FAYYAZ AWAN\t2326626773\tPAKISTAN\t595343932\t401LSR18\tTLS\tأ ح د D J A 4829\t\t\tL-EMP0024\tYanbu - Local\tCS Supply for SWCC - Under Offloading at Yanbu\t Internal Transfer \tMOLTEN SULPHER Collection from LUBEREF\tMOLTEN SULPHER Collection from LUBEREF\n...`}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500 custom-scrollbar"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                onClick={() => {
                  setMultiPasteText('');
                  setParsedMultiResult(null);
                }}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                Clear Input
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleParseMulti()}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow"
                >
                  <Search className="w-3.5 h-3.5" /> 🔍 Parse Manifest Sheet
                </button>

                {parsedMultiResult && parsedMultiResult.mappedDriversCount > 0 && (
                  <button
                    onClick={handleApplyMultiSync}
                    disabled={isSyncingMulti}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs px-5 py-2 rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMulti ? 'animate-spin' : ''}`} />
                    ⚡ Sync Manifests to Database &amp; Suggest Today (Oct 5)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Parsing Results & Metrics */}
          {parsedMultiResult && (
            <div className="space-y-4 pt-2 border-t border-slate-700/80">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-mono uppercase text-slate-400">DETECTED DATES</span>
                  <div className="text-base font-black text-sky-400 font-mono mt-0.5">
                    {parsedMultiResult.detectedDates.length} Dates
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap gap-1">
                    {parsedMultiResult.detectedDates.map(d => (
                      <span key={d} className="bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.2 rounded font-mono text-[9px]">
                        {d.split('-').slice(1).join('/')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-mono uppercase text-slate-400">FLEET MATCH RATE</span>
                  <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                    {parsedMultiResult.mappedDriversCount} / {drivers.length} Drivers
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {Math.round((parsedMultiResult.mappedDriversCount / drivers.length) * 100)}% fleet coverage
                  </div>
                </div>

                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-mono uppercase text-slate-400">TOTAL STATUS READINGS</span>
                  <div className="text-base font-black text-purple-400 font-mono mt-0.5">
                    {parsedMultiResult.totalEntriesCount} Status Tags
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Multi-day journey logs
                  </div>
                </div>

                <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-mono uppercase text-slate-400">AI SUGGESTION READY</span>
                  <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                    Monday Oct 5
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Infers cycle from Sunday 4
                  </div>
                </div>
              </div>

              {/* Action Banner to Sync */}
              <div className="p-4 bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 border border-sky-500/50 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Manifest Sheet Validated &amp; Ready for Synchronization
                  </h4>
                  <p className="text-xs text-sky-200 mt-0.5">
                    Clicking sync updates manifests for <strong>{parsedMultiResult.detectedDates.join(', ')}</strong>, saves each driver&apos;s history timeline, retrains the progression engine, and immediately generates high-confidence predictions for <strong>{selectedDate}</strong>.
                  </p>
                </div>
                <button
                  onClick={handleApplyMultiSync}
                  disabled={isSyncingMulti}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingMulti ? 'animate-spin' : ''}`} />
                  ⚡ Sync Manifests to Database &amp; Suggest Today (Oct 5)
                </button>
              </div>

              {/* Multi-Date Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
                    Parsed Driver Manifest Preview ({parsedMultiResult.entries.length} Drivers)
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Scroll horizontally to view all daily status columns
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[500px] border border-slate-700/80 rounded-xl custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                      <tr>
                        <th className="p-2.5 w-10 text-center">#</th>
                        <th className="p-2.5 min-w-[200px]">Driver Details</th>
                        <th className="p-2.5 min-w-[130px]">Plate / Iqama</th>
                        <th className="p-2.5 min-w-[90px]">Emp No</th>
                        {parsedMultiResult.detectedDates.map(dateKey => {
                          const [y, m, d] = dateKey.split('-');
                          const dayNum = parseInt(d, 10);
                          const dayName = new Date(parseInt(y, 10), parseInt(m, 10) - 1, dayNum).toLocaleDateString('en-US', { weekday: 'short' });
                          return (
                            <th key={dateKey} className="p-2.5 min-w-[220px] bg-slate-900 border-l border-slate-800">
                              <div className="text-sky-300 font-bold">{dayName}, {dayNum}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{dateKey}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                      {parsedMultiResult.entries.map((entry, rIdx) => {
                        return (
                          <tr key={rIdx} className="hover:bg-slate-800/70 transition">
                            <td className="p-2.5 text-center font-mono text-slate-400 text-[11px]">
                              {rIdx + 1}
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-white text-xs">{entry.driverName}</div>
                              <div className="text-[10px] text-slate-400">
                                TLS Fleet
                                <span className="ml-1 text-emerald-400 font-mono font-semibold">
                                  [SL #{entry.driverIndex + 1}]
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 font-mono text-[11px]">
                              <div className="text-sky-300 font-semibold">{entry.plate || '—'}</div>
                              <div className="text-slate-400 text-[10px]">{entry.iqama || '—'}</div>
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-slate-300">
                              {entry.empNo || '—'}
                            </td>
                            {parsedMultiResult.detectedDates.map(dateKey => {
                              const tag = entry.tagsByDate[dateKey] || '';
                              if (!tag) {
                                return (
                                  <td key={dateKey} className="p-2.5 text-slate-600 italic text-[11px] border-l border-slate-800/60">
                                    —
                                  </td>
                                );
                              }

                              const upper = tag.toUpperCase();
                              let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                              if (upper.includes('UNDER LOADING') || upper.includes('COLLECTION')) {
                                badgeColor = 'bg-blue-950/70 text-blue-200 border-blue-700/60';
                              } else if (upper.includes('ON THE WAY') || upper.includes('BORDER')) {
                                badgeColor = 'bg-indigo-950/70 text-indigo-200 border-indigo-700/60';
                              } else if (upper.includes('OFFLOADING')) {
                                badgeColor = 'bg-amber-950/70 text-amber-200 border-amber-700/60';
                              } else if (upper.includes('COMING BACK') || upper.includes('ARRIVED YANBU')) {
                                badgeColor = 'bg-purple-950/70 text-purple-200 border-purple-700/60';
                              } else if (upper === 'AT YANBU' || upper.includes('AT YANBU')) {
                                badgeColor = 'bg-emerald-950/70 text-emerald-200 border-emerald-700/60';
                              } else if (upper.includes('INTERNAL TRANSFER')) {
                                badgeColor = 'bg-cyan-950/70 text-cyan-200 border-cyan-700/60';
                              } else if (upper.includes('MAINTENANCE')) {
                                badgeColor = 'bg-orange-950/70 text-orange-200 border-orange-700/60';
                              } else if (upper.includes('VACATION') || upper.includes('WITH OUT TRUCK')) {
                                badgeColor = 'bg-rose-950/70 text-rose-200 border-rose-700/60';
                              }

                              return (
                                <td key={dateKey} className="p-2.5 border-l border-slate-800/60">
                                  <div className={`p-1.5 rounded-lg border text-[11px] font-mono leading-tight ${badgeColor}`}>
                                    {tag}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unmapped Lines notice if any */}
              {parsedMultiResult.unmatchedLines.length > 0 && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    {parsedMultiResult.unmatchedLines.length} Unmatched or Informational Line(s):
                  </div>
                  <div className="font-mono text-[11px] text-amber-300 max-h-24 overflow-y-auto custom-scrollbar">
                    {parsedMultiResult.unmatchedLines.map((line, idx) => (
                      <div key={idx}>&bull; {line}</div>
                    ))}
                  </div>
                  <div className="text-[10px] text-amber-400">
                    Headers or non-driver summary rows (e.g. section dividers) were skipped automatically.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Driver Prediction & Progression Inspector Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Driver Manifest Inspector #{inspectModal.sl}
                </h3>
              </div>
              <button
                onClick={() => setInspectModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="text-white font-bold text-sm">{inspectModal.driver.name}</div>
                <div className="text-slate-400 font-mono text-[11px] flex flex-wrap gap-2">
                  <span>EMP: <strong className="text-emerald-400">{inspectModal.driver.empNo || '—'}</strong></span>
                  <span>&bull;</span>
                  <span>Vehicle: <strong className="text-emerald-400">{inspectModal.driver.assignedVehiclePlate || 'Unassigned'}</strong></span>
                  <span>&bull;</span>
                  <span>Equipment: <strong className="text-slate-300">{inspectModal.driver.equipment || '—'}</strong></span>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">PREVIOUS STATUS (DAY BEFORE {selectedDate})</span>
                <div className="text-slate-200 font-mono text-xs">
                  {inspectModal.prev || <span className="text-slate-500 italic">No previous recorded status</span>}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">TIMETABLE DISPATCH SCHEDULE INGESTION</span>
                {inspectModal.matchedRow ? (
                  <div className="space-y-1 text-slate-200 font-mono text-xs">
                    <div className="text-sky-300 font-bold flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-sky-400" />
                      {inspectModal.matchedRow.source} &rarr; {inspectModal.matchedRow.destination} ({inspectModal.matchedRow.customer || inspectModal.matchedRow.supplier || 'Plant'})
                    </div>
                    {inspectModal.matchedRow.commodity && (
                      <div className="text-slate-300">Commodity: {inspectModal.matchedRow.commodity}</div>
                    )}
                    {inspectModal.matchedRow.waybill && (
                      <div className="text-slate-400 text-[11px]">Waybill: {inspectModal.matchedRow.waybill} &bull; DN: {inspectModal.matchedRow.dn || 'N/A'}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500 italic text-xs">
                    No timetable schedule record found for this driver on {selectedDate}. Status inferred from cycle progression.
                  </div>
                )}
              </div>

              <div className="bg-purple-950/40 p-3 rounded-xl border border-purple-500/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-purple-300 font-bold">AI SUGGESTED STATUS TAG</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                    inspectModal.pred.conf === 'high'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : inspectModal.pred.conf === 'medium'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {inspectModal.pred.conf} CONFIDENCE
                  </span>
                </div>
                <div className="text-white font-mono font-bold text-xs bg-slate-950/80 p-2 rounded-lg border border-purple-800">
                  {inspectModal.pred.text}
                </div>
                <div className="text-purple-200 text-[11px] leading-relaxed">
                  <strong>Reasoning:</strong> {inspectModal.pred.reason}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl border border-slate-700 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
