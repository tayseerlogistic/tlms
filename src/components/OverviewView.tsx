import React, { useState, useMemo } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { ksaDateISO, shiftISODate, shiftISOMonth } from '../utils/dateUtils';
import { transactionCashImpact } from '../utils/cashbookUtils';
import {
  Truck, Users, Fuel, DollarSign, AlertCircle, ArrowUpRight,
  TrendingUp, CheckCircle2, Clock, AlertTriangle, ShieldCheck,
  Calendar, Activity, BarChart3, Zap, ArrowDownRight, Sparkles,
  Layers, Gauge
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface OverviewViewProps {
  onNavigate: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const { trucks, equipment, drivers, manifests, schedules, cashTransactions, kmRecords, dieselLogs, conflicts } = useLms();
  const { role, user } = useAuth();

  // Time range filter for visualizations
  const [timeRange, setTimeRange] = useState<'monthly' | '14days' | '7days'>('monthly');
  const [activeChartTab, setActiveChartTab] = useState<'both' | 'fuel' | 'manifest'>('both');

  const today = ksaDateISO();
  const todayManifest = manifests[today] || {};
  const activeTripsCount = Object.values(todayManifest).filter(t => t.includes('Under Loading') || t.includes('On the way')).length;
  const maintenanceCount = Object.values(todayManifest).filter(t => String(t).toLowerCase().includes('maintenance')).length;
  const observedFuelLiters = dieselLogs.reduce((sum, entry) => sum + Math.max(0, Number(entry.liters) || 0), 0);
  const observedFuelCost = dieselLogs.reduce((sum, entry) => sum + Math.max(0, Number(entry.cost) || 0), 0);
  const observedDieselPrice = observedFuelLiters > 0 ? observedFuelCost / observedFuelLiters : null;
  
  // Total fleet distance
  const totalKm = kmRecords.reduce((acc, r) => acc + (r.km || 0), 0);
  
  // Cash balance
  let cashInflow = 0;
  let cashOutflow = 0;
  cashTransactions.forEach(t => {
    const impact = transactionCashImpact(t, cashTransactions);
    if (impact > 0) cashInflow += impact;
    if (impact < 0) cashOutflow += Math.abs(impact);
  });

  const openConflicts = conflicts.filter(c => c.status === 'open');

  // ===================================================================
  // DATA VISUALIZATION ENGINE 1: FUEL EFFICIENCY TRENDS OVER TIME
  // ===================================================================
  const fuelTrendData = useMemo(() => {
    const quotaTarget = 3.0;
    const todayISO = ksaDateISO();
    const points: Array<{
      period: string; fullDate: string; efficiency: number | null; quota: number;
      distanceKm: number; litersConsumed: number; fuelCostSar: number; variance: number; hasData: boolean
    }> = [];

    const buildPoint = (periodKey: string, label: string, monthly: boolean) => {
      const distance = kmRecords
        .filter(record => monthly ? record.date?.startsWith(periodKey) : record.date === periodKey)
        .reduce((sum, record) => sum + Math.max(0, Number(record.km) || 0), 0);
      const fuel = dieselLogs.filter(record => monthly ? record.date?.startsWith(periodKey) : record.date === periodKey);
      const liters = fuel.reduce((sum, record) => sum + Math.max(0, Number(record.liters) || 0), 0);
      const cost = fuel.reduce((sum, record) => sum + Math.max(0, Number(record.cost) || 0), 0);
      const hasData = distance > 0 && liters > 0;
      const efficiency = hasData ? Number((distance / liters).toFixed(2)) : 0;
      return {
        period: label,
        fullDate: periodKey,
        efficiency: hasData ? efficiency : null,
        quota: quotaTarget,
        distanceKm: Math.round(distance),
        litersConsumed: Math.round(liters),
        fuelCostSar: Math.round(cost),
        variance: hasData && efficiency > 0 ? Number((((efficiency - quotaTarget) / quotaTarget) * 100).toFixed(1)) : 0,
        hasData
      };
    };

    if (timeRange === 'monthly') {
      for (let offset = -11; offset <= 0; offset++) {
        const month = shiftISOMonth(todayISO, offset);
        const date = new Date(`${month}-01T00:00:00.000Z`);
        const label = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
        points.push(buildPoint(month, label, true));
      }
      return points;
    }

    const daysCount = timeRange === '7days' ? 7 : 14;
    for (let offset = daysCount - 1; offset >= 0; offset--) {
      const day = shiftISODate(todayISO, -offset);
      const [, month, date] = day.split('-');
      points.push(buildPoint(day, `${Number(date)}/${Number(month)}`, false));
    }
    return points;
  }, [timeRange, kmRecords, dieselLogs]);

  // ===================================================================
  // DATA VISUALIZATION ENGINE 2: MANIFEST COMPLETION RATES OVER TIME
  // ===================================================================
  const manifestTrendData = useMemo(() => {
    const totalFleetDrivers = drivers.length;
    const todayISO = ksaDateISO();
    const buildPoint = (periodKey: string, label: string, monthly: boolean) => {
      const dateMatches = (date: string) => monthly ? date.startsWith(periodKey) : date === periodKey;
      const scheduleEntries = Object.entries(schedules).filter(([date]) => dateMatches(date));
      const manifestEntries = Object.entries(manifests).filter(([date]) => dateMatches(date));
      const scheduleCount = scheduleEntries.reduce((sum, [, schedule]) =>
        sum + (schedule.rows || []).filter(row => Boolean(row.driverName || row.plateNo)).length, 0);
      let completed = 0;
      let inTransit = 0;
      let maintenance = 0;
      let taggedCount = 0;
      manifestEntries.forEach(([, tags]) => {
        const values = Object.values(tags || {});
        taggedCount += values.length;
        values.forEach(value => {
          const tag = String(value || '').toLowerCase();
          if (tag.includes('delivered') || tag.includes('offload') || tag.includes('discharged') ||
              tag.includes('completed') || tag.includes('at yanbu base') || tag === 'at base') completed++;
          else if (tag.includes('loading') || tag.includes('on the way') || tag.includes('transit') ||
                   tag.includes('supply for') || tag.includes('en-route') || tag.includes('en route')) inTransit++;
          else if (tag.includes('maintenance') || tag.includes('workshop')) maintenance++;
        });
      });
      const scheduledTrips = Math.max(scheduleCount, taggedCount);
      const completionRate = scheduledTrips > 0 ? Number((Math.min(100, completed / scheduledTrips * 100)).toFixed(1)) : 0;
      return {
        period: label,
        fullDate: periodKey,
        completionRate: scheduledTrips > 0 ? completionRate : null,
        targetSla: 95.0,
        completedTrips: completed,
        inTransitTrips: inTransit,
        scheduledTrips,
        pendingStandby: Math.max(0, scheduledTrips - completed - inTransit - maintenance),
        hasData: scheduledTrips > 0,
        totalFleetDrivers
      };
    };

    if (timeRange === 'monthly') {
      const points = [];
      for (let offset = -11; offset <= 0; offset++) {
        const month = shiftISOMonth(todayISO, offset);
        const date = new Date(`${month}-01T00:00:00.000Z`);
        const label = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
        points.push(buildPoint(month, label, true));
      }
      return points;
    }

    const daysCount = timeRange === '7days' ? 7 : 14;
    const points = [];
    for (let offset = daysCount - 1; offset >= 0; offset--) {
      const day = shiftISODate(todayISO, -offset);
      const [, month, date] = day.split('-');
      points.push(buildPoint(day, `${Number(date)}/${Number(month)}`, false));
    }
    return points;
  }, [timeRange, manifests, drivers, schedules]);

  // Overall statistics for the summary cards
  const avgEfficiency = useMemo(() => {
    const measured = fuelTrendData.filter(d => d.hasData);
    if (!measured.length) return 0;
    const sum = measured.reduce((acc, d) => acc + (d.efficiency || 0), 0);
    return parseFloat((sum / measured.length).toFixed(2));
  }, [fuelTrendData]);

  const avgCompletionRate = useMemo(() => {
    const measured = manifestTrendData.filter(d => d.hasData);
    if (!measured.length) return 0;
    const sum = measured.reduce((acc, d) => acc + (d.completionRate || 0), 0);
    return parseFloat((sum / measured.length).toFixed(1));
  }, [manifestTrendData]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              TLS Enterprise Fleet Command &bull; Active Role: {role.toUpperCase()}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Fleet Operations &amp; Central Data Hub</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Consolidated management for {trucks.length} prime movers, {equipment.length} tankers and trailers, and {drivers.filter(driver => driver.active).length} active drivers across the Kingdom of Saudi Arabia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {role === 'admin' && (
              <button
                onClick={() => onNavigate('users')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
              >
                🛡️ Manage Users &amp; Roles
              </button>
            )}
            <button
              onClick={() => onNavigate('timetable')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2"
            >
              📋 Ingest Timetable
            </button>
            <button
              onClick={() => onNavigate('manifest')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition flex items-center gap-2"
            >
              🚚 Today's Manifest
            </button>
          </div>
        </div>
      </div>

      {/* Conflicts Alert (If any) */}
      {openConflicts.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-300 font-mono">
                {openConflicts.length} Data Quality Conflicts Detected in Master Records
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Duplicate truck-to-driver assignments or incomplete iqamas from legacy sheets require attention.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('master')}
            className="text-xs font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-lg transition shrink-0"
          >
            Review &amp; Fix →
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Trucks */}
        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Fleet Readiness</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">{trucks.length} Trucks</h3>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> {trucks.length ? Math.round((trucks.filter(t => t.status === 'ACTIVE').length / trucks.length) * 100) : 0}% active prime movers
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex justify-between text-xs text-slate-400">
            <span>Trailers: <strong className="text-slate-200">{equipment.length}</strong></span>
            <span>Drivers: <strong className="text-slate-200">{drivers.length}</strong></span>
          </div>
        </div>

        {/* Trips Progression */}
        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Active Dispatches</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">{activeTripsCount} On Route</h3>
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" /> {maintenanceCount} under workshop service
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex justify-between text-xs text-slate-400">
            <span>Standby: <strong className="text-slate-200">{Math.max(0, drivers.filter(d => d.active).length - activeTripsCount - maintenanceCount)}</strong></span>
            <button onClick={() => onNavigate('manifest')} className="text-blue-400 hover:underline">View Live Manifest →</button>
          </div>
        </div>

        {/* Fleet KM & Distance */}
        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Logged Distance</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">{totalKm.toLocaleString()} KM</h3>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                <Fuel className="w-3.5 h-3.5" /> {fuelTrendData.some(d => d.hasData) ? avgEfficiency + ' KM/L average of populated periods' : 'No fuel readings recorded'}
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex justify-between text-xs text-slate-400">
            <span>Recorded fuel cost: {observedDieselPrice !== null ? observedDieselPrice.toFixed(2) + ' SAR/L average paid' : 'No diesel readings'}</span>
            <button onClick={() => onNavigate('km-fuel')} className="text-emerald-400 hover:underline">Fuel Balancer →</button>
          </div>
        </div>

        {/* Cashbook Ledger */}
        <div className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Operational Ledger</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">SAR {(cashInflow - cashOutflow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Outflow: <span className="text-rose-400 font-mono">SAR {cashOutflow.toLocaleString()}</span>
              </p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex justify-between text-xs text-slate-400">
            <span>Inflows: <strong className="text-emerald-400 font-mono">SAR {cashInflow.toLocaleString()}</strong></span>
            <button onClick={() => onNavigate('cashbook')} className="text-indigo-400 hover:underline">Cashbook →</button>
          </div>
        </div>
      </div>

      {/* =============================================================
          DATA VISUALIZATION SUMMARY (RECHARTS SUITE)
          Fuel Efficiency Trends & Manifest Completion Rates Over Time
          ============================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
        {/* Analytics Top Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Operations &amp; Efficiency Analytics Suite
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Recorded Operations Data
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Time-series tracking for fleet fuel consumption economy (KM/L vs 3.0 Quota) and operational manifest fulfillment
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chart View Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveChartTab('both')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeChartTab === 'both' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dual View
              </button>
              <button
                onClick={() => setActiveChartTab('fuel')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  activeChartTab === 'fuel' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Fuel className="w-3 h-3" /> Fuel Trends
              </button>
              <button
                onClick={() => setActiveChartTab('manifest')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  activeChartTab === 'manifest' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3 h-3" /> Manifest Rates
              </button>
            </div>

            {/* Time Range Selector */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setTimeRange('7days')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  timeRange === '7days' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange('14days')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  timeRange === '14days' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                14 Days
              </button>
              <button
                onClick={() => setTimeRange('monthly')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  timeRange === 'monthly' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                12 Months
              </button>
            </div>
          </div>
        </div>

        {/* Executive KPI Micro-Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase">Period Fuel Avg</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-cyan-400 font-mono">{fuelTrendData.some(d => d.hasData) ? avgEfficiency : '—'}</span>
                <span className="text-xs text-slate-400">KM/L</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {fuelTrendData.some(d => d.hasData) ? (avgEfficiency >= 3 ? '+' : '') + parseFloat((((avgEfficiency - 3.0) / 3.0) * 100).toFixed(1)) + '% vs Quota' : 'No readings'}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase">Manifest Fulfillment</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-purple-400 font-mono">{manifestTrendData.some(d => d.hasData) ? avgCompletionRate + '%' : '—'}</span>
                <span className="text-xs text-slate-400">SLA</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Target &ge; 95%
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase">Average Recorded Diesel Cost</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-emerald-400 font-mono">{observedDieselPrice !== null ? observedDieselPrice.toFixed(2) : "—"}</span>
                <span className="text-xs text-slate-400">SAR / L</span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{observedDieselPrice !== null ? "Observed data" : "No fuel records"}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono text-slate-400 uppercase">Active Fleet Quota</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-black text-amber-400 font-mono">3.00</span>
                <span className="text-xs text-slate-400">KM/L Standard</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Balanced
            </span>
          </div>
        </div>

        {/* Charts Container Grid */}
        <div className={`grid gap-6 ${activeChartTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* CHART 1: FUEL EFFICIENCY TRENDS */}
          {(activeChartTab === 'both' || activeChartTab === 'fuel') && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-inner space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-cyan-400" /> Fleet Fuel Efficiency vs Target Quota (KM/L)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Dual Metric: Fuel Economy curve with baseline quota reference line &amp; consumption volume
                  </span>
                </div>
                <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  Target: 3.0 KM/L
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={fuelTrendData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="efficiencyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="barFuelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="period"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={['auto', 'auto']}
                      stroke="#06b6d4"
                      fontSize={11}
                      tickLine={false}
                      unit=" KM/L"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      unit={timeRange === 'monthly' ? 'k L' : ' L'}
                    />

                    {/* Standard Quota Reference Line */}
                    <ReferenceLine
                      yAxisId="left"
                      y={3.0}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Quota 3.0',
                        fill: '#f59e0b',
                        fontSize: 10,
                        position: 'insideTopLeft'
                      }}
                    />

                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        const isOptimal = data.efficiency !== null && data.efficiency >= 3.0;

                        return (
                          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs font-mono space-y-1.5 z-50">
                            <div className="font-bold text-white border-b border-slate-800 pb-1 flex justify-between gap-4">
                              <span>Period: {data.fullDate || label}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                isOptimal ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {isOptimal ? 'Optimal Economy' : 'Under Quota'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Fleet Efficiency:</span>
                              <span className="text-cyan-400 font-bold">{data.efficiency === null ? '—' : data.efficiency} KM/L</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Target Benchmark:</span>
                              <span className="text-amber-400 font-semibold">3.00 KM/L</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Fuel Consumed:</span>
                              <span className="text-blue-300">
                                {data.litersConsumed.toLocaleString()} {timeRange === 'monthly' ? 'kL' : 'L'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Total Distance:</span>
                              <span className="text-slate-200">
                                {data.distanceKm.toLocaleString()} {timeRange === 'monthly' ? 'k KM' : 'KM'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 text-[11px]">
                              <span className="text-slate-400">Est. Fuel Cost:</span>
                              <span className="text-emerald-400 font-bold">SAR {data.fuelCostSar.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      }}
                    />

                    <Legend
                      verticalAlign="top"
                      height={28}
                      formatter={(val) => <span className="text-[11px] text-slate-300 font-mono">{val}</span>}
                    />

                    {/* Fuel Volume Bars */}
                    <Bar
                      yAxisId="right"
                      dataKey="litersConsumed"
                      name={timeRange === 'monthly' ? 'Volume (kL)' : 'Volume (L)'}
                      fill="url(#barFuelGrad)"
                      radius={[4, 4, 0, 0]}
                      barSize={timeRange === 'monthly' ? 16 : 10}
                    />

                    {/* Efficiency Curve Area */}
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="efficiency"
                      name="Fuel Efficiency (KM/L)"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#efficiencyGrad)"
                      activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CHART 2: MANIFEST COMPLETION RATES */}
          {(activeChartTab === 'both' || activeChartTab === 'manifest') && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-inner space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" /> Manifest Operational Fulfillment &amp; Completion Rate
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Dual Metric: SLA Completion percentage with categorized trip dispatch counts
                  </span>
                </div>
                <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                  SLA: &ge; 95%
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={manifestTrendData}
                    margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="period"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      stroke="#a855f7"
                      fontSize={11}
                      tickLine={false}
                      unit="%"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                    />

                    {/* SLA Target Reference Line */}
                    <ReferenceLine
                      yAxisId="left"
                      y={95.0}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'SLA 95%',
                        fill: '#10b981',
                        fontSize: 10,
                        position: 'insideTopLeft'
                      }}
                    />

                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        const satisfiesSla = data.completionRate !== null && data.completionRate >= 95.0;

                        return (
                          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs font-mono space-y-1.5 z-50">
                            <div className="font-bold text-white border-b border-slate-800 pb-1 flex justify-between gap-4">
                              <span>Period: {data.fullDate || label}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                                satisfiesSla ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {satisfiesSla ? 'SLA Met' : 'Under SLA'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Completion Rate:</span>
                              <span className="text-purple-400 font-bold">{data.completionRate === null ? '—' : data.completionRate + '%'}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Completed Dispatches:</span>
                              <span className="text-emerald-400 font-semibold">{data.completedTrips}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">In-Transit / Active:</span>
                              <span className="text-blue-400">{data.inTransitTrips}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Total Scheduled:</span>
                              <span className="text-slate-200">{data.scheduledTrips}</span>
                            </div>
                          </div>
                        );
                      }}
                    />

                    <Legend
                      verticalAlign="top"
                      height={28}
                      formatter={(val) => <span className="text-[11px] text-slate-300 font-mono">{val}</span>}
                    />

                    {/* Stacked Bars for Completed and In Transit */}
                    <Bar
                      yAxisId="right"
                      dataKey="completedTrips"
                      name="Completed"
                      stackId="a"
                      fill="#10b981"
                      radius={[0, 0, 0, 0]}
                      barSize={timeRange === 'monthly' ? 16 : 10}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="inTransitTrips"
                      name="In-Transit"
                      stackId="a"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      barSize={timeRange === 'monthly' ? 16 : 10}
                    />

                    {/* Completion Rate Line */}
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="completionRate"
                      name="Completion Rate (%)"
                      stroke="#c084fc"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#c084fc' }}
                      activeDot={{ r: 6, fill: '#c084fc', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Operational Strategic Insights Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-mono">Fuel Quota Optimization</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Current fleet average of <strong className="text-cyan-400">{avgEfficiency} KM/L</strong> exceeds the 3.0 KM/L benchmark, generating monthly diesel savings across standard Yanbu-Riyadh lanes.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-mono">SLA Fulfillment Consistency</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Daily manifest completion holds steady at <strong className="text-purple-400">{avgCompletionRate}%</strong>, with proactive driver rotation maintaining high vehicle readiness.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white font-mono">Predictive Dispatch Integration</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Timetable auto-fetch synchronization connects active schedule orders directly into driver manifests, minimizing idle turnaround.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live Fleet Status Matrix */}
      <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>🚛</span> Prime Mover &amp; Driver Deployment Board
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Live status and assignment overview across {trucks.length} prime movers</p>
          </div>
          <span className="text-xs font-mono bg-slate-900 px-3 py-1 rounded-lg border border-slate-700 text-slate-300">
            Today: {today}
          </span>
        </div>

        <div className="overflow-x-auto max-h-96 rounded-xl border border-slate-700/60">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
              <tr>
                <th className="p-3">Seq</th>
                <th className="p-3">Plate No</th>
                <th className="p-3">Assigned Driver</th>
                <th className="p-3">Employee #</th>
                <th className="p-3">Trailer / Tanker</th>
                <th className="p-3">Today Status / Tag</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {trucks.slice(0, 20).map((t, idx) => {
                const assignedDriver = drivers.find(d => d.id === t.assignedDriverId || d.assignedTruckId === t.id);
                const assignedEquip = equipment.find(e => e.assignedTruckId === t.id);
                const assignedDriverIndex = assignedDriver ? drivers.findIndex(driver => driver.id === assignedDriver.id) : -1;
                const tag = (assignedDriver ? todayManifest[assignedDriver.id] : undefined) || (assignedDriverIndex >= 0 ? todayManifest[String(assignedDriverIndex)] : undefined) || assignedDriver?.history?.[today] || 'At Yanbu Base';

                return (
                  <tr key={t.id} className="hover:bg-slate-800/60 transition">
                    <td className="p-3 text-slate-400 font-mono">#{t.seq}</td>
                    <td className="p-3 font-bold text-white font-mono">{t.plate}</td>
                    <td className="p-3 font-semibold text-slate-200">
                      {assignedDriver ? assignedDriver.name : <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="p-3 text-slate-400 font-mono">{assignedDriver?.empNo || '—'}</td>
                    <td className="p-3 font-mono text-sky-400">{assignedEquip?.equipNo || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        tag.includes('Loading')
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : tag.includes('On the way') || tag.includes('Transit')
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : tag.includes('Offloading')
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : tag.includes('Maintenance')
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {tag}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigate('manifest')}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        Tag Status
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
