import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { TimetableRow } from '../types';
import * as XLSX from 'xlsx';
import {
  Calendar, FileSpreadsheet, Plus, Download, Copy, Trash2, Search,
  Settings, Truck as TruckIcon, User, ChevronDown, Check, AlertTriangle,
  Play, RefreshCw, X, ArrowUpDown, Filter, Sparkles, Layers, ShieldCheck,
  GripVertical, Upload, FileUp, ArrowUp, ArrowDown, FileText, CheckCircle2
} from 'lucide-react';
import {
  COLUMNS,
  OFFICIAL_EXPORT_COLUMNS,
  OUR_LOCS,
  uid,
  todayISO,
  fmtDate,
  deriveEquipmentType,
  bayanClass,
  schedulePriority,
  parseMailOrder,
  parseReadySchedule,
  parseDateFromText,
  loadTimetableDatabase,
  saveTimetableDatabase,
  TimetableDatabase,
  TimetableDriver,
  TimetableVehicle,
  TimetableCommodity,
  TimetableStoreMap
} from '../utils/timetableEngine';

export const SAMPLE_READY_TEMPLATE = `Tayseer Group Factory\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
Monday, 5 October 2026\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
Driver Name\tIqama #\tDriver Mobile #\tEquipment#\tVehicle Plate No\tSource\tDestination\tCustomer\tSupplier\tStore\tEquipment Type\tCommodity\tWaybill#\tDN Number\tTransporter\tNotes\tBayan Expairy
TLS Fleets\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\tDT-01\tأ ح د D J A 4829\tYanbu\tYanbu\t\tLUBEREF\tTayseer Group Factory\tDumber\tSULPHUR / 25 MT\t51135\t\tTLS\t\t
SARU IBRAHIM\t2598393839\t531330746\t135HCL19\tأ ر ك K R A 7503\tYanbu\tYanbu\t\tTRONOX\tTLS Warehouse\tTanker\tCS / 25 MT\t51140\t\tTLS\t\t
SIBGHAT ULLAH ABDUL AMIN\t2596916359\t572718522\t217SLF19\tأ س س S S A 5046\tYanbu\tRabigh\tPetro Rabigh Cumene\t\t\tTanker\tSA / 24.5 MT\t51141\t\tTLS\t\t
SHAFIQ AHMED MUHAMMAD\t2533446320\t554691685\t4004006\tأ ر ح J R A 5159\tTLS\tTPF\t\t\tTayseer Group Factory\tFlatbed\tKCL / 24 Jumbo Bags / 30 MT\t51142\t\tTLS\t\t
IQBAL HOSSAIN\t2601876291\t571651516\t4004010\tأ س ح J S A 8752\tTLS\tTPF\t\t\tTLS Warehouse\tFlatbed\tSOP Granular Bulk / 24 Jumbo Bags / 30 MT\t51143\t\tTLS\t\t
RAISUL HASAN ALEY HASAN\t2469328948\t581793947\t4004011\tأ س ح J S A 8753\tTLS\tTPF\t\t\tTayseer Group Factory\tFlatbed\tCalcium Carbonate / 16 Jumbo Bags / 32 MT\t51144\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\tDT-01\tأ ح د D J A 4829\tYanbu\tYanbu\t\tLUBEREF\tTayseer Group Factory\tDumber\tSULPHUR / 25 MT\t51146\t\tTLS\t\t
SHAFIQ AHMED MUHAMMAD\t2533446320\t554691685\t4004006\tأ ر ح J R A 5159\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t51150\t\tTLS\t\t
RAISUL HASAN ALEY HASAN\t2469328948\t581793947\t4004011\tأ س ح J S A 8753\tTPF\tYanbu\tAgricultural & Machinary\t\t\tFlatbed\tSOP Granular / 25 Kg Bags / 1080 Bags / 27 MT\t51153\t\tTLS\t\t
IQBAL HOSSAIN\t2601876291\t571651516\t4004010\tأ س ح J S A 8752\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t51154\t\tTLS\t\t
AMAN TULLAH\t2582346751\t575630903\t126HCL19\tأ ر ك K R A 8477\tYanbu\tYanbu\tSWCC Yanbu\t\t\tTanker\tHCL / 21.5 MT\t51161\t\tTLS\t\t
RAISUL HASAN ALEY HASAN\t2469328948\t581793947\t4004011\tأ س ح J S A 8753\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Powder / 25 Kg Bags / 100 Bags / 25 MT\t\t\tTLS\t\t
SHAFIQ AHMED MUHAMMAD\t2533446320\t554691685\t4004006\tأ ر ح J R A 5159\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Powder / 25 Kg Bags / 100 Bags / 25 MT\t\t\tTLS\t\t
RAISUL HASAN ALEY HASAN\t2469328948\t581793947\t4004011\tأ س ح J S A 8753\tTLS\tTPF\t\t\tTayseer Group Factory\tFlatbed\tKCL / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\t4004003\tأ ح د D J A 4829\tTLS\tTPF\t\t\tTLS Warehouse\tFlatbed\tSOP Granular Bulk / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\t4004003\tأ ح د D J A 4829\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t\t\t\t\t
SHAFIQ AHMED MUHAMMAD\t2533446320\t554691685\t4004006\tأ ر ح J R A 5159\tTLS\tTPF\t\t\tTayseer Group Factory\tFlatbed\tKCL / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
IQBAL HOSSAIN\t2601876291\t571651516\t4004010\tأ س ح J S A 8752\tTLS\tTPF\t\t\tTLS Warehouse\tFlatbed\tSOP Granular Bulk / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
IQBAL HOSSAIN\t2601876291\t571651516\t4004010\tأ س ح J S A 8752\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t\t\tTLS\t\t
GHULAM YASIN HAFIZ WAHID BAKHSH\t2589336318\t571440790\t4004009\tأ ر ك K R A 8471\tTLS\tTPF\t\t\tTayseer Group Factory\tFlatbed\tKCL / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
GHULAM YASIN HAFIZ WAHID BAKHSH\t2589336318\t571440790\t4004009\tأ ر ك K R A 8471\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Powder / 25 Kg Bags / 1000 Bags / 25 MT\t\t\tTLS\t\t
GHULAM YASIN HAFIZ WAHID BAKHSH\t2589336318\t571440790\t4004009\tأ ر ك K R A 8471\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t\t\tTLS\t\t
GHULAM YASIN HAFIZ WAHID BAKHSH\t2589336318\t571440790\t4004009\tأ ر ك K R A 8471\tTLS\tTPF\t\t\tTLS Warehouse\tFlatbed\tSOP Granular Bulk / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
GHULAM YASIN HAFIZ WAHID BAKHSH\t2589336318\t571440790\t4004009\tأ ر ك K R A 8471\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\t4004003\tأ ح د D J A 4829\tTLS\tTPF\t\t\tTLS Warehouse\tFlatbed\tSOP Granular Bulk / 24 Jumbo Bags / 30 MT\t\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\t4004003\tأ ح د D J A 4829\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 1000 Bags / 25 MT\t\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\t4004003\tأ ح د D J A 4829\tTPF\tTLS\t\t\tTLS Warehouse\tFlatbed\tSOP Granular / 25 Kg Bags / 100 Bags / 25 MT\t\t\tTLS\t\t
SARU IBRAHIM\t2598393839\t531330746\t135HCL19\tأ ر ك K R A 7503\tYanbu\tShuhaiba\tSaudi Water Authority\t\t\tTanker\tCS / 21.5 MT\t\t\tTLS\t\t
JAVID KHAN\t2635431444\t570140037\t301CSD15\tأ س س S S A 1198\tYanbu\tJeddah\tRawabi Industrial Nature Company\t\t\tTanker\tCS / 24.5 MT\t\t\tTLS\t\t
SHAFIQ AHMED MUHAMMAD\t2533446320\t554691685\t4004006\tأ ر ح J R A 5159\tYanbu\tYanbu\tWang Kang Ceramic Company\t\t\tFlatbed\tCaustic Soda flakes / 25 Kg Bags / 1080 Bags / 27 MT\t\t\tTLS\t\t
GHULAM YASIN HAFIZ WAHID BAKHSH\t2589336318\t571440790\t102HCL15\tأ ر ك K R A 8471\tYanbu\tAl Khobar\tSWCC\t\t\tTanker\tFC / 21.5 MT\t\t\tTLS\t\t
FAISAL HAMMAD MUKHTAR AHMED\t2557293632\t571466910\t4004011\tأ س س S S A 1199\tDammam\tJubail\tNOMAC\t\tTayseer Group WH (3rd Industrial Area)\tFlatbed\tSMSBS / 25 Kg Bags / 1000 Bags / 25 MT\t\t\tTLS\t\t
MUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\t4004003\tأ ح د D J A 4829\tYanbu\tYanbu\tMARAFIQ \t\t\tFlatbed\tHCL / 8 Drums / 18.4 MT & 6 IBCs / 6.9 MT \t\t\tTLS\t\t
AMAN TULLAH\t2582346751\t575630903\t107HCL18\tأ ر ك K R A 8477\tYanbu\tYanbu\tSWCC Yanbu\t\t\tTanker\tHCL / 21.5 MT\t\t\tTLS\t\t
ABDUL WALI HAKEEM WALI KHAN\t2596916599\t553734337\t133HCL19\tأ ر ح J R A 5158\tYanbu\tTuraif\tSaudi Arabian Mining Company\t\t\tTanker\tHCL / 21.5 MT\t\t\tTLS\t\t
TALHA FAZLAY RUB\t2324352547\t599595250\t144HCL19\tأ ر ح J R A 5160\tYanbu\tKhafji\tDROPS\t\t\tTanker\tHCL / 21.5 MT\t\t\tTLS\t\t
SHAHZAD AHMAD SIRAJ AHMAD KHAN\t2634188631\t573685786\t205SLF18\tأ س س S S A 1193\tYanbu\tYanbu\tTRONOX\t\t\tTanker\tSA / 25 MT\t\t\tTLS\t\t
SHAHZAD AHMAD SIRAJ AHMAD KHAN\t2634188631\t573685786\t205SLF18\tأ س س S S A 1193\tYanbu\tYanbu\tTRONOX\t\t\tTanker\tSA / 25 MT\t\t\tTLS\t\t
MUHAMMAD ASHRAF SAED AHMED\t2349470464\t593304841\t116HCL18\tأ ر ك K R A 8479\tYanbu\tRas Al Khair\tSaudi Arabian Mining Company\t\t\tTanker\tSBS / 21.5 MT\t\t\t\t\t`;

export const TimetableParserView: React.FC = () => {
  const { schedules: contextSchedules, saveDailySchedule, saveDailyManifest } = useLms();
  const { user, isDispatcher, isAdmin } = useAuth();

  // Load database from localStorage (seed if first time)
  const [db, setDb] = useState<TimetableDatabase>(() => {
    const loaded = loadTimetableDatabase();
    // Also merge in any schedules from context if not already present
    if (contextSchedules) {
      Object.entries(contextSchedules).forEach(([dt, sched]) => {
        if (!loaded.schedules[dt] && sched.rows && sched.rows.length) {
          loaded.schedules[dt] = {
            date: dt,
            rows: sched.rows,
            createdAt: sched.updatedAt || new Date().toISOString(),
            updatedAt: sched.updatedAt || new Date().toISOString()
          };
        }
      });
    }
    return loaded;
  });

  // App navigation state
  const [page, setPage] = useState<'new' | 'schedule' | 'drivers' | 'vehicles' | 'settings'>('new');
  const [view, setView] = useState<'list' | 'daily'>('list');
  const [currentDate, setCurrentDate] = useState<string>(() => {
    const dates = Object.keys(db.schedules).sort();
    if (db.uiPrefs.lastDate && db.schedules[db.uiPrefs.lastDate]) {
      return db.uiPrefs.lastDate;
    }
    return dates.length ? dates[dates.length - 1] : todayISO();
  });

  // Open dropdown
  const [isOpenDropdownOpen, setIsOpenDropdownOpen] = useState(false);
  const openDropdownRef = useRef<HTMLDivElement>(null);

  // Filters & display toggles
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPending, setFilterPending] = useState(false);
  const [filterGroup, setFilterGroup] = useState<'all' | 'tls' | 'ext'>('all');
  const [enableSort, setEnableSort] = useState<boolean>(() => db.uiPrefs.enableSort !== false);
  const [showPriority, setShowPriority] = useState<boolean>(() => db.uiPrefs.showPriority !== false);
  const [isColPanelOpen, setIsColPanelOpen] = useState(false);

  // New tab state
  const [ingestMode, setIngestMode] = useState<'mail' | 'template'>('template');
  const [mailInput, setMailInput] = useState('');
  const [templateInput, setTemplateInput] = useState('');
  const [templateFileName, setTemplateFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newRows, setNewRows] = useState<TimetableRow[] | null>(null);
  const [parseInfo, setParseInfo] = useState('');

  // Drag and Drop row reordering state
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  // Interactive selection & range copy
  const [selStart, setSelStart] = useState<{ rowId: string; colKey: keyof TimetableRow } | null>(null);
  const [flashingCell, setFlashingCell] = useState<{ rowId: string; colKey: string } | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: keyof TimetableRow } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Search queries for Drivers & Vehicles sub-tabs
  const [driverSearch, setDriverSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Toast notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 1800);
  };

  // Close open dropdown when clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (openDropdownRef.current && !openDropdownRef.current.contains(e.target as Node)) {
        setIsOpenDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Save DB helper
  const updateDb = (updater: (prev: TimetableDatabase) => TimetableDatabase) => {
    setDb(prev => {
      const next = updater(prev);
      saveTimetableDatabase(next);
      return next;
    });
  };

  // Auto-focus inline edit input
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Handle escape key to cancel edit or selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingCell(null);
        setSelStart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync initial page
  useEffect(() => {
    const allDates = Object.keys(db.schedules).sort();
    if (allDates.length && !newRows) {
      setPage('schedule');
    }
  }, []);

  // -------------------------------------------------------------------
  // VISIBLE COLUMNS MANAGEMENT (Independent per view!)
  // -------------------------------------------------------------------
  const visibleColumns = useMemo(() => {
    const prefKey = view === 'daily' ? 'visibleColumnsDaily' : 'visibleColumnsList';
    const arr = db.uiPrefs[prefKey];
    if (Array.isArray(arr) && arr.length > 0) {
      // Ensure both equipmentNo (unit ID) and equipmentType (category) are included
      const list = [...arr];
      if (!list.includes('equipmentNo')) list.push('equipmentNo');
      if (!list.includes('equipmentType')) list.push('equipmentType');
      return COLUMNS.filter(c => list.includes(c.key)).map(c => c.key);
    }
    return COLUMNS.filter(c => c.def).map(c => c.key);
  }, [view, db.uiPrefs]);

  const toggleColumn = (key: keyof TimetableRow) => {
    const prefKey = view === 'daily' ? 'visibleColumnsDaily' : 'visibleColumnsList';
    const current = visibleColumns.slice();
    let next: (keyof TimetableRow)[];
    if (current.includes(key)) {
      next = current.filter(k => k !== key);
    } else {
      next = [...current, key];
    }
    // Maintain official ordering
    next = COLUMNS.filter(c => next.includes(c.key)).map(c => c.key);

    updateDb(prev => ({
      ...prev,
      uiPrefs: {
        ...prev.uiPrefs,
        [prefKey]: next
      }
    }));
  };

  // -------------------------------------------------------------------
  // VISIBLE ROWS CALCULATION FOR ACTIVE SCHEDULE
  // -------------------------------------------------------------------
  const currentSchedule = db.schedules[currentDate];

  const currentVisibleRows = useMemo(() => {
    if (!currentSchedule || !currentSchedule.rows) return [];
    let rows = currentSchedule.rows.map(r => ({
      ...r,
      priority: r.priority !== undefined ? r.priority : schedulePriority(r)
    }));

    if (filterGroup === 'tls') {
      rows = rows.filter(r => !r.transporter || r.transporter === 'TLS');
    } else if (filterGroup === 'ext') {
      rows = rows.filter(r => r.transporter && r.transporter !== 'TLS');
    }

    if (filterPending) {
      rows = rows.filter(r => !r.driverName || !r.waybill || !r.bayanExpiry);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        COLUMNS.some(c => String(r[c.key] || '').toLowerCase().includes(q))
      );
    }

    if (enableSort) {
      rows.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    }

    return rows;
  }, [currentSchedule, filterGroup, filterPending, searchQuery, enableSort]);

  // -------------------------------------------------------------------
  // COPY HELPERS
  // -------------------------------------------------------------------
  const copyToClipboard = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied: ' + (label || (text.length > 40 ? text.slice(0, 40) + '…' : text) || '(empty)'));
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied');
    }
  };

  const copyRowTsv = (row: TimetableRow) => {
    const line = visibleColumns.map(k => row[k] || '').join('\t');
    copyToClipboard(line, '1 row (TSV)');
  };

  const handleCellClick = (e: React.MouseEvent, row: TimetableRow, colKey: keyof TimetableRow) => {
    if (editingCell && editingCell.rowId === row.id && editingCell.colKey === colKey) return;

    if (e.shiftKey && selStart) {
      // Range copy!
      const rows = page === 'new' && newRows ? newRows : currentVisibleRows;
      const cols = visibleColumns;
      const ai = rows.findIndex(r => r.id === selStart.rowId);
      const bi = rows.findIndex(r => r.id === row.id);
      const ac = cols.indexOf(selStart.colKey);
      const bc = cols.indexOf(colKey);

      if (ai >= 0 && bi >= 0 && ac >= 0 && bc >= 0) {
        const [r1, r2] = [Math.min(ai, bi), Math.max(ai, bi)];
        const [c1, c2] = [Math.min(ac, bc), Math.max(ac, bc)];
        const out: string[] = [];
        for (let r = r1; r <= r2; r++) {
          const line: string[] = [];
          for (let c = c1; c <= c2; c++) {
            line.push(String(rows[r][cols[c]] || ''));
          }
          out.push(line.join('\t'));
        }
        copyToClipboard(out.join('\n'), `${out.length} rows × ${c2 - c1 + 1} cols (TSV)`);
        setSelStart(null);
        return;
      }
    }

    // Single cell copy
    const val = String(row[colKey] || '');
    copyToClipboard(val, val);
    setSelStart({ rowId: row.id, colKey });
    setFlashingCell({ rowId: row.id, colKey: String(colKey) });
    setTimeout(() => setFlashingCell(null), 700);
  };

  // -------------------------------------------------------------------
  // CELL EDITING & AUTO-FILL ENGINE
  // -------------------------------------------------------------------
  const startEditCell = (row: TimetableRow, colKey: keyof TimetableRow) => {
    setEditingCell({ rowId: row.id, colKey });
    setEditingValue(String(row[colKey] || ''));
  };

  const commitEditCell = () => {
    if (!editingCell) return;
    const { rowId, colKey } = editingCell;
    const val = editingValue.trim();

    const applyUpdate = (rowList: TimetableRow[]): TimetableRow[] => {
      return rowList.map(r => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [colKey]: val };

        // Driver Name autocomplete
        if (colKey === 'driverName') {
          const d = db.drivers.find(x => x.name.toLowerCase() === val.toLowerCase());
          if (d) {
            updated.driverName = d.name;
            updated.iqama = d.iqama;
            updated.mobile = d.mobile;
          }
        }

        // Equipment# autocomplete (unit ID like DT-01, 135HCL19, 4004006)
        if (colKey === 'equipmentNo') {
          updated.equipmentNo = val;
          const v = db.vehicles.find(x => x.equipmentNo.toLowerCase() === val.toLowerCase());
          if (v) {
            updated.equipmentNo = v.equipmentNo;
            updated.plateNo = v.plateNo;
            if (!updated.equipmentType) {
              updated.equipmentType = v.type || deriveEquipmentType(v.equipmentNo);
            }
            updated.transporter = 'TLS';
            if (v.defaultDriverId && !updated.driverName) {
              const d = db.drivers.find(x => x.id === v.defaultDriverId);
              if (d) {
                updated.driverName = d.name;
                updated.iqama = d.iqama;
                updated.mobile = d.mobile;
              }
            }
          } else if (val && !updated.equipmentType) {
            updated.equipmentType = deriveEquipmentType(val);
          }
        }

        // Equipment Type edit (category like Dumber, Tanker, Flatbed)
        if (colKey === 'equipmentType') {
          updated.equipmentType = val;
        }

        // Plate No autocomplete
        if (colKey === 'plateNo') {
          const v = db.vehicles.find(x => x.plateNo.toLowerCase() === val.toLowerCase());
          if (v) {
            updated.plateNo = v.plateNo;
            updated.equipmentNo = v.equipmentNo;
            updated.equipmentType = deriveEquipmentType(v.equipmentNo);
            updated.transporter = 'TLS';
            if (v.defaultDriverId && !updated.driverName) {
              const d = db.drivers.find(x => x.id === v.defaultDriverId);
              if (d) {
                updated.driverName = d.name;
                updated.iqama = d.iqama;
                updated.mobile = d.mobile;
              }
            }
          }
        }

        updated.priority = schedulePriority(updated);
        return updated;
      });
    };

    if (page === 'new' && newRows) {
      setNewRows(applyUpdate(newRows));
    } else if (currentSchedule) {
      const updatedRows = applyUpdate(currentSchedule.rows);
      updateDb(prev => ({
        ...prev,
        schedules: {
          ...prev.schedules,
          [currentDate]: {
            ...prev.schedules[currentDate],
            rows: updatedRows,
            updatedAt: new Date().toISOString()
          }
        }
      }));
      // Keep LMS Context in sync
      saveDailySchedule(currentDate, updatedRows, false);
    }

    setEditingCell(null);
  };

  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // ACTIONS & PARSING (OPTION 1: MAIL ORDER & OPTION 2: READY TEMPLATE)
  // -------------------------------------------------------------------
  const handleParseMail = () => {
    if (!mailInput.trim()) {
      showToast('Please paste the mail order schedule first');
      return;
    }
    const { date, rows } = parseMailOrder(mailInput, db.commodities, db.storeMap);
    setNewDate(date);
    setNewRows(rows);
    setParseInfo(`Parsed ${rows.length} rows for ${fmtDate(date)} (Mail Order Schedule)`);
  };

  const handleParseTemplate = (customText?: string) => {
    const textToUse = customText || templateInput;
    if (!textToUse.trim()) {
      showToast('Please paste or upload the ready template schedule first');
      return;
    }
    const { date, rows } = parseReadySchedule(textToUse, db.commodities, db.storeMap);
    if (!rows.length) {
      showToast('Could not find valid rows in the pasted sheet. Please check headers.');
      return;
    }
    setNewDate(date);
    setNewRows(rows);
    setParseInfo(`Parsed ${rows.length} rows for ${fmtDate(date)} (Ready Sheet Template)`);
    showToast(`Successfully parsed ${rows.length} dispatches!`);
  };

  const handleLoadSampleTemplate = () => {
    setTemplateInput(SAMPLE_READY_TEMPLATE);
    setTemplateFileName('Tayseer_Factory_05_Oct_2026.tsv');
    handleParseTemplate(SAMPLE_READY_TEMPLATE);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTemplateFileName(file.name);

    const reader = new FileReader();
    if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        setTemplateInput(text);
        handleParseTemplate(text);
      };
      reader.readAsText(file);
    } else {
      // Excel file .xlsx or .xls
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const tsv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
          setTemplateInput(tsv);
          handleParseTemplate(tsv);
        } catch (err: any) {
          showToast('Failed to parse Excel file: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  // -------------------------------------------------------------------
  // MANUAL DRAG & DROP ROW REORDERING ENGINE
  // -------------------------------------------------------------------
  const handleRowDragStart = (e: React.DragEvent, rowId: string) => {
    e.dataTransfer.setData('text/plain', rowId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedRowId(rowId);
  };

  const handleRowDragOver = (e: React.DragEvent, rowId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedRowId === rowId) return;
    setDragOverRowId(rowId);
  };

  const handleRowDragLeave = () => {
    setDragOverRowId(null);
  };

  const handleRowDrop = (e: React.DragEvent, targetRowId: string, isPreview: boolean = false) => {
    e.preventDefault();
    const sourceId = draggedRowId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetRowId) {
      setDraggedRowId(null);
      setDragOverRowId(null);
      return;
    }

    const reorder = (list: TimetableRow[]): TimetableRow[] => {
      const fromIndex = list.findIndex(r => r.id === sourceId);
      const toIndex = list.findIndex(r => r.id === targetRowId);
      if (fromIndex < 0 || toIndex < 0) return list;
      const copy = [...list];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    };

    if (isPreview && newRows) {
      const updated = reorder(newRows);
      setNewRows(updated);
      showToast('Row moved to new sequence in preview');
    } else if (currentSchedule) {
      const updated = reorder(currentSchedule.rows);
      updateDb(prev => ({
        ...prev,
        schedules: {
          ...prev.schedules,
          [currentDate]: {
            ...prev.schedules[currentDate],
            rows: updated,
            updatedAt: new Date().toISOString()
          }
        },
        uiPrefs: {
          ...prev.uiPrefs,
          enableSort: false // Turn off auto priority sort so manual custom sequence holds
        }
      }));
      setEnableSort(false);
      saveDailySchedule(currentDate, updated, false);
      showToast('Manual row sequence saved');
    }

    setDraggedRowId(null);
    setDragOverRowId(null);
  };

  const handleRowDragEnd = () => {
    setDraggedRowId(null);
    setDragOverRowId(null);
  };

  const moveRowStep = (rowId: string, direction: 'up' | 'down', isPreview: boolean = false) => {
    const reorder = (list: TimetableRow[]): TimetableRow[] => {
      const index = list.findIndex(r => r.id === rowId);
      if (index < 0) return list;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return list;
      const copy = [...list];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    };

    if (isPreview && newRows) {
      const updated = reorder(newRows);
      setNewRows(updated);
      showToast(`Moved row ${direction}`);
    } else if (currentSchedule) {
      const updated = reorder(currentSchedule.rows);
      updateDb(prev => ({
        ...prev,
        schedules: {
          ...prev.schedules,
          [currentDate]: {
            ...prev.schedules[currentDate],
            rows: updated,
            updatedAt: new Date().toISOString()
          }
        },
        uiPrefs: {
          ...prev.uiPrefs,
          enableSort: false
        }
      }));
      setEnableSort(false);
      saveDailySchedule(currentDate, updated, false);
      showToast(`Moved row ${direction}`);
    }
  };

  const handleClearNew = () => {
    setMailInput('');
    setTemplateInput('');
    setTemplateFileName('');
    setNewRows(null);
    setNewDate(null);
    setParseInfo('');
  };

  const handleSaveNew = () => {
    if (!newRows || !newRows.length || !newDate) return;
    const date = newDate;
    const existing = db.schedules[date];
    if (existing && !confirm(`A schedule already exists for ${fmtDate(date)}. Overwrite?`)) {
      return;
    }

    const scheduleObj = {
      date,
      rows: newRows,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    updateDb(prev => ({
      ...prev,
      schedules: {
        ...prev.schedules,
        [date]: scheduleObj
      },
      uiPrefs: {
        ...prev.uiPrefs,
        lastDate: date
      }
    }));

    // Sync to LMS Context and Daily Manifest
    saveDailySchedule(date, newRows, true);

    setCurrentDate(date);
    setPage('schedule');
    setNewRows(null);
    setNewDate(null);
    setMailInput('');
    setParseInfo('');
    showToast(`Schedule saved for ${fmtDate(date)}`);
  };

  const handleAddRow = () => {
    if (!currentSchedule) return;
    const newRow: TimetableRow = {
      id: uid(),
      driverName: '',
      iqama: '',
      mobile: '',
      plateNo: '',
      equipmentNo: '',
      customer: '',
      supplier: '',
      store: '',
      source: 'Yanbu',
      destination: '',
      equipmentType: 'Tanker',
      commodity: '',
      waybill: '',
      dn: '',
      transporter: 'TLS',
      notes: '',
      bayanExpiry: '',
      priority: 999
    };
    const updatedRows = [...currentSchedule.rows, newRow];
    updateDb(prev => ({
      ...prev,
      schedules: {
        ...prev.schedules,
        [currentDate]: {
          ...prev.schedules[currentDate],
          rows: updatedRows,
          updatedAt: new Date().toISOString()
        }
      }
    }));
    saveDailySchedule(currentDate, updatedRows, false);
    showToast('Added new blank row');
  };

  const handleDeleteSchedule = () => {
    if (!currentSchedule) return;
    if (!confirm(`Are you sure you want to delete the schedule for ${fmtDate(currentDate)}?`)) return;

    updateDb(prev => {
      const copy = { ...prev.schedules };
      delete copy[currentDate];
      const remainingDates = Object.keys(copy).sort();
      return {
        ...prev,
        schedules: copy,
        uiPrefs: {
          ...prev.uiPrefs,
          lastDate: remainingDates.length ? remainingDates[remainingDates.length - 1] : null
        }
      };
    });

    const remDates = Object.keys(db.schedules).filter(d => d !== currentDate).sort();
    if (remDates.length) {
      setCurrentDate(remDates[remDates.length - 1]);
    } else {
      setPage('new');
    }
    showToast('Schedule deleted');
  };

  // -------------------------------------------------------------------
  // EXPORT
  // -------------------------------------------------------------------
  const exportExcel = () => {
    if (!currentDate || !currentVisibleRows.length) return;
    const data = [OFFICIAL_EXPORT_COLUMNS.map(x => x[1])];
    currentVisibleRows.forEach(r => {
      data.push(OFFICIAL_EXPORT_COLUMNS.map(([k]) => String(r[k] || '')));
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    XLSX.writeFile(wb, `Schedule_${currentDate}.xlsx`);
    showToast('Exported Excel');
  };

  const exportCsv = () => {
    if (!currentDate || !currentVisibleRows.length) return;
    const csvLines = [OFFICIAL_EXPORT_COLUMNS.map(x => x[1]).join(',')];
    currentVisibleRows.forEach(r => {
      csvLines.push(
        OFFICIAL_EXPORT_COLUMNS.map(([k]) => {
          const s = String(r[k] || '');
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',')
      );
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Schedule_${currentDate}.csv`;
    a.click();
    showToast('Exported CSV');
  };

  // -------------------------------------------------------------------
  // DRIVERS REGISTRY HANDLERS
  // -------------------------------------------------------------------
  const handleAddDriver = () => {
    const newD: TimetableDriver = { id: uid(), name: '', iqama: '', mobile: '' };
    updateDb(prev => ({ ...prev, drivers: [newD, ...prev.drivers] }));
    showToast('Added driver row');
  };

  const handleUpdateDriver = (id: string, field: keyof TimetableDriver, val: string) => {
    updateDb(prev => ({
      ...prev,
      drivers: prev.drivers.map(d => (d.id === id ? { ...d, [field]: val } : d))
    }));
  };

  const handleDeleteDriver = (id: string) => {
    if (!confirm('Delete this driver?')) return;
    updateDb(prev => ({
      ...prev,
      drivers: prev.drivers.filter(d => d.id !== id),
      vehicles: prev.vehicles.map(v => (v.defaultDriverId === id ? { ...v, defaultDriverId: '' } : v))
    }));
    showToast('Driver deleted');
  };

  // -------------------------------------------------------------------
  // VEHICLES REGISTRY HANDLERS
  // -------------------------------------------------------------------
  const handleAddVehicle = () => {
    const newV: TimetableVehicle = {
      id: uid(),
      equipmentNo: '',
      plateNo: '',
      type: 'Tanker',
      defaultDriverId: '',
      isThirdParty: false
    };
    updateDb(prev => ({ ...prev, vehicles: [newV, ...prev.vehicles] }));
    showToast('Added vehicle row');
  };

  const handleUpdateVehicle = (id: string, field: keyof TimetableVehicle, val: any) => {
    updateDb(prev => ({
      ...prev,
      vehicles: prev.vehicles.map(v => {
        if (v.id !== id) return v;
        const updated = { ...v, [field]: val };
        if (field === 'equipmentNo') {
          updated.type = deriveEquipmentType(val);
        }
        return updated;
      })
    }));
  };

  const handleDeleteVehicle = (id: string) => {
    if (!confirm('Delete this vehicle?')) return;
    updateDb(prev => ({
      ...prev,
      vehicles: prev.vehicles.filter(v => v.id !== id)
    }));
    showToast('Vehicle deleted');
  };

  // -------------------------------------------------------------------
  // SETTINGS HANDLERS
  // -------------------------------------------------------------------
  const handleAddCommodity = () => {
    const newC: TimetableCommodity = {
      canonical: 'New Commodity',
      shortForm: 'NEW',
      aliases: [],
      jumboBagMT: 1.25
    };
    updateDb(prev => ({ ...prev, commodities: [newC, ...prev.commodities] }));
    showToast('Added commodity');
  };

  const handleUpdateCommodity = (idx: number, field: keyof TimetableCommodity, val: any) => {
    updateDb(prev => {
      const copy = [...prev.commodities];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, commodities: copy };
    });
  };

  const handleDeleteCommodity = (idx: number) => {
    updateDb(prev => {
      const copy = [...prev.commodities];
      copy.splice(idx, 1);
      return { ...prev, commodities: copy };
    });
    showToast('Deleted commodity');
  };

  const handleAddStore = () => {
    updateDb(prev => ({
      ...prev,
      storeMap: { ...prev.storeMap, ['NewDest_' + Math.floor(Math.random() * 900)]: 'New Store' }
    }));
    showToast('Added store mapping');
  };

  const handleUpdateStore = (oldKey: string, newKey: string, val: string) => {
    updateDb(prev => {
      const copy = { ...prev.storeMap };
      if (oldKey !== newKey) {
        delete copy[oldKey];
      }
      copy[newKey] = val;
      return { ...prev, storeMap: copy };
    });
  };

  const handleDeleteStore = (key: string) => {
    if (!confirm('Delete this store mapping?')) return;
    updateDb(prev => {
      const copy = { ...prev.storeMap };
      delete copy[key];
      return { ...prev, storeMap: copy };
    });
    showToast('Deleted store mapping');
  };

  // -------------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------------
  const getPrioBadgeClass = (prio: number) => {
    if (prio === 1) return 'bg-rose-600 text-white border-rose-700';
    if (prio === 2) return 'bg-orange-600 text-white border-orange-700';
    if (prio === 3) return 'bg-amber-600 text-white border-amber-700';
    if (prio === 4) return 'bg-yellow-600 text-white border-yellow-700';
    if (prio === 5) return 'bg-lime-600 text-white border-lime-700';
    if (prio === 6) return 'bg-emerald-600 text-white border-emerald-700';
    if (prio === 7) return 'bg-cyan-600 text-white border-cyan-700';
    if (prio === 8) return 'bg-blue-600 text-white border-blue-700';
    if (prio === 9) return 'bg-violet-600 text-white border-violet-700';
    if (prio === 10) return 'bg-purple-600 text-white border-purple-700';
    if (prio === 11) return 'bg-fuchsia-600 text-white border-fuchsia-700';
    return 'bg-slate-700 text-slate-300 border-slate-600';
  };

  const renderTableRows = (rowsList: TimetableRow[], isPreview: boolean = false) => {
    const tlsRows = rowsList.filter(r => !r.transporter || r.transporter === 'TLS');
    const extRows = rowsList.filter(r => r.transporter && r.transporter !== 'TLS');

    const groups: { label: string; rows: TimetableRow[] }[] = [];
    if (tlsRows.length) groups.push({ label: 'TLS Fleets', rows: tlsRows });
    if (extRows.length) groups.push({ label: 'External Trips', rows: extRows });

    return groups.map(g => (
      <React.Fragment key={g.label}>
        <tr className="bg-blue-950/70 text-blue-300 font-bold border-t border-b border-blue-800/60">
          <td colSpan={visibleColumns.length + 1} className="py-2.5 px-4 text-xs font-mono tracking-wider">
            {g.label} <span className="text-slate-400 font-normal">({g.rows.length} trips)</span>
          </td>
        </tr>
        {g.rows.map(r => {
          const status = !r.driverName ? 'unassigned' : !r.waybill ? 'in-progress' : 'complete';
          const statusBorder =
            status === 'unassigned'
              ? 'border-l-4 border-l-slate-500'
              : status === 'in-progress'
              ? 'border-l-4 border-l-amber-500'
              : 'border-l-4 border-l-emerald-500';

          const prio = r.priority !== undefined ? r.priority : schedulePriority(r);
          const isDragging = draggedRowId === r.id;
          const isDragOver = dragOverRowId === r.id;

          return (
            <tr
              key={r.id}
              draggable={true}
              onDragStart={e => handleRowDragStart(e, r.id)}
              onDragOver={e => handleRowDragOver(e, r.id)}
              onDragLeave={handleRowDragLeave}
              onDrop={e => handleRowDrop(e, r.id, isPreview)}
              onDragEnd={handleRowDragEnd}
              className={`hover:bg-slate-800/80 transition group border-b border-slate-800/80 ${statusBorder} ${
                isDragging ? 'opacity-40 bg-slate-800' : ''
              } ${isDragOver ? 'border-t-2 border-t-blue-400 bg-blue-950/40' : ''}`}
            >
              {/* Row Action: Drag Handle, Step Controls & Copy */}
              <td className="w-16 min-w-[64px] text-center py-2 px-1 sticky left-0 bg-slate-900/95 z-20 border-r border-slate-800/80">
                <div className="flex items-center justify-center gap-0.5">
                  <div
                    className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-blue-400 p-0.5 rounded transition"
                    title="Drag to change row sequence"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      copyRowTsv(r);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-300 hover:text-white p-0.5 rounded transition text-xs"
                    title="Copy full row as TSV"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <div className="opacity-0 group-hover:opacity-100 flex flex-col -space-y-1">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        moveRowStep(r.id, 'up', isPreview);
                      }}
                      className="hover:text-blue-400 text-slate-400 p-0.5 transition"
                      title="Move Up"
                    >
                      <ArrowUp className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        moveRowStep(r.id, 'down', isPreview);
                      }}
                      className="hover:text-blue-400 text-slate-400 p-0.5 transition"
                      title="Move Down"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </td>

              {/* Dynamic Columns */}
              {visibleColumns.map((colKey, idx) => {
                const colDef = COLUMNS.find(c => c.key === colKey);
                const isSticky = colKey === 'driverName';
                const val = r[colKey] || '';
                const isBayan = colKey === 'bayanExpiry';
                const bayanStyle = isBayan && val ? bayanClass(String(val)) : '';
                const isFlashing =
                  flashingCell && flashingCell.rowId === r.id && flashingCell.colKey === String(colKey);
                const isSelected = selStart && selStart.rowId === r.id && selStart.colKey === colKey;
                const isEditing = editingCell && editingCell.rowId === r.id && editingCell.colKey === colKey;

                return (
                  <td
                    key={colKey}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      startEditCell(r, colKey);
                    }}
                    onClick={e => handleCellClick(e, r, colKey)}
                    className={`py-2 px-3 text-xs whitespace-nowrap align-middle cursor-pointer transition select-none ${
                      isSticky
                        ? 'sticky left-16 bg-slate-900/95 z-10 font-semibold text-white border-r border-slate-800/80'
                        : 'text-slate-200'
                    } ${bayanStyle} ${isFlashing ? 'bg-emerald-500/40 text-white' : ''} ${
                      isSelected ? 'bg-blue-600/30 ring-1 ring-blue-500' : ''
                    }`}
                    style={{ minWidth: `${colDef?.w || 120}px` }}
                  >
                    {isEditing ? (
                      <div className="flex items-center" onClick={e => e.stopPropagation()}>
                        {colKey === 'driverName' ? (
                          <input
                            ref={editInputRef}
                            list="dl-drivers-tt-edit"
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEditCell}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEditCell();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none"
                            placeholder="Search driver..."
                          />
                        ) : colKey === 'equipmentNo' ? (
                          <input
                            ref={editInputRef}
                            list="dl-equipment-tt-edit"
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEditCell}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEditCell();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none font-mono"
                            placeholder="Unit ID (e.g. DT-01, 135HCL19)..."
                          />
                        ) : colKey === 'equipmentType' ? (
                          <input
                            ref={editInputRef}
                            list="dl-equipment-types-tt-edit"
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEditCell}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEditCell();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none font-mono"
                            placeholder="Dumber, Tanker, Flatbed..."
                          />
                        ) : colKey === 'plateNo' ? (
                          <input
                            ref={editInputRef}
                            list="dl-plates-tt-edit"
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEditCell}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEditCell();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none uppercase font-mono"
                            placeholder="Search plate..."
                          />
                        ) : colKey === 'bayanExpiry' ? (
                          <input
                            ref={editInputRef}
                            type="date"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEditCell}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEditCell();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none font-mono"
                          />
                        ) : (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onBlur={commitEditCell}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEditCell();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {/* Priority Badge on the first visible cell */}
                        {showPriority && idx === 0 && (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border font-mono ${getPrioBadgeClass(
                              prio
                            )}`}
                            title={`Priority ${prio}`}
                          >
                            {prio === 999 ? '—' : `P${prio}`}
                          </span>
                        )}

                        {val ? (
                          <span className="truncate">{val}</span>
                        ) : (
                          <span className="text-slate-600 italic select-none">—</span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </React.Fragment>
    ));
  };

  // -------------------------------------------------------------------
  // SUMMARY METRICS
  // -------------------------------------------------------------------
  const totalRowsCount = currentSchedule?.rows?.length || 0;
  const assignedCount = currentSchedule?.rows?.filter(r => r.driverName).length || 0;
  const pendingCount =
    currentSchedule?.rows?.filter(r => !r.driverName || !r.waybill || !r.bayanExpiry).length || 0;
  const totalMT = useMemo(() => {
    if (!currentSchedule?.rows) return 0;
    return currentSchedule.rows.reduce((sum, r) => {
      const m = String(r.commodity || '').match(/([\d.]+)\s*MT\b/);
      return sum + (m ? parseFloat(m[1]) : 0);
    }, 0);
  }, [currentSchedule]);

  const allSavedDates = Object.keys(db.schedules).sort().reverse();

  return (
    <div className="space-y-4">
      {/* Toast popup */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white border border-blue-500/60 px-4 py-2.5 rounded-xl text-xs font-mono shadow-2xl z-50 animate-fade-in flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* =============================================================
          TOP APPLICATION NAVIGATION BAR (Header v4)
          ============================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 font-mono">
              <Calendar className="w-5 h-5 text-blue-400" /> Timetable
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
              v4
            </span>
          </div>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setPage('new')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                page === 'new'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>

            {/* Open ▾ Dropdown */}
            <div className="relative" ref={openDropdownRef}>
              <button
                onClick={() => setIsOpenDropdownOpen(!isOpenDropdownOpen)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  page === 'schedule'
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>Open ▾</span>
              </button>

              {isOpenDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 max-h-72 overflow-y-auto custom-scrollbar">
                  <div className="px-2 py-1 text-[11px] font-mono text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                    Saved Schedules ({allSavedDates.length})
                  </div>
                  {allSavedDates.length ? (
                    allSavedDates.map(dt => (
                      <button
                        key={dt}
                        onClick={() => {
                          setCurrentDate(dt);
                          setPage('schedule');
                          updateDb(prev => ({
                            ...prev,
                            uiPrefs: { ...prev.uiPrefs, lastDate: dt }
                          }));
                          setIsOpenDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between hover:bg-slate-800 transition ${
                          currentDate === dt && page === 'schedule'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-200'
                        }`}
                      >
                        <span>{fmtDate(dt)}</span>
                        <span className="text-[11px] opacity-70">
                          ({db.schedules[dt]?.rows?.length || 0} rows)
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-xs text-slate-400 text-center">No saved schedules yet</div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setPage('drivers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                page === 'drivers'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Drivers
            </button>

            <button
              onClick={() => setPage('vehicles')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                page === 'vehicles'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <TruckIcon className="w-3.5 h-3.5" /> Vehicles
            </button>

            <button
              onClick={() => setPage('settings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                page === 'settings'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </nav>
        </div>

        {/* Active Schedule Quick Badge if in schedule page */}
        {page === 'schedule' && currentSchedule && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">
              Active: <b className="text-blue-400">{fmtDate(currentDate)}</b>
            </span>
          </div>
        )}
      </div>

      {/* =============================================================
          PAGE 1: NEW (OPTION 1: MAIL ORDER & OPTION 2: READY TEMPLATE)
          ============================================================= */}
      {page === 'new' && (
        <div className="space-y-4">
          {/* Ingestion Mode Switcher Tabs */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📥</span> Ingest Dispatch Schedule
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose how to input your schedule: parse from an email mail order, or upload / paste a ready schedule sheet.
                </p>
              </div>

              {/* Mode Toggle Switcher */}
              <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIngestMode('template')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    ingestMode === 'template'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Option 2: Ready Sheet / Template</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                    New
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIngestMode('mail')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    ingestMode === 'mail'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Option 1: Mail Order Schedule</span>
                </button>
              </div>
            </div>

            {/* Hidden File Input for Ready Sheet Template */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.tsv,.csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* OPTION 2: READY SCHEDULE TEMPLATE (DIRECT SHEET UPLOAD / PASTE) */}
            {ingestMode === 'template' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-400 bg-blue-950/60 border border-blue-500/30 px-2.5 py-1 rounded-lg">
                      Ready Sheet Format
                    </span>
                    <span className="text-xs text-slate-400">
                      Supports TSV, Excel (.xlsx/.xls), and tab-delimited exports with Driver, Equipment, Waybill & Route columns.
                    </span>
                  </div>

                  {templateFileName && (
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> {templateFileName}
                    </span>
                  )}

                  {parseInfo && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-lg">
                      {parseInfo}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    value={templateInput}
                    onChange={e => setTemplateInput(e.target.value)}
                    placeholder={`Tayseer Group Factory\nMonday, 5 October 2026\nDriver Name\tIqama #\tDriver Mobile #\tEquipment#\tVehicle Plate No\tSource\tDestination\tCustomer\tSupplier\tStore\tEquipment Type\tCommodity\tWaybill#\tDN Number\tTransporter\tNotes\tBayan Expairy\nTLS Fleets\nMUHAMMAD FAYYAZ AWAN\t2326626773\t595343932\tDT-01\tأ ح د D J A 4829\tYanbu\tYanbu\t\tLUBEREF\tTayseer Group Factory\tDumber\tSULPHUR / 25 MT\t51135\t\tTLS\t\t\nSARU IBRAHIM\t2598393839\t531330746\t135HCL19\tأ ر ك K R A 7503\tYanbu\tYanbu\t\tTRONOX\tTLS Warehouse\tTanker\tCS / 25 MT\t51140\t\tTLS\t\t\n...`}
                    rows={10}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 custom-scrollbar leading-relaxed"
                  />
                </div>

                {/* Controls & Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleParseTemplate()}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition"
                    >
                      <Play className="w-4 h-4 fill-white" /> Parse Ready Schedule
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 shadow flex items-center gap-2 transition"
                      title="Upload an Excel (.xlsx/.xls) or TSV/CSV file"
                    >
                      <Upload className="w-4 h-4 text-blue-400" /> Upload File (.xlsx, .tsv)
                    </button>

                    <button
                      type="button"
                      onClick={handleLoadSampleTemplate}
                      className="bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 border border-purple-500/40 font-semibold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5"
                      title="Load Tayseer Group Factory 05-Oct-2026 Sample (39 rows)"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Load Sample Ready Schedule
                    </button>

                    <button
                      type="button"
                      onClick={handleClearNew}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
                    >
                      Clear
                    </button>
                  </div>

                  {newRows && newRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveNew}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition"
                    >
                      <Check className="w-4 h-4" /> Save as {fmtDate(newDate || todayISO())} ({newRows.length} Dispatches)
                    </button>
                  )}
                </div>

                {/* Column Structure Badge */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-slate-200 font-bold">Headers:</span>
                  <span>Driver Name</span>
                  <span className="text-slate-600">·</span>
                  <span>Iqama #</span>
                  <span className="text-slate-600">·</span>
                  <span>Mobile #</span>
                  <span className="text-slate-600">·</span>
                  <span>Plate No</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-sky-300 font-bold bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-700/60" title="Equipment Number like DT-01, 135HCL19, 4004006">
                    Equipment# (Unit ID)
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>Customer</span>
                  <span className="text-slate-600">·</span>
                  <span>Source</span>
                  <span className="text-slate-600">·</span>
                  <span>Destination</span>
                  <span className="text-slate-600">·</span>
                  <span>Commodity</span>
                  <span className="text-slate-600">·</span>
                  <span>Supplier</span>
                  <span className="text-slate-600">·</span>
                  <span>Store</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-700/60" title="Equipment Type like Dumber, Tanker, Flatbed">
                    Equipment Type (Dumber/Tanker/Flatbed)
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>Waybill#</span>
                  <span className="text-slate-600">·</span>
                  <span>DN Number</span>
                  <span className="text-slate-600">·</span>
                  <span>Transporter</span>
                  <span className="text-slate-600">·</span>
                  <span>Notes</span>
                  <span className="text-slate-600">·</span>
                  <span>Bayan Expiry</span>
                </div>
              </div>
            )}

            {/* OPTION 1: MAIL ORDER SCHEDULE */}
            {ingestMode === 'mail' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Paste the Tentative Loading Schedule from the email or spreadsheet. Then click Parse.
                  </span>
                  {parseInfo && (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-lg">
                      {parseInfo}
                    </span>
                  )}
                </div>

                <textarea
                  value={mailInput}
                  onChange={e => setMailInput(e.target.value)}
                  placeholder={`Tentative Loading Schedule 01-10-2026\nMaterial\tNumber of Trucks\tEquipped with\tPacking\tWeight [kg]\tCustomer/Supplier/Store\tSource\tDestination\tRequirements\nSulfuric Acid\n3\tTanker\tBulk\t24500\tPetro- Rabigh Alky Plant\tYanbu\tRabigh\t\nCaustic Soda\n2\tTanker\tBulk\t25000\tTRONOX\tYanbu\tYanbu\t`}
                  rows={9}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 custom-scrollbar leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleParseMail}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition"
                    >
                      <Play className="w-4 h-4 fill-white" /> Parse Schedule
                    </button>
                    <button
                      type="button"
                      onClick={handleClearNew}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition"
                    >
                      Clear
                    </button>
                  </div>

                  {newRows && newRows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSaveNew}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transition"
                    >
                      <Check className="w-4 h-4" /> Save as {fmtDate(newDate || todayISO())}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Preview of parsed rows */}
          {newRows && newRows.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live Preview ({newRows.length} Rows) for {fmtDate(newDate || todayISO())}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <GripVertical className="w-3 h-3 text-blue-400" />
                    <span><b>Manual sequence reordering:</b> Drag the (⋮⋮) grip icon or click ↑ / ↓ arrows on any row to change its sequence order. Double-click cells to edit.</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveNew}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow flex items-center gap-1.5 transition"
                  >
                    <Check className="w-3.5 h-3.5" /> Save as {fmtDate(newDate || todayISO())}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px] custom-scrollbar border border-slate-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-20 border-b border-slate-800">
                    <tr>
                      <th className="w-16 min-w-[64px] text-center py-2.5 px-1 sticky left-0 bg-slate-950 z-30 font-mono text-[10px] text-slate-500">
                        SEQ
                      </th>
                      {visibleColumns.map(colKey => {
                        const colDef = COLUMNS.find(c => c.key === colKey);
                        const isSticky = colKey === 'driverName';
                        return (
                          <th
                            key={colKey}
                            className={`py-2.5 px-3 whitespace-nowrap font-bold ${
                              isSticky ? 'sticky left-16 bg-slate-950 z-20 text-white' : ''
                            }`}
                            style={{ minWidth: `${colDef?.w || 120}px` }}
                          >
                            {colDef?.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">{renderTableRows(newRows, true)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =============================================================
          PAGE 2: SCHEDULE (LIST VIEW & DAILY VIEW)
          ============================================================= */}
      {page === 'schedule' && (
        <div className="space-y-3">
          {!currentSchedule ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 space-y-3">
              <h3 className="text-base font-bold text-white">No schedule found for {fmtDate(currentDate)}</h3>
              <p className="text-xs">
                Click <b>New</b> to paste a mail order, or use the <b>Open</b> dropdown above to view an existing schedule.
              </p>
              <button
                onClick={() => setPage('new')}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                Create Schedule
              </button>
            </div>
          ) : (
            <>
              {/* Filter bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="🔍 Search any value..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-blue-500"
                  />
                </div>

                <input
                  type="date"
                  value={currentDate}
                  onChange={e => {
                    if (e.target.value) {
                      setCurrentDate(e.target.value);
                      updateDb(prev => ({
                        ...prev,
                        uiPrefs: { ...prev.uiPrefs, lastDate: e.target.value }
                      }));
                    }
                  }}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                />

                {/* Filter Chips */}
                <button
                  onClick={() => setFilterPending(!filterPending)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    filterPending
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ⚠ Pending
                </button>

                <button
                  onClick={() => setFilterGroup('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    filterGroup === 'all'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  All
                </button>

                <button
                  onClick={() => setFilterGroup('tls')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    filterGroup === 'tls'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  TLS Fleets
                </button>

                <button
                  onClick={() => setFilterGroup('ext')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    filterGroup === 'ext'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  External Trips
                </button>

                <button
                  onClick={() => {
                    const next = !enableSort;
                    setEnableSort(next);
                    updateDb(prev => ({
                      ...prev,
                      uiPrefs: { ...prev.uiPrefs, enableSort: next }
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    enableSort
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Sort rows by priority sequence P1–P11"
                >
                  ⬆ Priority Sort
                </button>

                <button
                  onClick={() => {
                    const next = !showPriority;
                    setShowPriority(next);
                    updateDb(prev => ({
                      ...prev,
                      uiPrefs: { ...prev.uiPrefs, showPriority: next }
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    showPriority
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Show priority badge numbers on rows"
                >
                  ＃ Show P#
                </button>

                <div className="flex-1" />

                {/* Right Action buttons */}
                <button
                  onClick={() => setIsColPanelOpen(!isColPanelOpen)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    isColPanelOpen
                      ? 'bg-slate-800 text-white border-slate-600'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" /> Columns
                </button>

                <button
                  onClick={handleAddRow}
                  className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>

                <button
                  onClick={exportExcel}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow transition flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>

                <button
                  onClick={exportCsv}
                  className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                >
                  CSV
                </button>

                <button
                  onClick={handleDeleteSchedule}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/50 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Column selector panel */}
              {isColPanelOpen && (
                <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2.5 animate-fade-in">
                  <div className="text-xs text-slate-400">
                    Editing columns for <b className="text-blue-400">{view === 'daily' ? 'Daily View' : 'List View'}</b> — each view maintains its column preferences independently.
                  </div>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {COLUMNS.map(c => (
                      <label
                        key={c.key}
                        className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(c.key)}
                          onChange={() => toggleColumn(c.key)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* View Switcher Tabs: List View vs Daily View */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
                <button
                  onClick={() => setView('list')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                    view === 'list'
                      ? 'text-blue-400 border-blue-500'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  📋 List View
                </button>
                <button
                  onClick={() => setView('daily')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                    view === 'daily'
                      ? 'text-blue-400 border-blue-500'
                      : 'text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  📅 Daily View
                </button>
              </div>

              {/* Main Timetable */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto max-h-[calc(100vh-320px)] custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-20 border-b border-slate-800 shadow">
                      <tr>
                        <th className="w-16 min-w-[64px] text-center py-2.5 px-1 sticky left-0 bg-slate-950 z-30 font-mono text-[10px] text-slate-500">
                          SEQ
                        </th>
                        {visibleColumns.map(colKey => {
                          const colDef = COLUMNS.find(c => c.key === colKey);
                          const isSticky = colKey === 'driverName';
                          return (
                            <th
                              key={colKey}
                              className={`py-2.5 px-3 whitespace-nowrap font-bold text-slate-300 ${
                                isSticky ? 'sticky left-16 bg-slate-950 z-20 text-white' : ''
                              }`}
                              style={{ minWidth: `${colDef?.w || 120}px` }}
                            >
                              {colDef?.label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {currentVisibleRows.length ? (
                        renderTableRows(currentVisibleRows, false)
                      ) : (
                        <tr>
                          <td colSpan={visibleColumns.length + 1} className="py-12 text-center text-slate-500">
                            No rows match the current filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stats footer */}
              <div className="text-xs font-mono text-slate-400 px-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  {totalRowsCount} rows · <span className="text-emerald-400">{assignedCount} assigned</span> ·{' '}
                  <span className="text-amber-400">{pendingCount} pending</span> ·{' '}
                  <span className="text-blue-400 font-bold">{totalMT.toFixed(2)} MT total</span> ·{' '}
                  {enableSort ? 'Sorted by priority' : 'Original order'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Tip: Double-click any cell to edit · Click to copy · Shift+click to copy range (TSV)
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =============================================================
          PAGE 3: DRIVERS REGISTRY
          ============================================================= */}
      {page === 'drivers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" /> Drivers Registry
              </h3>
              <span className="text-xs font-mono text-slate-400">({db.drivers.length} drivers)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="🔍 Search drivers..."
                  value={driverSearch}
                  onChange={e => setDriverSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
              <button
                onClick={handleAddDriver}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Driver
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="p-3 w-[45%]">Name</th>
                  <th className="p-3 w-[25%]">Iqama #</th>
                  <th className="p-3 w-[25%]">Mobile #</th>
                  <th className="p-3 w-[5%] text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {db.drivers
                  .filter(d =>
                    !driverSearch ||
                    d.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
                    d.iqama.includes(driverSearch) ||
                    d.mobile.includes(driverSearch)
                  )
                  .map(d => (
                    <tr key={d.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-2">
                        <input
                          type="text"
                          value={d.name}
                          onChange={e => handleUpdateDriver(d.id, 'name', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-white outline-none font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={d.iqama}
                          onChange={e => handleUpdateDriver(d.id, 'iqama', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-slate-200 outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={d.mobile}
                          onChange={e => handleUpdateDriver(d.id, 'mobile', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-slate-200 outline-none font-mono"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteDriver(d.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =============================================================
          PAGE 4: VEHICLES / EQUIPMENT REGISTRY
          ============================================================= */}
      {page === 'vehicles' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-blue-400" /> Vehicles &amp; Equipment
              </h3>
              <span className="text-xs font-mono text-slate-400">
                ({db.vehicles.length} units · Type auto-derived from Equipment#)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="🔍 Search vehicles..."
                  value={vehicleSearch}
                  onChange={e => setVehicleSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
                />
              </div>
              <button
                onClick={handleAddVehicle}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Vehicle
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] custom-scrollbar border border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="p-3 w-[22%]">Equipment#</th>
                  <th className="p-3 w-[12%]">Type</th>
                  <th className="p-3 w-[28%]">Plate No</th>
                  <th className="p-3 w-[33%]">Default Driver</th>
                  <th className="p-3 w-[5%] text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {db.vehicles
                  .filter(v =>
                    !vehicleSearch ||
                    v.equipmentNo.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                    v.plateNo.toLowerCase().includes(vehicleSearch.toLowerCase())
                  )
                  .map(v => (
                    <tr key={v.id} className="hover:bg-slate-800/50 transition">
                      <td className="p-2">
                        <input
                          type="text"
                          value={v.equipmentNo}
                          onChange={e => handleUpdateVehicle(v.id, 'equipmentNo', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-white outline-none font-mono font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            v.type === 'Dumber'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : v.type === 'Flatbed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {v.type}
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={v.plateNo}
                          onChange={e => handleUpdateVehicle(v.id, 'plateNo', e.target.value)}
                          dir="auto"
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-slate-100 outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={v.defaultDriverId || ''}
                          onChange={e => handleUpdateVehicle(v.id, 'defaultDriverId', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2 py-1 text-xs text-slate-200 outline-none"
                        >
                          <option value="">— none —</option>
                          {db.drivers.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =============================================================
          PAGE 5: SETTINGS (COMMODITY DICTIONARY, STORE MAP, PRIORITY GUIDE)
          ============================================================= */}
      {page === 'settings' && (
        <div className="space-y-6">
          {/* Commodity Dictionary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🧪</span> Commodity Dictionary
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-configured abbreviations, aliases, and Jumbo Bag metric tonnage equivalents.
                </p>
              </div>
              <button
                onClick={handleAddCommodity}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Commodity
              </button>
            </div>

            <div className="overflow-x-auto max-h-[400px] custom-scrollbar border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-[30%]">Canonical Name</th>
                    <th className="p-3 w-[15%]">Short Form</th>
                    <th className="p-3 w-[35%]">Aliases (comma-separated)</th>
                    <th className="p-3 w-[15%]">Jumbo Bag MT</th>
                    <th className="p-3 w-[5%] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {db.commodities.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50 transition">
                      <td className="p-2">
                        <input
                          type="text"
                          value={c.canonical}
                          onChange={e => handleUpdateCommodity(idx, 'canonical', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-white outline-none font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={c.shortForm}
                          onChange={e => handleUpdateCommodity(idx, 'shortForm', e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-sky-400 outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={(c.aliases || []).join(', ')}
                          onChange={e =>
                            handleUpdateCommodity(
                              idx,
                              'aliases',
                              e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            )
                          }
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-slate-300 outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.05"
                          value={c.jumboBagMT || ''}
                          onChange={e =>
                            handleUpdateCommodity(idx, 'jumboBagMT', parseFloat(e.target.value) || 1.25)
                          }
                          className="w-24 bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-amber-300 outline-none font-mono"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteCommodity(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Store Map */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🏢</span> Store Map
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Maps dispatch destination keywords to standard internal store locations.
                </p>
              </div>
              <button
                onClick={handleAddStore}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Store
              </button>
            </div>

            <div className="overflow-x-auto max-h-[300px] custom-scrollbar border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-[45%]">Destination Key</th>
                    <th className="p-3 w-[50%]">Official Store Name</th>
                    <th className="p-3 w-[5%] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {Object.entries(db.storeMap).map(([k, v]) => (
                    <tr key={k} className="hover:bg-slate-800/50 transition">
                      <td className="p-2">
                        <input
                          type="text"
                          defaultValue={k}
                          onBlur={e => handleUpdateStore(k, e.target.value.trim(), v)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-white outline-none font-semibold font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={v}
                          onChange={e => handleUpdateStore(k, k, e.target.value)}
                          className="w-full bg-slate-950/60 border border-transparent hover:border-slate-700 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-slate-200 outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDeleteStore(k)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Priority Sort Order Guide */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>⚡</span> Priority Sort Order (v4 Logic)
            </h3>
            <p className="text-xs text-slate-400">
              When <b>⬆ Priority Sort</b> is enabled, rows are automatically sorted from P1 to P11, followed by all remaining commodities (P999).
            </p>
            <ol className="text-xs space-y-2 pt-1 font-mono">
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-rose-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P1
                </span>
                <span>LUBEREF (as customer or supplier)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-orange-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P2
                </span>
                <span>
                  Customer = <b>TRONOX</b> and commodity = <b>Caustic Soda</b>
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-amber-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P3
                </span>
                <span>Internal transfer (TLS ↔ TPF / Nagadhi / Dammam)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-yellow-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P4
                </span>
                <span>Caustic Soda (CS)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-lime-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P5
                </span>
                <span>Ferric Chloride (FC)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-emerald-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P6
                </span>
                <span>PAC / Poly Aluminium</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-cyan-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P7
                </span>
                <span>AS / Aluminium Sulphate</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-blue-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P8
                </span>
                <span>SMBS</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-violet-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P9
                </span>
                <span>SBS</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-purple-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P10
                </span>
                <span>HCL / Hydrochloric Acid</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="prio-badge bg-fuchsia-600 text-white px-2 py-0.5 rounded font-black text-[10px]">
                  P11
                </span>
                <span>SA / Sulfuric Acid</span>
              </li>
              <li className="flex items-center gap-2.5 text-slate-400">
                <span className="prio-badge bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-black text-[10px]">
                  —
                </span>
                <span>Everything else (Priority 999)</span>
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Datalists for autocompleting driver name, equipment#, and plate# */}
      <datalist id="dl-drivers-tt-edit">
        {db.drivers.map(d => (
          <option key={d.id} value={d.name}>
            {d.iqama ? `Iqama: ${d.iqama}` : ''}
          </option>
        ))}
      </datalist>

      <datalist id="dl-equipment-tt-edit">
        {db.vehicles.map(v => (
          <option key={v.id} value={v.equipmentNo}>
            {v.plateNo ? `Plate: ${v.plateNo}` : ''} ({v.type})
          </option>
        ))}
      </datalist>

      <datalist id="dl-plates-tt-edit">
        {db.vehicles
          .filter(v => v.plateNo)
          .map(v => (
            <option key={v.id} value={v.plateNo}>
              {v.equipmentNo} ({v.type})
            </option>
          ))}
      </datalist>

      <datalist id="dl-equipment-types-tt-edit">
        <option value="Dumber">Dumber (Dump Truck)</option>
        <option value="Tanker">Tanker (Liquid Tanker)</option>
        <option value="Flatbed">Flatbed (Flatbed Trailer)</option>
        <option value="Trailer">Trailer</option>
        <option value="Curtain">Curtain Side</option>
        <option value="Lowbed">Lowbed</option>
      </datalist>
    </div>
  );
};
