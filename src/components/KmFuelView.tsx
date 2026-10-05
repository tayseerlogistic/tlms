import React, { useState, useEffect, useRef } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { KSA_DIESEL_PRICE, COMPANY_KM_PER_LITER_QUOTA } from '../data/seedData';
import { KmRecord, DieselLog, Truck, Driver } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  Chart,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import {
  Truck as TruckIcon, Fuel, RefreshCw, Upload, Download, FileText,
  Settings, Search, Send, CheckCircle2, Clock, Plus, Trash2, Edit2, X,
  AlertTriangle, ArrowUpDown, ChevronRight, Gauge, MessageSquare, History,
  Sparkles, Filter, Check, Phone, Eye, Save
} from 'lucide-react';

// Register Chart.js elements
Chart.register(
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

export const KmFuelView: React.FC = () => {
  const {
    trucks, drivers, kmRecords, dieselLogs,
    addKmRecord, deleteKmRecord, addDieselLog,
    saveTruck, deleteTruck, saveDriver, deleteDriver,
    restoreFullBackup, exportFullBackup
  } = useLms();

  const { isAdmin, isDispatcher, isCashier } = useAuth();

  // Active sub-tab in KM module
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reconciliation' | 'entry' | 'history'>('dashboard');

  // Filter states
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'split' | 'all'>('split');
  const [searchAgg, setSearchAgg] = useState('');
  const [searchRecon, setSearchRecon] = useState('');
  const [searchHist, setSearchHist] = useState('');

  // Meter Entry Form state
  const [readingDate, setReadingDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [plateInput, setPlateInput] = useState('');
  const [odometerInput, setOdometerInput] = useState('');
  const [matchedPlateBadge, setMatchedPlateBadge] = useState('');
  const [previousReadingInfo, setPreviousReadingInfo] = useState<{ date: string; odo: number } | null>(null);

  // Tracker filter
  const [trackerFilter, setTrackerFilter] = useState<'remaining' | 'completed' | 'all'>('remaining');
  const [trackerSearch, setTrackerSearch] = useState('');

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMonthSelect, setUploadMonthSelect] = useState('auto');
  const [uploadJsonText, setUploadJsonText] = useState('');

  const [isDieselBatchModalOpen, setIsDieselBatchModalOpen] = useState(false);
  const [batchDieselMonth, setBatchDieselMonth] = useState(() => new Date().toISOString().substring(0, 7));
  const [batchDieselText, setBatchDieselText] = useState('');

  const [isFleetSetupOpen, setIsFleetSetupOpen] = useState(false);
  const [fleetSetupTab, setFleetSetupTab] = useState<'vehicles' | 'drivers'>('vehicles');

  // New Modals for Full HTML feature set: Quick Meter, Quick Fuel, WhatsApp Reminders, Truck History
  const [isQuickMeterModalOpen, setIsQuickMeterModalOpen] = useState(false);
  const [meterTruck, setMeterTruck] = useState<Truck | null>(null);
  const [meterInputVal, setMeterInputVal] = useState('');
  const [meterDate, setMeterDate] = useState(() => new Date().toISOString().substring(0, 10));

  const [isQuickFuelModalOpen, setIsQuickFuelModalOpen] = useState(false);
  const [fuelTruck, setFuelTruck] = useState<Truck | null>(null);
  const [fuelLitersVal, setFuelLitersVal] = useState('');
  const [fuelCostVal, setFuelCostVal] = useState('');
  const [fuelStationVal, setFuelStationVal] = useState('Yanbu Aramco Depot');
  const [fuelReceiptVal, setFuelReceiptVal] = useState('');
  const [fuelDate, setFuelDate] = useState(() => new Date().toISOString().substring(0, 10));

  const [isWhatsRemindersModalOpen, setIsWhatsRemindersModalOpen] = useState(false);
  const [whatsReminderLang, setWhatsReminderLang] = useState<'english' | 'urdu' | 'hindi'>('english');

  const [isTruckHistoryModalOpen, setIsTruckHistoryModalOpen] = useState(false);
  const [historyTruck, setHistoryTruck] = useState<Truck | null>(null);

  // Master Fleet Table Filters
  const [fleetTableFilter, setFleetTableFilter] = useState<'all' | 'low' | 'moderate' | 'high'>('all');
  const [fleetEconomyFilter, setFleetEconomyFilter] = useState<'all' | 'efficient' | 'standard' | 'high_consumption'>('all');
  const [fleetTableSearch, setFleetTableSearch] = useState('');

  // New vehicle/driver form in setup modal
  const [newVehPlate, setNewVehPlate] = useState('');
  const [newVehDesc, setNewVehDesc] = useState('');
  const [newDrvName, setNewDrvName] = useState('');
  const [newDrvEmpNo, setNewDrvEmpNo] = useState('');
  const [newDrvMobile, setNewDrvMobile] = useState('');

  // Chart canvas refs
  const topBarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lowBarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const donutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const allBarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const topChartInstance = useRef<Chart | null>(null);
  const lowChartInstance = useRef<Chart | null>(null);
  const donutChartInstance = useRef<Chart | null>(null);
  const allChartInstance = useRef<Chart | null>(null);

  // -------------------------------------------------------------
  // HELPER: Auto-complete plate
  // -------------------------------------------------------------
  const resolvePlate = (query: string): string => {
    if (!query) return '';
    const q = query.trim().toUpperCase().replace(/\s+/g, '');
    const exact = trucks.find(t => t.plateNorm === q);
    if (exact) return exact.plate;
    const suffix = trucks.find(t => t.plateNorm.endsWith(q));
    if (suffix) return suffix.plate;
    const sub = trucks.find(t => t.plateNorm.includes(q));
    if (sub) return sub.plate;
    return query.trim().toUpperCase();
  };

  const handlePlateInput = (val: string) => {
    setPlateInput(val);
    if (!val.trim()) {
      setMatchedPlateBadge('');
      setPreviousReadingInfo(null);
      return;
    }
    const resolved = resolvePlate(val);
    if (resolved && resolved.toLowerCase() !== val.toLowerCase()) {
      setMatchedPlateBadge(`✓ Matched: ${resolved}`);
    } else {
      setMatchedPlateBadge('');
    }

    if (resolved) {
      const past = kmRecords
        .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === resolved.toUpperCase().replace(/\s+/g, '') &&
                     r.date < readingDate && r.odometer != null && !isNaN(r.odometer))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (past.length > 0) {
        const last = past[past.length - 1];
        setPreviousReadingInfo({ date: last.date, odo: last.odometer! });
      } else {
        setPreviousReadingInfo(null);
      }
    }
  };

  const handlePlateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const resolved = resolvePlate(plateInput);
      setPlateInput(resolved);
      setMatchedPlateBadge(`✅ ${resolved}`);
      handlePlateInput(resolved);
      const odoEl = document.getElementById('km-reading-input');
      if (odoEl) odoEl.focus();
    }
  };

  // -------------------------------------------------------------
  // METER SUBMIT
  // -------------------------------------------------------------
  const handleMeterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = resolvePlate(plateInput);
    const odo = parseFloat(odometerInput);

    if (!resolved || isNaN(odo) || odo < 0) {
      alert("Please enter a valid Truck Plate and positive Odometer Reading.");
      return;
    }

    const norm = resolved.toUpperCase().replace(/\s+/g, '');

    // Get previous reading before readingDate
    const past = kmRecords
      .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === norm && r.date < readingDate && r.odometer != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get future readings
    const future = kmRecords
      .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === norm && r.date > readingDate && r.odometer != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const prevLog = past.length ? past[past.length - 1] : null;
    const nextLog = future.length ? future[0] : null;

    if (prevLog && prevLog.odometer! > 0 && odo < prevLog.odometer!) {
      alert(`Invalid reading: ${odo.toLocaleString()} is less than the previous reading (${prevLog.odometer!.toLocaleString()}) on ${prevLog.date}.`);
      return;
    }
    if (nextLog && nextLog.odometer! > 0 && odo > nextLog.odometer!) {
      alert(`Invalid reading: ${odo.toLocaleString()} is greater than the subsequent reading (${nextLog.odometer!.toLocaleString()}) on ${nextLog.date}.`);
      return;
    }

    const currentDistance = nextLog ? parseFloat((nextLog.odometer! - odo).toFixed(1)) : 0;
    const truck = trucks.find(t => t.plateNorm === norm);

    await addKmRecord({
      date: readingDate,
      veh: resolved,
      odometer: odo,
      km: currentDistance,
      driver: truck?.assignedDriverName || 'Driver',
      notes: 'Logged via Fast Meter Logger'
    });

    // Update previous day's distance
    if (prevLog) {
      const prevComputed = parseFloat((odo - prevLog.odometer!).toFixed(1));
      if (prevComputed >= 0) {
        await addKmRecord({
          ...prevLog,
          km: prevComputed
        });
      }
    }

    setPlateInput('');
    setOdometerInput('');
    setMatchedPlateBadge('');
    setPreviousReadingInfo(null);
    alert(`Logged ${odo.toLocaleString()} KM for ${resolved}!`);

    const plateEl = document.getElementById('km-plate-input');
    if (plateEl) plateEl.focus();
  };

  // WhatsApp meter request in 3 languages
  const sendWhatsAppReminder = (truckPlate: string) => {
    const truck = trucks.find(t => t.plate === truckPlate);
    const driver = drivers.find(d => d.name === truck?.assignedDriverName);
    const phone = driver?.mobile
      ? (driver.mobile.startsWith('0') ? '966' + driver.mobile.substring(1) : (driver.mobile.startsWith('966') ? driver.mobile : '966' + driver.mobile))
      : '';

    const text = `🚚 *TLS FLEET - METER READING REQUEST*
================================
🚛 *Truck Plate:* ${truckPlate}
👤 *Driver:* ${driver?.name || 'Driver'}
📅 *Date:* ${readingDate}

🇬🇧 *English:*
Send your Meter Reading 🚚📟

🇵🇰 *Urdu:*
اپنی میٹر ریڈنگ بھیجیں ۔ 🚚📟

🇮🇳 *Hindi:*
अपनी मीटर रीडिंग भेजें । 🚚📟

================================
TLS Logistics Fleet Management`;

    if (!phone) {
      const manual = prompt(`Enter WhatsApp number for driver of ${truckPlate} (e.g. 05XXXXXXXX):`, '05');
      if (manual) {
        const clean = manual.startsWith('0') ? '966' + manual.substring(1) : manual;
        window.open(`https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(text)}`, '_blank');
      }
    } else {
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  // Mark all missing as Idle
  const handleMarkMissingIdle = async () => {
    const loggedPlates = new Set(
      kmRecords.filter(r => r.date === readingDate).map(r => r.veh.toUpperCase().replace(/\s+/g, ''))
    );
    const missing = trucks.filter(t => !loggedPlates.has(t.plateNorm));

    if (missing.length === 0) {
      alert(`All trucks are already logged for ${readingDate}!`);
      return;
    }

    if (!confirm(`Mark ${missing.length} missing trucks as Idle (0 KM) for ${readingDate}?`)) return;

    for (const t of missing) {
      const past = kmRecords
        .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm && r.date < readingDate && r.odometer != null)
        .sort((a, b) => a.date.localeCompare(b.date));
      const prevLog = past.length ? past[past.length - 1] : null;

      await addKmRecord({
        date: readingDate,
        veh: t.plate,
        odometer: prevLog ? prevLog.odometer : null,
        km: 0,
        notes: 'Marked Idle / 0 KM'
      });
    }
    alert(`Marked ${missing.length} trucks as Idle for ${readingDate}`);
  };

  // Recalculate All KM distances
  const handleRecalculateAllKm = async () => {
    if (!confirm("Recalculate all vehicle KM distances?\n\nFormula: Day N KM = Day N+1 Odometer - Day N Odometer")) return;

    const byVehicle: Record<string, KmRecord[]> = {};
    kmRecords.forEach(r => {
      if (!r.veh || r.odometer == null || isNaN(r.odometer)) return;
      const norm = r.veh.toUpperCase().replace(/\s+/g, '');
      if (!byVehicle[norm]) byVehicle[norm] = [];
      byVehicle[norm].push(r);
    });

    let updatedCount = 0;
    for (const norm in byVehicle) {
      const logs = byVehicle[norm].sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 0; i < logs.length; i++) {
        let target = 0;
        if (i < logs.length - 1) {
          const next = logs[i + 1].odometer!;
          const curr = logs[i].odometer!;
          if (next >= curr) target = parseFloat((next - curr).toFixed(1));
        }
        if (logs[i].km !== target) {
          await addKmRecord({ ...logs[i], km: target });
          updatedCount++;
        }
      }
    }
    alert(`Recalculated ${updatedCount} KM records successfully!`);
  };

  // -------------------------------------------------------------
  // FLEET BALANCING AGGREGATION
  // -------------------------------------------------------------
  const isAllMonth = selectedMonth === 'All';
  const lowLimit = isAllMonth ? 10000 : 1500;
  const highLimit = isAllMonth ? 60000 : 5000;

  const vehDistanceMap: Record<string, number> = {};
  trucks.forEach(t => { vehDistanceMap[t.plate] = 0; });

  kmRecords.forEach(r => {
    if (selectedMonth !== 'All' && r.date && !r.date.startsWith(selectedMonth)) return;
    if (r.km > 35000 || r.km < 0) return;
    const match = trucks.find(t => t.plateNorm === r.veh.toUpperCase().replace(/\s+/g, ''));
    const key = match ? match.plate : r.veh;
    vehDistanceMap[key] = (vehDistanceMap[key] || 0) + (r.km || 0);
  });

  const aggList = Object.entries(vehDistanceMap).map(([veh, km]) => ({ veh, km }));
  aggList.sort((a, b) => b.km - a.km);

  const totalFleetKm = aggList.reduce((acc, x) => acc + x.km, 0);
  const activeTrucksCount = aggList.filter(x => x.km > 0).length || aggList.length;
  const avgKmPerTruck = activeTrucksCount > 0 ? Math.round(totalFleetKm / activeTrucksCount) : 0;

  const lowRunCount = aggList.filter(x => x.km < lowLimit).length;
  const highRunCount = aggList.filter(x => x.km > highLimit).length;
  const modRunCount = aggList.length - lowRunCount - highRunCount;

  // Recommender lowest 3 utilization
  const lowest3Available = aggList.filter(x => x.km > 0).slice(-3).reverse();

  // -------------------------------------------------------------
  // CHART RENDERING (Chart.js)
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'dashboard') return;

    const top10 = aggList.slice(0, 10);
    const low10 = aggList.filter(x => x.km > 0).slice(-10).reverse();

    // 1. Top 10 Chart
    if (topBarCanvasRef.current) {
      if (topChartInstance.current) topChartInstance.current.destroy();
      topChartInstance.current = new Chart(topBarCanvasRef.current, {
        type: 'bar',
        data: {
          labels: top10.map(x => x.veh),
          datasets: [{
            label: 'Distance (KM)',
            data: top10.map(x => x.km),
            backgroundColor: '#10b981',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } }
          }
        }
      });
    }

    // 2. Lowest 10 Chart
    if (lowBarCanvasRef.current) {
      if (lowChartInstance.current) lowChartInstance.current.destroy();
      lowChartInstance.current = new Chart(lowBarCanvasRef.current, {
        type: 'bar',
        data: {
          labels: low10.map(x => x.veh),
          datasets: [{
            label: 'Distance (KM)',
            data: low10.map(x => x.km),
            backgroundColor: '#38bdf8',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } }
          }
        }
      });
    }

    // 3. Donut Chart
    if (donutCanvasRef.current) {
      if (donutChartInstance.current) donutChartInstance.current.destroy();
      donutChartInstance.current = new Chart(donutCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Low KM (Ready)', 'Moderate Run', 'High Run (Needs Rest)'],
          datasets: [{
            data: [lowRunCount, modRunCount, highRunCount],
            backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
            borderWidth: 2,
            borderColor: '#1e293b'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10 }, boxWidth: 10 } }
          }
        }
      });
    }

    // 4. All Vehicles Bar Chart
    if (allBarCanvasRef.current && viewMode === 'all') {
      if (allChartInstance.current) allChartInstance.current.destroy();
      allChartInstance.current = new Chart(allBarCanvasRef.current, {
        type: 'bar',
        data: {
          labels: aggList.map(x => x.veh),
          datasets: [{
            label: 'Distance (KM)',
            data: aggList.map(x => x.km),
            backgroundColor: aggList.map(x => x.km < lowLimit ? '#10b981' : x.km <= highLimit ? '#3b82f6' : '#ef4444'),
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 8 }, maxRotation: 60 }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#334155' } }
          }
        }
      });
    }

    return () => {
      if (topChartInstance.current) topChartInstance.current.destroy();
      if (lowChartInstance.current) lowChartInstance.current.destroy();
      if (donutChartInstance.current) donutChartInstance.current.destroy();
      if (allChartInstance.current) allChartInstance.current.destroy();
    };
  }, [activeTab, selectedMonth, viewMode, kmRecords, trucks]);

  // -------------------------------------------------------------
  // PDF REPORT EXPORT
  // -------------------------------------------------------------
  const exportPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('TLS LOGISTICS - FLEET UTILIZATION & BALANCING REPORT', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 200, 15);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Timeframe: ${selectedMonth} | Total Fleet Run: ${totalFleetKm.toLocaleString()} KM | Avg / Truck: ${avgKmPerTruck.toLocaleString()} KM`, 14, 33);

    // Add canvas charts if available
    try {
      if (topBarCanvasRef.current) {
        doc.addImage(topBarCanvasRef.current.toDataURL('image/png', 1.0), 'PNG', 14, 40, 125, 60);
      }
      if (lowBarCanvasRef.current) {
        doc.addImage(lowBarCanvasRef.current.toDataURL('image/png', 1.0), 'PNG', 150, 40, 125, 60);
      }
      if (donutCanvasRef.current) {
        doc.addImage(donutCanvasRef.current.toDataURL('image/png', 1.0), 'PNG', 14, 110, 100, 70);
      }
    } catch (e) {
      console.warn("Chart image snapshot issue:", e);
    }

    doc.save(`TLS_Fleet_Utilization_${selectedMonth}_${new Date().toISOString().substring(0, 10)}.pdf`);
    alert("PDF report downloaded successfully!");
  };

  // -------------------------------------------------------------
  // MONTHLY KM INGESTION (.json)
  // -------------------------------------------------------------
  const handleMonthlyKmUpload = async () => {
    if (!uploadJsonText.trim()) {
      alert("Please paste the monthly JSON data.");
      return;
    }

    try {
      const data = JSON.parse(uploadJsonText);
      let count = 0;

      if (typeof data === 'object' && !Array.isArray(data)) {
        for (const monthKey in data) {
          const rows = data[monthKey];
          if (Array.isArray(rows)) {
            for (const row of rows) {
              const plate = resolvePlate(row['Truck Plate#'] || row['Truck Plate'] || row['vehicle'] || row['Plate'] || '');
              const kmVal = parseFloat(row['Total KM/M'] ?? row['km'] ?? 0);
              if (plate && !isNaN(kmVal) && kmVal >= 0) {
                await addKmRecord({
                  date: `${uploadMonthSelect !== 'auto' ? uploadMonthSelect : '2026-08'}-15`,
                  veh: plate,
                  odometer: 100000 + kmVal,
                  km: kmVal,
                  notes: `Uploaded Monthly Run (${monthKey})`
                });
                count++;
              }
            }
          }
        }
      } else if (Array.isArray(data)) {
        for (const row of data) {
          const plate = resolvePlate(row['Truck Plate#'] || row['Truck Plate'] || row['veh'] || '');
          const kmVal = parseFloat(row['Total KM/M'] ?? row['km'] ?? 0);
          if (plate && !isNaN(kmVal) && kmVal >= 0) {
            await addKmRecord({
              date: row['date'] || `${uploadMonthSelect !== 'auto' ? uploadMonthSelect : '2026-08'}-15`,
              veh: plate,
              odometer: row['odometer'] || 100000 + kmVal,
              km: kmVal,
              notes: 'Uploaded KM Record'
            });
            count++;
          }
        }
      }

      alert(`Successfully integrated ${count} monthly KM records!`);
      setIsUploadModalOpen(false);
      setUploadJsonText('');
    } catch (err: any) {
      alert("Failed to parse JSON: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // BATCH DIESEL INGESTION
  // -------------------------------------------------------------
  const handleBatchDieselImport = async () => {
    if (!batchDieselText.trim()) return alert("Please enter diesel data");
    const logDate = `${batchDieselMonth}-15`;
    let count = 0;

    try {
      if (batchDieselText.trim().startsWith('{')) {
        const obj = JSON.parse(batchDieselText);
        for (const rawPlate in obj) {
          const resolved = resolvePlate(rawPlate);
          const liters = parseFloat(obj[rawPlate]);
          if (resolved && !isNaN(liters) && liters > 0) {
            const trk = trucks.find(t => t.plateNorm === resolved.replace(/\s+/g, ''));
            await addDieselLog({
              date: logDate,
              veh: resolved,
              drv: trk?.assignedDriverName || 'Fleet Driver',
              liters,
              cost: parseFloat((liters * KSA_DIESEL_PRICE).toFixed(2)),
              route: `Batch Diesel ${batchDieselMonth}`
            });
            count++;
          }
        }
      } else {
        const lines = batchDieselText.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          const parts = line.includes('\t') ? line.split('\t') : line.split(/[,:]/);
          if (parts.length >= 2) {
            const resolved = resolvePlate(parts[0]);
            const liters = parseFloat(parts[1].trim());
            if (resolved && !isNaN(liters) && liters > 0) {
              const trk = trucks.find(t => t.plateNorm === resolved.replace(/\s+/g, ''));
              await addDieselLog({
                date: logDate,
                veh: resolved,
                drv: trk?.assignedDriverName || 'Fleet Driver',
                liters,
                cost: parseFloat((liters * KSA_DIESEL_PRICE).toFixed(2)),
                route: `Batch Diesel ${batchDieselMonth}`
              });
              count++;
            }
          }
        }
      }
      alert(`Imported diesel logs for ${count} trucks!`);
      setIsDieselBatchModalOpen(false);
      setBatchDieselText('');
    } catch (err: any) {
      alert("Error parsing fuel data: " + err.message);
    }
  };

  // -------------------------------------------------------------
  // RECONCILIATION DATA
  // -------------------------------------------------------------
  const reconData = trucks.map((t, idx) => {
    const truckKm = kmRecords
      .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm)
      .reduce((a, b) => a + (b.km || 0), 0);

    const truckLiters = dieselLogs
      .filter(d => d.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm)
      .reduce((a, b) => a + (b.liters || 0), 0);

    const allowedLiters = parseFloat((truckKm / COMPANY_KM_PER_LITER_QUOTA).toFixed(2));
    const actualEconomy = truckLiters > 0 ? parseFloat((truckKm / truckLiters).toFixed(2)) : 0;
    const fuelCost = parseFloat((truckLiters * KSA_DIESEL_PRICE).toFixed(2));
    const varianceLiters = parseFloat((truckLiters - allowedLiters).toFixed(2));
    const varianceSAR = parseFloat((varianceLiters * KSA_DIESEL_PRICE).toFixed(2));

    return {
      seq: idx + 1,
      plate: t.plate,
      driverName: t.assignedDriverName || 'Unassigned',
      km: truckKm,
      liters: truckLiters,
      allowedLiters,
      actualEconomy,
      fuelCost,
      varianceLiters,
      varianceSAR
    };
  });

  const totalActualLiters = reconData.reduce((a, b) => a + b.liters, 0);
  const totalFuelCost = reconData.reduce((a, b) => a + b.fuelCost, 0);
  const totalAllowedLiters = reconData.reduce((a, b) => a + b.allowedLiters, 0);
  const fleetAvgEconomy = totalActualLiters > 0 ? parseFloat((totalFleetKm / totalActualLiters).toFixed(2)) : 3.0;
  const netVarianceLiters = parseFloat((totalActualLiters - totalAllowedLiters).toFixed(2));
  const netVarianceSAR = parseFloat((netVarianceLiters * KSA_DIESEL_PRICE).toFixed(2));

  // -------------------------------------------------------------
  // TRACKER STATE
  // -------------------------------------------------------------
  const loggedMap: Record<string, { km: number; odo: number | null }> = {};
  kmRecords.forEach(r => {
    if (r.date === readingDate) {
      loggedMap[r.veh.toUpperCase().replace(/\s+/g, '')] = { km: r.km, odo: r.odometer };
    }
  });

  const completedList = trucks.filter(t => loggedMap[t.plateNorm] !== undefined);
  const remainingList = trucks.filter(t => loggedMap[t.plateNorm] === undefined);
  const trackerPercent = trucks.length > 0 ? Math.round((completedList.length / trucks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Global Action Bar (Exact replica of user screenshot) */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2">
            <span>🚚</span> Fleet Meter &amp; Fuel Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-assisted fleet utilization, KM history &amp; fuel reconciliation
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsWhatsRemindersModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
            title="Generate WhatsApp meter reading reminders for drivers"
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Reminders
          </button>
          <button
            onClick={() => {
              setMeterTruck(trucks[0] || null);
              setMeterInputVal('');
              setIsQuickMeterModalOpen(true);
            }}
            className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <Gauge className="w-3.5 h-3.5" /> Quick Meter Log
          </button>
          <button
            onClick={() => {
              setFuelTruck(trucks[0] || null);
              setFuelLitersVal('');
              setFuelCostVal('');
              setIsQuickFuelModalOpen(true);
            }}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <Fuel className="w-3.5 h-3.5" /> Log Fuel Fill-up
          </button>
          <button
            onClick={handleRecalculateAllKm}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1"
            title="Day N KM = Day N+1 Odo - Day N Odo"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recalculate
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Month KM (.json)
          </button>
          <button
            onClick={() => {
              const ws = XLSX.utils.json_to_sheet(kmRecords);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'KM_History');
              XLSX.writeFile(wb, `KM_History_${new Date().toISOString().substring(0, 10)}.xlsx`);
            }}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export History
          </button>
          <button
            onClick={exportPDF}
            className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" /> Download PDF
          </button>
          <button
            onClick={() => setIsFleetSetupOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" /> Fleet Setup
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition border-b-2 flex items-center gap-2 ${
            activeTab === 'dashboard' ? 'border-blue-500 text-white bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📊</span> Dashboard
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition border-b-2 flex items-center gap-2 ${
            activeTab === 'reconciliation' ? 'border-blue-500 text-white bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>⛽</span> Fuel Reconciliation
        </button>
        <button
          onClick={() => setActiveTab('entry')}
          className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition border-b-2 flex items-center gap-2 ${
            activeTab === 'entry' ? 'border-blue-500 text-white bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>➕</span> Meter Entry
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap transition border-b-2 flex items-center gap-2 ${
            activeTab === 'history' ? 'border-blue-500 text-white bg-slate-800/40' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📜</span> History
        </button>
      </div>

      {/* =========================================================
          TAB 1: DASHBOARD
          ========================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards (Exact match to screenshot) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/90 border border-slate-700/80 p-5 rounded-2xl border-l-4 border-l-blue-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">TOTAL FLEET DISTANCE</span>
              <h3 className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                {totalFleetKm.toLocaleString()} KM
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAllMonth ? 'All recorded months' : `Month: ${selectedMonth}`}
              </p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 p-5 rounded-2xl border-l-4 border-l-emerald-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">AVG KM / VEHICLE</span>
              <h3 className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                {avgKmPerTruck.toLocaleString()} KM
              </h3>
              <p className="text-xs text-slate-400 mt-1">Per active truck</p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 p-5 rounded-2xl border-l-4 border-l-amber-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">HIGH RUN (&gt;5K / MO)</span>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-1">
                {highRunCount} Trucks
              </h3>
              <p className="text-xs text-slate-400 mt-1">Vehicles needing rest</p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 p-5 rounded-2xl border-l-4 border-l-sky-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">LOW RUN (&lt;1.5K / MO)</span>
              <h3 className="text-2xl sm:text-3xl font-black text-sky-400 font-mono mt-1">
                {lowRunCount} Trucks
              </h3>
              <p className="text-xs text-slate-400 mt-1">Priority for long haul</p>
            </div>
          </div>

          {/* Intelligent Recommender Banner (Exact match to screenshot) */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm sm:text-base font-bold text-sky-400 flex items-center gap-2">
                <span>⚖️</span> Intelligent Fleet Balancing &amp; Trip Allocation
              </h3>
              <span className="text-[10px] bg-slate-800 border border-slate-600 px-2.5 py-1 rounded text-slate-300 font-mono font-bold">
                AI Recommendation
              </span>
            </div>
            <p className="text-xs text-slate-300">
              To minimize tire wear and balance fleet engine fatigue, assign upcoming high-distance long-haul dispatches to the lowest utilization trucks below:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {lowest3Available.map((item, idx) => (
                <div key={item.veh} className="bg-slate-950/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-bold text-sky-400 font-mono">PRIORITY #{idx + 1}</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/80 px-2 py-0.5 rounded font-mono font-bold">
                      Available
                    </span>
                  </div>
                  <div className="text-base font-black text-white font-mono tracking-wider mt-1">{item.veh}</div>
                  <div className="text-xs text-slate-300 mt-2 flex justify-between items-center border-t border-slate-800 pt-2">
                    <span className="text-slate-400">Period Run:</span>
                    <strong className="text-emerald-400 font-mono">{item.km.toLocaleString()} KM</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-md">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase font-mono">Timeframe:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Months</option>
                  <option value="2026-01">January 2026</option>
                  <option value="2026-02">February 2026</option>
                  <option value="2026-03">March 2026</option>
                  <option value="2026-04">April 2026</option>
                  <option value="2026-05">May 2026</option>
                  <option value="2026-06">June 2026</option>
                  <option value="2026-07">July 2026</option>
                  <option value="2026-08">August 2026</option>
                  <option value="2026-09">September 2026</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase font-mono">View Mode:</label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="split">Top 10 &amp; Bottom 10 Comparison</option>
                  <option value="all">Full Fleet Bar Chart</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase font-mono">Search:</label>
              <input
                type="text"
                value={searchAgg}
                onChange={(e) => setSearchAgg(e.target.value)}
                placeholder="Filter vehicle..."
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 font-mono"
              />
            </div>
          </div>

          {/* Split Charts View */}
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Top 10 Highest Run (KM)
                  </h3>
                  <span className="text-[11px] text-slate-400">Most Active</span>
                </div>
                <div className="relative w-full h-64">
                  <canvas ref={topBarCanvasRef} />
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Lowest 10 Run (KM)
                  </h3>
                  <span className="text-[11px] text-slate-400">Available / Low Run</span>
                </div>
                <div className="relative w-full h-64">
                  <canvas ref={lowBarCanvasRef} />
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Fleet Distribution
                  </h3>
                  <span className="text-[11px] text-slate-400">Utilization</span>
                </div>
                <div className="relative w-full h-64">
                  <canvas ref={donutCanvasRef} />
                </div>
              </div>
            </div>
          )}

          {/* Full Fleet Bar Chart View */}
          {viewMode === 'all' && (
            <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl shadow-xl space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Full Fleet Distance Distribution</h3>
                <span className="text-[11px] text-slate-400 font-mono">🟢 Low | 🔵 Moderate | 🔴 High</span>
              </div>
              <div className="relative w-full h-72">
                <canvas ref={allBarCanvasRef} />
              </div>
            </div>
          )}

          {/* Master Fleet Balancing & Analytics Table (Full HTML Feature Set) */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-4">
            {/* Header with Search and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>📋</span> Master Fleet Balancing &amp; Meter Analytics Table
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live odometer tracking &bull; Actual fuel economy (KM/L) &bull; PM intervals &bull; Smart allocation actions
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={fleetTableSearch}
                    onChange={(e) => setFleetTableSearch(e.target.value)}
                    placeholder="Search plate or driver..."
                    className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => setFleetTableFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${fleetTableFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    All ({trucks.length})
                  </button>
                  <button
                    onClick={() => setFleetTableFilter('low')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${fleetTableFilter === 'low' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Low KM / Ready
                  </button>
                  <button
                    onClick={() => setFleetTableFilter('moderate')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${fleetTableFilter === 'moderate' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Moderate
                  </button>
                  <button
                    onClick={() => setFleetTableFilter('high')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${fleetTableFilter === 'high' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    High KM / Rest
                  </button>
                </div>

                <button
                  onClick={() => {
                    const exportRows = trucks.map((t, i) => {
                      const tLogs = kmRecords
                        .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm)
                        .filter(r => isAllMonth || (r.date && r.date.startsWith(selectedMonth)))
                        .sort((a, b) => a.date.localeCompare(b.date));
                      const tDiesel = dieselLogs
                        .filter(d => d.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm)
                        .filter(d => isAllMonth || (d.date && d.date.startsWith(selectedMonth)));
                      const km = tLogs.reduce((acc, r) => acc + (r.km || 0), 0);
                      const liters = tDiesel.reduce((acc, d) => acc + (d.liters || 0), 0);
                      const odoLogs = tLogs.filter(r => r.odometer != null && !isNaN(r.odometer));
                      return {
                        'SL#': i + 1,
                        'Plate': t.plate,
                        'Description': t.description || 'Fleet Truck',
                        'Assigned Driver': t.assignedDriverName || 'Unassigned',
                        'Opening Odo': odoLogs.length > 0 ? odoLogs[0].odometer : '—',
                        'Closing Odo': odoLogs.length > 0 ? odoLogs[odoLogs.length - 1].odometer : '—',
                        'Net Distance (KM)': km,
                        'Fuel Liters': liters,
                        'KM / Liter': liters > 0 && km > 0 ? (km / liters).toFixed(2) : '—',
                        'Fuel Cost (SAR)': (liters * KSA_DIESEL_PRICE).toFixed(2),
                        'Recommended Action': km < lowLimit ? 'Assign Long Haul' : km > highLimit ? 'Rest Vehicle' : 'Standard'
                      };
                    });
                    const ws = XLSX.utils.json_to_sheet(exportRows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Master_Fleet_Balancing');
                    XLSX.writeFile(wb, `Master_Fleet_Balancing_${selectedMonth}_${new Date().toISOString().substring(0, 10)}.xlsx`);
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                  title="Export this master table to Excel"
                >
                  <Download className="w-3.5 h-3.5" /> Export Excel
                </button>
              </div>
            </div>

            {/* Scrollable Master Table */}
            <div className="overflow-x-auto max-h-[580px] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                  <tr>
                    <th className="p-3 w-10 text-center">SL</th>
                    <th className="p-3 w-40">Truck &amp; Model</th>
                    <th className="p-3 w-44">Dedicated Driver</th>
                    <th className="p-3 w-28 text-right">Opening Odo</th>
                    <th className="p-3 w-28 text-right">Closing Odo</th>
                    <th className="p-3 w-36 text-right">Net Distance</th>
                    <th className="p-3 w-24 text-right">Fuel (L)</th>
                    <th className="p-3 w-24 text-center">Economy</th>
                    <th className="p-3 w-24 text-right">Diesel SAR</th>
                    <th className="p-3 w-32 text-center">PM Interval</th>
                    <th className="p-3 w-40">Allocation Action</th>
                    <th className="p-3 w-36 text-center">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {trucks
                    .map((t, index) => {
                      const tLogs = kmRecords
                        .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm)
                        .filter(r => isAllMonth || (r.date && r.date.startsWith(selectedMonth)))
                        .sort((a, b) => a.date.localeCompare(b.date));

                      const tDiesel = dieselLogs
                        .filter(d => d.veh.toUpperCase().replace(/\s+/g, '') === t.plateNorm)
                        .filter(d => isAllMonth || (d.date && d.date.startsWith(selectedMonth)));

                      const netKm = tLogs.reduce((acc, r) => acc + (r.km || 0), 0);
                      const totalLiters = tDiesel.reduce((acc, d) => acc + (d.liters || 0), 0);
                      const actualEconomy = totalLiters > 0 && netKm > 0 ? parseFloat((netKm / totalLiters).toFixed(2)) : 0;
                      const fuelCost = parseFloat((totalLiters * KSA_DIESEL_PRICE).toFixed(2));

                      const odoLogs = tLogs.filter(r => r.odometer != null && !isNaN(r.odometer));
                      const openingOdo = odoLogs.length > 0 ? odoLogs[0].odometer : null;
                      const closingOdo = odoLogs.length > 0 ? odoLogs[odoLogs.length - 1].odometer : null;

                      // PM Interval calculation (every 15,000 km)
                      const currentOdo = closingOdo || (openingOdo || 100000);
                      const kmSinceService = currentOdo % 15000;
                      const kmToNextService = 15000 - kmSinceService;
                      const serviceDue = kmToNextService < 1500;

                      const isLow = netKm < lowLimit;
                      const isHigh = netKm > highLimit;
                      const utilStatus = isLow ? 'low' : isHigh ? 'high' : 'moderate';

                      const driverObj = drivers.find(d => d.name === t.assignedDriverName || (d.assignedVehiclePlate && d.assignedVehiclePlate.replace(/\s+/g, '') === t.plateNorm));

                      return {
                        truck: t,
                        index,
                        netKm,
                        totalLiters,
                        actualEconomy,
                        fuelCost,
                        openingOdo,
                        closingOdo,
                        kmToNextService,
                        serviceDue,
                        isLow,
                        isHigh,
                        utilStatus,
                        driverObj
                      };
                    })
                    .filter(item => {
                      if (fleetTableFilter === 'low' && !item.isLow) return false;
                      if (fleetTableFilter === 'high' && !item.isHigh) return false;
                      if (fleetTableFilter === 'moderate' && (item.isLow || item.isHigh)) return false;
                      if (fleetTableSearch) {
                        const q = fleetTableSearch.toLowerCase();
                        const matchPlate = item.truck.plate.toLowerCase().includes(q);
                        const matchDriver = item.truck.assignedDriverName?.toLowerCase().includes(q);
                        if (!matchPlate && !matchDriver) return false;
                      }
                      return true;
                    })
                    .map(({ truck, index, netKm, totalLiters, actualEconomy, fuelCost, openingOdo, closingOdo, kmToNextService, serviceDue, isLow, isHigh, driverObj }) => {
                      return (
                        <tr key={truck.id} className="hover:bg-slate-800/60 transition group">
                          {/* SL */}
                          <td className="p-3 text-center font-mono text-slate-400">#{index + 1}</td>

                          {/* Truck Plate & Model */}
                          <td className="p-3">
                            <div className="font-bold text-white font-mono text-sm tracking-wide">{truck.plate}</div>
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5 truncate max-w-[140px]">
                              {truck.description || 'Actros 3340 Flatbed'}
                            </div>
                          </td>

                          {/* Dedicated Driver */}
                          <td className="p-3">
                            {driverObj ? (
                              <div>
                                <div className="font-bold text-slate-200 text-xs truncate max-w-[150px]">{driverObj.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
                                    {driverObj.empNo}
                                  </span>
                                  {driverObj.mobile && (
                                    <button
                                      onClick={() => sendWhatsAppReminder(truck.plate)}
                                      className="text-emerald-400 hover:text-emerald-300 text-[10px] font-mono flex items-center gap-0.5"
                                      title="Send WhatsApp meter request"
                                    >
                                      <Phone className="w-2.5 h-2.5" /> WA
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                            )}
                          </td>

                          {/* Opening Odo */}
                          <td className="p-3 text-right font-mono text-slate-400">
                            {openingOdo != null ? openingOdo.toLocaleString() : '—'}
                          </td>

                          {/* Closing Odo */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-mono font-bold text-white">
                                {closingOdo != null ? closingOdo.toLocaleString() : '—'}
                              </span>
                              <button
                                onClick={() => {
                                  setMeterTruck(truck);
                                  setMeterInputVal(closingOdo ? String(closingOdo) : '');
                                  setIsQuickMeterModalOpen(true);
                                }}
                                className="text-sky-400 hover:text-sky-300 p-1 rounded bg-slate-900 border border-slate-700 transition"
                                title="Quick update meter reading"
                              >
                                <Gauge className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Net Distance KM */}
                          <td className="p-3 text-right">
                            <div className="font-mono font-bold text-slate-100 text-sm">
                              {netKm.toLocaleString()} KM
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  isLow ? 'bg-emerald-400' : isHigh ? 'bg-rose-500' : 'bg-sky-400'
                                }`}
                                style={{ width: `${Math.min(100, Math.round((netKm / (highLimit * 1.2)) * 100))}%` }}
                              />
                            </div>
                          </td>

                          {/* Fuel Liters */}
                          <td className="p-3 text-right font-mono text-amber-300 font-semibold">
                            {totalLiters > 0 ? `${totalLiters.toLocaleString()} L` : '—'}
                          </td>

                          {/* Economy KM/L */}
                          <td className="p-3 text-center">
                            {actualEconomy > 0 ? (
                              <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                actualEconomy >= 3.0
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : actualEconomy >= 2.5
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}>
                                {actualEconomy}
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono text-[11px]">3.00*</span>
                            )}
                          </td>

                          {/* Diesel Cost SAR */}
                          <td className="p-3 text-right font-mono text-slate-300">
                            {fuelCost > 0 ? `${fuelCost.toLocaleString()} SAR` : '—'}
                          </td>

                          {/* PM Interval */}
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              serviceDue
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                : 'bg-slate-900 text-slate-300 border border-slate-700'
                            }`}>
                              {serviceDue ? '⚠️ PM Due Soon' : `OK (${kmToNextService.toLocaleString()} km)`}
                            </span>
                          </td>

                          {/* Recommended Action */}
                          <td className="p-3 text-xs font-semibold">
                            {isLow && (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <span>🎯</span> Assign Long Haul
                              </span>
                            )}
                            {isHigh && (
                              <span className="text-rose-400 flex items-center gap-1">
                                <span>🛑</span> Rest / Short Shunt
                              </span>
                            )}
                            {!isLow && !isHigh && (
                              <span className="text-sky-300 flex items-center gap-1">
                                <span>⚖️</span> Balanced Rotation
                              </span>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setMeterTruck(truck);
                                  setMeterInputVal(closingOdo ? String(closingOdo) : '');
                                  setIsQuickMeterModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-800/80 text-sky-300 border border-sky-700/60 transition"
                                title="Log Odometer"
                              >
                                <Gauge className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setFuelTruck(truck);
                                  setFuelLitersVal('');
                                  setFuelCostVal('');
                                  setIsQuickFuelModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-800/80 text-amber-300 border border-amber-700/60 transition"
                                title="Log Fuel Fill-up"
                              >
                                <Fuel className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => sendWhatsAppReminder(truck.plate)}
                                className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-800/80 text-emerald-300 border border-emerald-700/60 transition"
                                title="WhatsApp Driver"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setHistoryTruck(truck);
                                  setIsTruckHistoryModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                title="View History &amp; Logs"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 2: FUEL RECONCILIATION
          ========================================================= */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          {/* Banner */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white p-5 rounded-2xl shadow-xl flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-white/20 rounded-xl">⛽</span>
              <div>
                <h3 className="font-bold text-base font-mono">KSA Fuel Policy &amp; Fleet Efficiency Standard</h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Official Diesel Price: <strong className="text-white">1.79 SAR / Liter</strong> &bull; Company Quota: <strong className="text-white">1 Liter = 3.0 KM</strong> (0.597 SAR / KM)
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(reconData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Fuel_Reconciliation');
                XLSX.writeFile(wb, `Fuel_Reconciliation_${new Date().toISOString().substring(0, 10)}.xlsx`);
              }}
              className="bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-slate-100 transition"
            >
              📥 Export Fuel Report (Excel)
            </button>
          </div>

          {/* 4 KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl border-l-4 border-l-amber-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">FLEET FUEL ECONOMY</span>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl sm:text-3xl font-black text-white font-mono">{fleetAvgEconomy} KM/L</h3>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                  fleetAvgEconomy >= 3.0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  Target: 3.00
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Average across active fleet</p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl border-l-4 border-l-red-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">TOTAL FUEL EXPENDITURE</span>
              <h3 className="text-2xl sm:text-3xl font-black text-rose-400 font-mono mt-1">
                SAR {totalFuelCost.toLocaleString()}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{totalActualLiters.toLocaleString()} Liters dispensed</p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl border-l-4 border-l-blue-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">ALLOWED QUOTA (3 KM/L)</span>
              <h3 className="text-2xl sm:text-3xl font-black text-blue-400 font-mono mt-1">
                {Math.round(totalAllowedLiters).toLocaleString()} Liters
              </h3>
              <p className="text-xs text-slate-400 mt-1">SAR {Math.round(totalAllowedLiters * KSA_DIESEL_PRICE).toLocaleString()} budget</p>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl border-l-4 border-l-purple-500 shadow-xl">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">NET FLEET FUEL VARIANCE</span>
              <h3 className={`text-2xl sm:text-3xl font-black font-mono mt-1 ${
                netVarianceLiters > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {netVarianceLiters > 0 ? '+' : ''}{Math.round(netVarianceLiters).toLocaleString()} L
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {netVarianceLiters > 0 ? '⚠️ Over quota limit' : '🟢 Saved under 3.0 KM/L standard'}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 pb-2 border-b border-slate-700">
              <div>
                <h3 className="font-bold text-white text-sm">Truck-by-Truck Fuel Reconciliation &amp; Direct Economy Calculation</h3>
                <p className="text-xs text-slate-400 mt-0.5">Calculated from logged distance and fuel consumption</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDieselBatchModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow flex items-center gap-1"
                >
                  📥 Batch Fuel Entry / JSON
                </button>
                <input
                  type="text"
                  value={searchRecon}
                  onChange={(e) => setSearchRecon(e.target.value)}
                  placeholder="Filter vehicle plate..."
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 font-mono"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Vehicle Plate</th>
                    <th className="p-3 text-right">Distance (KM)</th>
                    <th className="p-3 text-right">Diesel Consumed (L)</th>
                    <th className="p-3 text-right">Allowed (L @ 3 KM/L)</th>
                    <th className="p-3 text-right">Actual Economy</th>
                    <th className="p-3 text-right">Fuel Cost (SAR)</th>
                    <th className="p-3 text-right">Variance (L / SAR)</th>
                    <th className="p-3 text-center">Compliance Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {reconData
                    .filter(r => !searchRecon || r.plate.toLowerCase().includes(searchRecon.toLowerCase()))
                    .map((r, idx) => {
                      const kmPerL = r.actualEconomy;
                      return (
                        <tr key={r.plate} className="hover:bg-slate-800/60 transition">
                          <td className="p-3 text-slate-400 font-mono">#{idx + 1}</td>
                          <td className="p-3 font-bold text-white font-mono text-sm">{r.plate}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-200">{Math.round(r.km).toLocaleString()} KM</td>
                          <td className="p-3 text-right font-mono font-bold text-blue-400">
                            {r.liters > 0 ? `${Math.round(r.liters).toLocaleString()} L` : '0 L'}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-400">{Math.round(r.allowedLiters).toLocaleString()} L</td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            kmPerL >= 3.0 ? 'text-emerald-400' : kmPerL < 2.7 && r.liters > 0 ? 'text-rose-400' : 'text-amber-400'
                          }`}>
                            {r.liters > 0 ? `${kmPerL} KM/L` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-white">
                            {r.fuelCost > 0 ? `SAR ${Math.round(r.fuelCost).toLocaleString()}` : '—'}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold ${
                            r.varianceLiters <= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {r.liters > 0 ? `${r.varianceLiters > 0 ? '+' : ''}${Math.round(r.varianceLiters)} L` : '—'}
                          </td>
                          <td className="p-3 text-center">
                            {r.liters === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-slate-400">Pending Log</span>
                            ) : kmPerL >= 3.0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">🟢 Compliant</span>
                            ) : kmPerL >= 2.7 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">🟡 Minor Var</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">🔴 High Use</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                const lStr = prompt(`Enter liters consumed for ${r.plate}:`, '150');
                                if (!lStr) return;
                                const l = parseFloat(lStr);
                                if (isNaN(l) || l <= 0) return alert("Invalid liters");
                                addDieselLog({
                                  date: `${new Date().toISOString().substring(0, 7)}-15`,
                                  veh: r.plate,
                                  drv: r.driverName,
                                  liters: l,
                                  cost: parseFloat((l * KSA_DIESEL_PRICE).toFixed(2)),
                                  route: 'Manual Fuel Entry'
                                });
                              }}
                              className="text-blue-400 hover:text-blue-300 font-semibold"
                            >
                              ➕ Log Fuel
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
      )}

      {/* =========================================================
          TAB 3: METER ENTRY (Fast Logger + Progress Tracker)
          ========================================================= */}
      {activeTab === 'entry' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Fast Logger Form */}
          <div className="lg:col-span-5 bg-slate-800/90 border border-slate-700 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-700">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>📟</span> Fast KM Meter Logger
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Quick entry with instant plate autocomplete</p>
              </div>
              <span className="bg-blue-500/20 text-blue-400 text-xs font-mono font-bold px-2 py-0.5 rounded border border-blue-500/40">
                ⚡ Press Enter
              </span>
            </div>

            <form onSubmit={handleMeterSubmit} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase font-mono text-slate-400">Reading Date</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReadingDate(new Date().toISOString().substring(0, 10))}
                      className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded font-semibold"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(); d.setDate(d.getDate() - 1);
                        setReadingDate(d.toISOString().substring(0, 10));
                      }}
                      className="text-[11px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded font-semibold"
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase font-mono text-slate-400">Truck Plate (Search by number)</label>
                  {matchedPlateBadge && <span className="text-xs font-bold text-emerald-400 font-mono">{matchedPlateBadge}</span>}
                </div>
                <div className="relative">
                  <input
                    id="km-plate-input"
                    list="dl-vehicles-fast"
                    value={plateInput}
                    onChange={(e) => handlePlateInput(e.target.value)}
                    onKeyDown={handlePlateKeyDown}
                    required
                    placeholder="Type number e.g. 1196 or SSA 1196"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white font-mono focus:outline-none focus:border-blue-500 uppercase pr-8"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tip: Type e.g. <strong className="text-slate-200 font-mono">1196</strong> and press <kbd className="bg-slate-700 px-1 py-0.5 rounded text-[10px]">Enter</kbd> to auto-fill the full plate.
                </p>

                {previousReadingInfo && (
                  <div className="mt-2 p-2.5 bg-blue-950/60 border border-blue-900 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-400 font-mono">Previous Reading</span>
                      <div className="text-xs text-slate-300 font-mono">{previousReadingInfo.date}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-blue-300">{previousReadingInfo.odo.toLocaleString()}</span>
                      <span className="text-[10px] text-blue-400 ml-1 font-mono">KM</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase font-mono text-slate-400 mb-1">Today's Odometer Reading</label>
                <div className="relative">
                  <input
                    id="km-reading-input"
                    type="number"
                    step="0.1"
                    value={odometerInput}
                    onChange={(e) => setOdometerInput(e.target.value)}
                    required
                    placeholder="e.g. 145000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-lg font-bold text-blue-400 font-mono focus:outline-none focus:border-blue-500 pr-12"
                  />
                  <span className="absolute right-3 top-3.5 text-xs font-bold text-slate-500 font-mono">KM</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Formula: Day N KM = Day N+1 Odometer &minus; Day N Odometer
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs"
              >
                💾 Save Reading &amp; Next (Enter)
              </button>
            </form>

            <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  const todays = kmRecords.filter(r => r.date === readingDate);
                  const ws = XLSX.utils.json_to_sheet(todays);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Readings');
                  XLSX.writeFile(wb, `KM_Readings_${readingDate}.xlsx`);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                📥 Export Readings to Excel
              </button>
              <span className="text-slate-500 font-mono text-[11px]">Cursor loops automatically</span>
            </div>
          </div>

          {/* Fleet Status Tracker */}
          <div className="lg:col-span-7 bg-slate-800/90 border border-slate-700 p-6 rounded-2xl shadow-xl flex flex-col min-h-[480px] space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>📊</span> Fleet Entry Status Tracker
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Selected Date: <strong className="text-blue-400 font-mono">{readingDate}</strong></p>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                trackerPercent === 100 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {trackerPercent}% Complete
              </span>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <span className="text-emerald-400">🟢 Completed: {completedList.length} / {trucks.length}</span>
                <span className="text-amber-400">⏳ Remaining: {remainingList.length} Trucks</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${trackerPercent}%` }}
                />
              </div>
            </div>

            {/* Tracker Filter Tabs */}
            <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-700">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setTrackerFilter('remaining')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                    trackerFilter === 'remaining' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  ⏳ Remaining ({remainingList.length})
                </button>
                <button
                  onClick={() => setTrackerFilter('completed')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                    trackerFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  🟢 Completed ({completedList.length})
                </button>
                <button
                  onClick={() => setTrackerFilter('all')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                    trackerFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  All ({trucks.length})
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleMarkMissingIdle}
                  className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                >
                  💤 Mark Missing as Idle (0 KM)
                </button>
                <input
                  type="text"
                  value={trackerSearch}
                  onChange={(e) => setTrackerSearch(e.target.value)}
                  placeholder="Filter truck..."
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-32 font-mono"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 custom-scrollbar">
              {(trackerFilter === 'remaining' ? remainingList : trackerFilter === 'completed' ? completedList : trucks)
                .filter(t => !trackerSearch || t.plate.toLowerCase().includes(trackerSearch.toLowerCase()))
                .map(t => {
                  const logged = loggedMap[t.plateNorm];
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex flex-wrap justify-between items-center gap-2 ${
                        logged ? 'bg-slate-900/60 border-emerald-500/30' : 'bg-slate-900 border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${logged ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white font-mono text-sm">{t.plate}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              logged ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                            }`}>
                              {logged ? '✅ Logged' : '⏳ Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Driver: <strong className="text-slate-200">{t.assignedDriverName || 'Unassigned'}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {logged ? (
                          <div className="flex flex-col text-right font-mono">
                            <span className="text-[10px] text-slate-400">Odo: {logged.odo ? logged.odo.toLocaleString() : '—'}</span>
                            <span className="text-xs font-bold text-emerald-400">+{logged.km} KM</span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setPlateInput(t.plate);
                                handlePlateInput(t.plate);
                                const odoEl = document.getElementById('km-reading-input');
                                if (odoEl) odoEl.focus();
                              }}
                              className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded text-xs font-bold transition"
                            >
                              ➕ Log
                            </button>
                            <button
                              onClick={() => sendWhatsAppReminder(t.plate)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-xs font-bold shadow transition flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> WhatsApp
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TAB 4: HISTORY
          ========================================================= */}
      {activeTab === 'history' && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-slate-700">
            <h3 className="font-bold text-white text-sm">KM Reading History ({kmRecords.length})</h3>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={searchHist}
                onChange={(e) => setSearchHist(e.target.value)}
                placeholder="Filter plate or date..."
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 font-mono"
              />
              <button
                onClick={() => {
                  if (confirm("Delete all KM history records?")) {
                    kmRecords.forEach(r => deleteKmRecord(r.id));
                  }
                }}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Clear All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider sticky top-0 z-10 border-b border-slate-700">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Odometer</th>
                  <th className="p-3">Distance (KM)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {kmRecords
                  .filter(r => !searchHist || r.veh.toLowerCase().includes(searchHist.toLowerCase()) || r.date.includes(searchHist))
                  .slice(0, 800)
                  .map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/60 transition">
                      <td className="p-3 font-mono text-slate-400">{r.date}</td>
                      <td className="p-3 font-bold text-white font-mono">{r.veh}</td>
                      <td className="p-3 font-mono text-slate-300">
                        {r.odometer != null ? r.odometer.toLocaleString() : '—'}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-400">+{r.km.toLocaleString()} KM</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => deleteKmRecord(r.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: UPLOAD MONTH KM DATA (.json)
          ========================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Upload Monthly KM Data (.json)</h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Target Month</label>
              <select
                value={uploadMonthSelect}
                onChange={(e) => setUploadMonthSelect(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="auto">⚡ Auto-Detect Month from JSON Key</option>
                <option value="2026-01">January 2026</option>
                <option value="2026-02">February 2026</option>
                <option value="2026-03">March 2026</option>
                <option value="2026-04">April 2026</option>
                <option value="2026-05">May 2026</option>
                <option value="2026-06">June 2026</option>
                <option value="2026-07">July 2026</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-09">September 2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Paste JSON Data</label>
              <textarea
                rows={6}
                value={uploadJsonText}
                onChange={(e) => setUploadJsonText(e.target.value)}
                placeholder='{"August - 2026": [{"Truck Plate#": "D J A 4827", "Total KM/M": 15400}]}'
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleMonthlyKmUpload}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow"
              >
                Compile &amp; Integrate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: BATCH DIESEL ENTRY
          ========================================================= */}
      {isDieselBatchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Batch Fuel Entry / JSON Upload</h3>
              <button onClick={() => setIsDieselBatchModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Target Month</label>
              <input
                type="month"
                value={batchDieselMonth}
                onChange={(e) => setBatchDieselMonth(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Paste JSON or Tab-Separated Data</label>
              <textarea
                rows={6}
                value={batchDieselText}
                onChange={(e) => setBatchDieselText(e.target.value)}
                placeholder='Example JSON:&#10;{ "D J A 4827": 150, "K R A 7501": 210 }&#10;&#10;Or TSV Lines:&#10;D J A 4827	150&#10;K R A 7501	210'
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDieselBatchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDieselImport}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow"
              >
                Import &amp; Calculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: FLEET SETUP
          ========================================================= */}
      {isFleetSetupOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <span>⚙️</span> Fleet Setup
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage vehicles and drivers stored in your central system</p>
              </div>
              <button onClick={() => setIsFleetSetupOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-slate-800 px-5 bg-slate-900">
              <button
                onClick={() => setFleetSetupTab('vehicles')}
                className={`px-4 py-3 text-xs font-bold border-b-2 transition ${
                  fleetSetupTab === 'vehicles' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                🚚 Vehicles ({trucks.length})
              </button>
              <button
                onClick={() => setFleetSetupTab('drivers')}
                className={`px-4 py-3 text-xs font-bold border-b-2 transition ${
                  fleetSetupTab === 'drivers' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                👤 Drivers ({drivers.length})
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {fleetSetupTab === 'vehicles' && (
                <div className="space-y-4">
                  {/* Add form */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const p = newVehPlate.trim().toUpperCase();
                      if (!p) return;
                      await saveTruck({
                        id: `trk-${Date.now().toString(36)}`,
                        seq: trucks.length + 1,
                        plate: p,
                        plateNorm: p.replace(/\s+/g, ''),
                        type: 'Truck',
                        description: newVehDesc || 'Fleet Truck',
                        status: 'ACTIVE'
                      });
                      setNewVehPlate('');
                      setNewVehDesc('');
                      alert(`Vehicle ${p} added!`);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700 items-end"
                  >
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Plate Number</label>
                      <input
                        value={newVehPlate}
                        onChange={(e) => setNewVehPlate(e.target.value)}
                        placeholder="e.g. S S A 1200"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Description</label>
                      <input
                        value={newVehDesc}
                        onChange={(e) => setNewVehDesc(e.target.value)}
                        placeholder="Actros Flatbed"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg shadow">
                      Save Vehicle
                    </button>
                  </form>

                  {/* List */}
                  <div className="overflow-x-auto max-h-72 custom-scrollbar border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Plate</th>
                          <th className="p-3">Assigned Driver</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {trucks.map((v, i) => (
                          <tr key={v.id} className="hover:bg-slate-800/50">
                            <td className="p-3 text-slate-400 font-mono">#{i + 1}</td>
                            <td className="p-3 font-bold text-white font-mono">{v.plate}</td>
                            <td className="p-3">
                              <select
                                value={v.assignedDriverId || ''}
                                onChange={async (e) => {
                                  const dId = e.target.value;
                                  const drv = drivers.find(d => d.id === dId);
                                  await saveTruck({
                                    ...v,
                                    assignedDriverId: dId || null,
                                    assignedDriverName: drv ? drv.name : null
                                  });
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                              >
                                <option value="">— No Driver —</option>
                                {drivers.map(d => (
                                  <option key={d.id} value={d.id}>{d.name} ({d.empNo})</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => { if (confirm(`Remove vehicle ${v.plate}?`)) deleteTruck(v.id); }}
                                className="text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {fleetSetupTab === 'drivers' && (
                <div className="space-y-4">
                  {/* Add form */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const n = newDrvName.trim().toUpperCase();
                      if (!n) return;
                      await saveDriver({
                        id: `drv-${Date.now().toString(36)}`,
                        seq: drivers.length + 1,
                        name: n,
                        nameNorm: n,
                        empNo: newDrvEmpNo || `L-EMP${String(drivers.length + 1).padStart(4, '0')}`,
                        iqama: '',
                        nationality: 'PAKISTAN',
                        mobile: newDrvMobile,
                        transporter: 'TLS',
                        workingFor: 'KSA - Local Supplies',
                        status: 'AVAILABLE',
                        active: true
                      });
                      setNewDrvName('');
                      setNewDrvEmpNo('');
                      setNewDrvMobile('');
                      alert(`Driver ${n} registered!`);
                    }}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700 items-end"
                  >
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Driver Name</label>
                      <input
                        value={newDrvName}
                        onChange={(e) => setNewDrvName(e.target.value)}
                        placeholder="e.g. TAHIR MEHMOOD"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Mobile</label>
                      <input
                        value={newDrvMobile}
                        onChange={(e) => setNewDrvMobile(e.target.value)}
                        placeholder="05XXXXXXXX"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg shadow">
                      Save Driver
                    </button>
                  </form>

                  {/* List */}
                  <div className="overflow-x-auto max-h-72 custom-scrollbar border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Driver Name</th>
                          <th className="p-3">Emp No</th>
                          <th className="p-3">Mobile</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {drivers.map((d, i) => (
                          <tr key={d.id} className="hover:bg-slate-800/50">
                            <td className="p-3 text-slate-400 font-mono">#{i + 1}</td>
                            <td className="p-3 font-bold text-white">{d.name}</td>
                            <td className="p-3 font-mono text-blue-400">{d.empNo}</td>
                            <td className="p-3 font-mono text-slate-300">{d.mobile || '—'}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => { if (confirm(`Remove driver ${d.name}?`)) deleteDriver(d.id); }}
                                className="text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={exportFullBackup}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow"
              >
                📦 Export Backup
              </button>
              <button
                onClick={() => setIsFleetSetupOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: QUICK METER ENTRY
          ========================================================= */}
      {isQuickMeterModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Gauge className="w-5 h-5 text-sky-400" /> Log Meter Reading
              </h3>
              <button onClick={() => setIsQuickMeterModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!meterTruck) return;
                const odo = parseFloat(meterInputVal);
                if (isNaN(odo) || odo <= 0) {
                  alert("Please enter a valid positive odometer reading.");
                  return;
                }

                // Check prior reading
                const past = kmRecords
                  .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === meterTruck.plateNorm && r.date < meterDate && r.odometer != null)
                  .sort((a, b) => a.date.localeCompare(b.date));
                const prevLog = past.length ? past[past.length - 1] : null;

                if (prevLog && prevLog.odometer! > 0 && odo < prevLog.odometer!) {
                  if (!confirm(`Warning: Entered odometer (${odo.toLocaleString()}) is LESS than previous reading (${prevLog.odometer!.toLocaleString()} on ${prevLog.date}). Rollover or typo? Continue?`)) {
                    return;
                  }
                }

                const netKmCalculated = prevLog && prevLog.odometer! > 0 && odo >= prevLog.odometer!
                  ? parseFloat((odo - prevLog.odometer!).toFixed(1))
                  : 0;

                await addKmRecord({
                  date: meterDate,
                  veh: meterTruck.plate,
                  odometer: odo,
                  km: netKmCalculated,
                  driver: meterTruck.assignedDriverName || 'Driver',
                  notes: 'Quick Meter Log Entry'
                });

                alert(`Successfully logged ${odo.toLocaleString()} KM for ${meterTruck.plate}! (Net Run: +${netKmCalculated.toLocaleString()} KM)`);
                setIsQuickMeterModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Select Vehicle</label>
                <select
                  value={meterTruck?.id || ''}
                  onChange={(e) => {
                    const found = trucks.find(t => t.id === e.target.value);
                    setMeterTruck(found || null);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                >
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>{t.plate} &bull; {t.assignedDriverName || 'Unassigned'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Reading Date</label>
                <input
                  type="date"
                  value={meterDate}
                  onChange={(e) => setMeterDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Current Odometer (KM)</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 154200"
                  value={meterInputVal}
                  onChange={(e) => setMeterInputVal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Assigned Driver:</span>
                  <span className="font-bold text-white">{meterTruck?.assignedDriverName || '—'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Validation:</span>
                  <span className="text-emerald-400 font-mono">Fraud &amp; Rollover Protected</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickMeterModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Meter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: QUICK FUEL FILL-UP
          ========================================================= */}
      {isQuickFuelModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Fuel className="w-5 h-5 text-amber-400" /> Log Diesel Fill-up
              </h3>
              <button onClick={() => setIsQuickFuelModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!fuelTruck) return;
                const liters = parseFloat(fuelLitersVal);
                if (isNaN(liters) || liters <= 0) {
                  alert("Please enter a valid fuel liter amount.");
                  return;
                }
                const cost = fuelCostVal ? parseFloat(fuelCostVal) : parseFloat((liters * KSA_DIESEL_PRICE).toFixed(2));

                await addDieselLog({
                  date: fuelDate,
                  veh: fuelTruck.plate,
                  drv: fuelTruck.assignedDriverName || 'Driver',
                  liters,
                  cost,
                  route: fuelStationVal ? `${fuelStationVal} (Receipt #${fuelReceiptVal || 'N/A'})` : 'Station Fill-up'
                });

                alert(`Successfully logged ${liters} Liters (${cost} SAR) for ${fuelTruck.plate}!`);
                setIsQuickFuelModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Select Vehicle</label>
                <select
                  value={fuelTruck?.id || ''}
                  onChange={(e) => {
                    const found = trucks.find(t => t.id === e.target.value);
                    setFuelTruck(found || null);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>{t.plate} &bull; {t.assignedDriverName || 'Unassigned'}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Date</label>
                  <input
                    type="date"
                    value={fuelDate}
                    onChange={(e) => setFuelDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Liters Filled</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 180"
                    value={fuelLitersVal}
                    onChange={(e) => {
                      const l = e.target.value;
                      setFuelLitersVal(l);
                      const num = parseFloat(l);
                      if (!isNaN(num)) {
                        setFuelCostVal((num * KSA_DIESEL_PRICE).toFixed(2));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Cost (SAR @ 1.79)</label>
                  <input
                    type="number"
                    step="any"
                    value={fuelCostVal}
                    onChange={(e) => setFuelCostVal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Receipt / Card #</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-9481"
                    value={fuelReceiptVal}
                    onChange={(e) => setFuelReceiptVal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase font-mono mb-1">Fuel Station</label>
                <select
                  value={fuelStationVal}
                  onChange={(e) => setFuelStationVal(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="Yanbu Aramco Depot">Yanbu Aramco Depot</option>
                  <option value="Naft Station Yanbu">Naft Station Yanbu</option>
                  <option value="Petromin Expressway">Petromin Expressway</option>
                  <option value="SASCO Highway Station">SASCO Highway Station</option>
                  <option value="Aldrees Diesel Center">Aldrees Diesel Center</option>
                  <option value="Jeddah Central Hub">Jeddah Central Hub</option>
                  <option value="Riyadh Main Terminal">Riyadh Main Terminal</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickFuelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Fuel Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: WHATSAPP DRIVER REMINDERS TOOL
          ========================================================= */}
      {isWhatsRemindersModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" /> Driver WhatsApp Reminders Tool
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Request meter readings from drivers via WhatsApp in English, Urdu or Hindi
                </p>
              </div>
              <button onClick={() => setIsWhatsRemindersModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              {/* Language Selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-400 uppercase font-mono">Template Language:</label>
                <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => setWhatsReminderLang('english')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${whatsReminderLang === 'english' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    onClick={() => setWhatsReminderLang('urdu')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${whatsReminderLang === 'urdu' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    🇵🇰 Urdu (اردو)
                  </button>
                  <button
                    onClick={() => setWhatsReminderLang('hindi')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${whatsReminderLang === 'hindi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    🇮🇳 Hindi (हिंदी)
                  </button>
                </div>
              </div>

              {/* Message Preview */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-300 whitespace-pre-line">
                {whatsReminderLang === 'english' && `🚚 *TLS FLEET - METER READING REQUEST*\n================================\nDear Driver, please send your current meter reading with a photo of the truck dashboard today.\n\nThank you,\nTLS Fleet Management`}
                {whatsReminderLang === 'urdu' && `🚚 *ٹی ایل ایس لاجسٹکس - میٹر ریڈنگ درخواست*\n================================\nمحترم ڈرائیور، براہ کرم آج اپنی گاڑی کی میٹر ریڈنگ اور ڈیش بورڈ کی تصویر واٹس ایپ کریں۔\n\nشکریہ،\nٹی ایل ایس فلیٹ مینجمنٹ`}
                {whatsReminderLang === 'hindi' && `🚚 *TLS बेड़ा - मीटर रीडिंग अनुरोध*\n================================\nप्रिय ड्राइवर, कृपया आज अपने ट्रक का मीटर रीडिंग और डैशबोर्ड की फोटो भेजें।\n\nधन्यवाद,\nTLS बेड़ा प्रबंधन`}
              </div>

              {/* Driver list */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Active Fleet Drivers ({trucks.length})
                </h4>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                  {trucks.map(t => {
                    const drv = drivers.find(d => d.name === t.assignedDriverName || (d.assignedVehiclePlate && d.assignedVehiclePlate.replace(/\s+/g, '') === t.plateNorm));
                    const phone = drv?.mobile || '';
                    return (
                      <div key={t.id} className="p-3 bg-slate-900/60 flex items-center justify-between hover:bg-slate-800/60 transition text-xs">
                        <div>
                          <div className="font-bold text-white font-mono">{t.plate} &bull; {drv?.name || 'Unassigned'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Mobile: {phone || 'No mobile saved'}</div>
                        </div>
                        <button
                          onClick={() => sendWhatsAppReminder(t.plate)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition"
                        >
                          <Phone className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsWhatsRemindersModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: TRUCK HISTORY & LOGS
          ========================================================= */}
      {isTruckHistoryModalOpen && historyTruck && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-400" /> {historyTruck.plate} &bull; Lifecycle Logs
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Driver: <strong className="text-white">{historyTruck.assignedDriverName || 'Unassigned'}</strong> &bull; {historyTruck.description || 'Fleet Truck'}
                </p>
              </div>
              <button onClick={() => setIsTruckHistoryModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                Odometer &amp; Distance History ({kmRecords.filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === historyTruck.plateNorm).length} Entries)
              </h4>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 font-mono">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5 text-right">Odometer</th>
                      <th className="p-2.5 text-right">Distance (KM)</th>
                      <th className="p-2.5">Notes</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {kmRecords
                      .filter(r => r.veh.toUpperCase().replace(/\s+/g, '') === historyTruck.plateNorm)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(r => (
                        <tr key={r.id} className="hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono text-slate-300">{r.date}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-white">
                            {r.odometer != null ? r.odometer.toLocaleString() : '—'}
                          </td>
                          <td className="p-2.5 text-right font-mono text-sky-400 font-bold">
                            +{r.km.toLocaleString()} KM
                          </td>
                          <td className="p-2.5 text-slate-400 text-[11px]">{r.notes || 'Logged'}</td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => {
                                if (confirm("Delete this KM log?")) deleteKmRecord(r.id);
                              }}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsTruckHistoryModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Datalist for fast plate autocomplete */}
      <datalist id="dl-vehicles-fast">
        {trucks.map(t => (
          <option key={t.id} value={t.plate}>{t.assignedDriverName || 'Available'}</option>
        ))}
      </datalist>
    </div>
  );
};
