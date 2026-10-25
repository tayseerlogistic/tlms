// =====================================================================
// Timetable Dispatch Engine & Data Services (v4)
// =====================================================================

import { TimetableRow } from '../types';
import { ksaDateISO } from './dateUtils';

export interface TimetableDriver {
  id: string;
  name: string;
  iqama: string;
  mobile: string;
}

export interface TimetableVehicle {
  truckId?: string | null;
  id: string;
  equipmentNo: string;
  plateNo: string;
  type: 'Tanker' | 'Flatbed' | 'Dumber';
  defaultDriverId: string;
  isThirdParty: boolean;
}

export interface TimetableCommodity {
  canonical: string;
  shortForm: string;
  aliases: string[];
  jumboBagMT: number;
}

export interface TimetableStoreMap {
  [dest: string]: string;
}

export interface TimetableUiPrefs {
  visibleColumnsList: string[] | null;
  visibleColumnsDaily: string[] | null;
  lastDate: string | null;
  showPriority: boolean;
  enableSort: boolean;
}

export interface TimetableSchedule {
  date: string;
  rows: TimetableRow[];
  createdAt: string;
  updatedAt: string;
}

export interface TimetableDatabase {
  drivers: TimetableDriver[];
  vehicles: TimetableVehicle[];
  commodities: TimetableCommodity[];
  storeMap: TimetableStoreMap;
  schedules: Record<string, TimetableSchedule>;
  uiPrefs: TimetableUiPrefs;
}

export const COLUMNS: { key: keyof TimetableRow; label: string; def: boolean; w: number }[] = [
  { key: 'driverName', label: 'Driver Name', def: true, w: 180 },
  { key: 'iqama', label: 'Iqama #', def: true, w: 110 },
  { key: 'mobile', label: 'Driver Mobile #', def: true, w: 125 },
  { key: 'equipmentNo', label: 'Equipment #', def: true, w: 110 },
  { key: 'plateNo', label: 'Vehicle Plate No', def: true, w: 150 },
  { key: 'source', label: 'Source', def: true, w: 100 },
  { key: 'destination', label: 'Destination', def: true, w: 110 },
  { key: 'customer', label: 'Customer', def: true, w: 160 },
  { key: 'supplier', label: 'Supplier', def: true, w: 140 },
  { key: 'store', label: 'Store', def: true, w: 160 },
  { key: 'equipmentType', label: 'Equipment Type', def: true, w: 125 },
  { key: 'commodity', label: 'Commodity', def: true, w: 280 },
  { key: 'waybill', label: 'Waybill #', def: true, w: 100 },
  { key: 'dn', label: 'DN Number', def: true, w: 100 },
  { key: 'transporter', label: 'Transporter', def: true, w: 120 },
  { key: 'notes', label: 'Notes', def: true, w: 180 },
  { key: 'bayanExpiry', label: 'Bayan Expiry', def: true, w: 120 }
];

export const OFFICIAL_EXPORT_COLUMNS: [keyof TimetableRow, string][] = [
  ['driverName', 'Driver Name'],
  ['iqama', 'Iqama #'],
  ['mobile', 'Driver Mobile #'],
  ['equipmentNo', 'Equipment #'],
  ['plateNo', 'Vehicle Plate No'],
  ['source', 'Source'],
  ['destination', 'Destination'],
  ['customer', 'Customer'],
  ['supplier', 'Supplier'],
  ['store', 'Store'],
  ['equipmentType', 'Equipment Type'],
  ['commodity', 'Commodity'],
  ['waybill', 'Waybill #'],
  ['dn', 'DN Number'],
  ['transporter', 'Transporter'],
  ['notes', 'Notes'],
  ['bayanExpiry', 'Bayan Expiry']
];

export const OUR_LOCS = ['tls', 'tpf', 'nagadhi', 'dammam'];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function todayISO() {
  return ksaDateISO();
}

export function fmtDate(iso: string) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

export function deriveEquipmentType(equipmentNo: string): 'Tanker' | 'Flatbed' | 'Dumber' {
  const eq = String(equipmentNo || '').trim().toUpperCase();
  if (!eq) return 'Tanker';
  if (eq.startsWith('DT')) return 'Dumber';
  if (/^40040/.test(eq) || eq.startsWith('4004')) return 'Flatbed';
  return 'Tanker';
}

export function bayanClass(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const days = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 3) return 'bg-rose-950/80 text-rose-300 font-bold border border-rose-500/50';
  if (days <= 7) return 'bg-amber-950/80 text-amber-300 font-bold border border-amber-500/50';
  return '';
}

// ---------------------------------------------------------------------
// SEED DATA
// ---------------------------------------------------------------------
export function loadTimetableDatabase(): TimetableDatabase {
  let uiPrefs = {visibleColumnsList:null,visibleColumnsDaily:null,lastDate:null,showPriority:true,enableSort:true};
  try { uiPrefs = {...uiPrefs,...JSON.parse(localStorage.getItem('tlms.timetable.uiPrefs') || '{}')}; } catch { /* Invalid preferences use defaults. */ }
  return {drivers:[],vehicles:[],commodities:[],storeMap:{},schedules:{},uiPrefs};
}
export function saveTimetableDatabase(db: TimetableDatabase): void {
  localStorage.setItem('tlms.timetable.uiPrefs', JSON.stringify(db.uiPrefs));
}

// ---------------------------------------------------------------------
// COMMODITY & PARSING UTILITIES
// ---------------------------------------------------------------------
export function findCommodity(commodities: TimetableCommodity[], name: string): TimetableCommodity | null {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  for (const c of commodities) {
    if (c.canonical.toLowerCase() === n) return c;
    if ((c.aliases || []).some(a => a.toLowerCase() === n)) return c;
    if (c.shortForm && c.shortForm.toLowerCase() === n) return c;
  }
  return null;
}

export function shortFormFor(commodities: TimetableCommodity[], name: string): string {
  const c = findCommodity(commodities, name);
  return c ? c.shortForm : name;
}

export function buildCommodityString(
  commodities: TimetableCommodity[],
  material: string,
  packing: string,
  weightKg: number | string,
  equipmentType: string
): string {
  const w = parseFloat(String(weightKg)) || 0;
  const mt = w / 1000;
  const mtStr = (mt % 1 === 0) ? String(mt) : mt.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const name = (material || '').trim();
  const pack = (packing || '').trim();
  const p = pack.toLowerCase();
  const eq = (equipmentType || '').toLowerCase();

  if (p === 'bulk' && eq.includes('tank')) return `${shortFormFor(commodities, name)} / ${mtStr} MT`;
  if (/25\s*kg/i.test(p)) {
    const bags = w ? Math.round(w / 25) : '';
    const bagsPart = bags ? `${bags} Bags / ` : '';
    return `${name} / 25 Kg Bags / ${bagsPart}${mtStr} MT`;
  }
  if (/jumbo/i.test(p)) {
    const comm = findCommodity(commodities, name);
    const bagMT = (comm && comm.jumboBagMT) ? comm.jumboBagMT : 1.25;
    const bags = mt ? Math.round(mt / bagMT) : '';
    const bagsPart = bags ? `${bags} Jumbo Bags / ` : '';
    return `${name} / ${bagsPart}${mtStr} MT`;
  }
  const ibc = pack.match(/(\d+)\s*IBC/i);
  if (ibc) return `${name} / ${ibc[1]} IBCs / ${mtStr} MT`;
  const dr = pack.match(/(\d+)\s*Drum/i);
  if (dr) return `${name} / ${dr[1]} Drums / ${mtStr} MT`;
  const pal = pack.match(/(\d+)\s*Pallet/i);
  if (pal) return `${name} / ${pal[1]} Pallets / ${mtStr} MT`;
  if (mt > 0) return `${name} / ${mtStr} MT`;
  return name;
}

export function classifyParty(source: string, destination: string): 'internal' | 'supplier' | 'customer' {
  const s = (source || '').toLowerCase().trim();
  const d = (destination || '').toLowerCase().trim();
  const isOursS = OUR_LOCS.includes(s);
  const isOursD = OUR_LOCS.includes(d);
  if (isOursS && isOursD) return 'internal';
  if (!isOursS && isOursD) return 'supplier';
  return 'customer';
}

export function mapStore(storeMap: TimetableStoreMap, destination: string): string {
  const key = (destination || '').trim();
  return storeMap[key] || '';
}

export function parseMailOrder(
  text: string,
  commodities: TimetableCommodity[],
  storeMap: TimetableStoreMap
): { date: string; rows: TimetableRow[] } {
  const rawLines = String(text).replace(/\r/g, '').split('\n');
  let scheduleDate = null;
  let currentMaterial = null;
  let isInternal = false;
  const rows: TimetableRow[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const line = raw.trim();
    if (!line) continue;

    if (/Tentative Loading Schedule/i.test(line)) {
      const m = line.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        scheduleDate = `${m[3]}-${mm}-${dd}`;
      }
      continue;
    }
    if (/^Material\b/i.test(line) && /Number of Trucks/i.test(line)) continue;

    const cells = raw.split('\t').map(c => c.trim());
    while (cells.length && cells[cells.length - 1] === '') cells.pop();

    if (cells.length === 1 && cells[0]) {
      currentMaterial = cells[0];
      isInternal = /internal transfer/i.test(currentMaterial);
      continue;
    }
    if (cells.length < 2) continue;

    let numTrucks = parseInt(cells[0]);
    if (isNaN(numTrucks)) {
      currentMaterial = cells[0];
      isInternal = /internal transfer/i.test(currentMaterial);
      cells.shift();
      numTrucks = parseInt(cells[0]);
      if (isNaN(numTrucks)) continue;
    }

    const equipped = cells[1] || '';
    const packing = cells[2] || '';
    const weight = cells[3] || '';
    const colF = cells[4] || '';
    const source = cells[5] || '';
    const destination = cells[6] || '';
    const requirements = cells[7] || '';

    let commodityRaw = '';
    let partyName = '';
    if (isInternal) {
      commodityRaw = colF;
      partyName = '';
    } else {
      commodityRaw = currentMaterial || '';
      partyName = colF;
    }

    const commodityStr = buildCommodityString(commodities, commodityRaw, packing, weight, equipped);

    let customer = '';
    let supplier = '';
    if (!isInternal) {
      const party = classifyParty(source, destination);
      if (party === 'supplier') supplier = partyName;
      else if (party === 'customer') customer = partyName;
    }
    const store = mapStore(storeMap, destination);

    for (let n = 0; n < numTrucks; n++) {
      const rowId = uid();
      const row: TimetableRow = {
        id: rowId,
        driverName: '',
        iqama: '',
        mobile: '',
        plateNo: '',
        equipmentNo: '',
        customer,
        supplier,
        store,
        source,
        destination,
        equipmentType: equipped,
        commodity: commodityStr,
        waybill: '',
        dn: '',
        transporter: '',
        notes: requirements,
        bayanExpiry: ''
      };
      row.priority = schedulePriority(row);
      rows.push(row);
    }
  }

  return { date: scheduleDate || todayISO(), rows };
}

// ---------------------------------------------------------------------
// PRIORITY CALCULATION
// ---------------------------------------------------------------------
function matchComm(commodity: string, names: string[]): boolean {
  const c = String(commodity || '');
  const cl = c.toLowerCase();
  for (const n of names) {
    const nn = String(n).trim();
    if (!nn) continue;
    if (/^[A-Z]{2,6}$/.test(nn)) {
      const re = new RegExp('(^|[^A-Za-z])' + nn + '([^A-Za-z]|$)', 'i');
      if (re.test(c)) return true;
    } else {
      if (cl.includes(nn.toLowerCase())) return true;
    }
  }
  return false;
}

export function schedulePriority(r: Partial<TimetableRow>): number {
  const partyBlob = (String(r.supplier || '') + ' ' + String(r.customer || '')).toLowerCase();

  // 1) LUBEREF (either field)
  if (partyBlob.includes('lubref') || partyBlob.includes('lubereff')) return 1;

  const commodity = String(r.commodity || '');
  const customer = String(r.customer || '');

  // 2) TRONOX + Caustic Soda
  if (/tronox/i.test(customer) && matchComm(commodity, ['Caustic Soda', 'CS'])) return 2;

  // 3) Internal transfer
  const src = String(r.source || '').toLowerCase().trim();
  const dst = String(r.destination || '').toLowerCase().trim();
  if (OUR_LOCS.includes(src) && OUR_LOCS.includes(dst)) return 3;

  // 4-11) commodity groups
  if (matchComm(commodity, ['Caustic Soda', 'CS'])) return 4;
  if (matchComm(commodity, ['Ferric Chloride', 'FC'])) return 5;
  if (matchComm(commodity, ['PAC', 'Poly Aluminium', 'Poly Almunium', 'Poly Aluminum'])) return 6;
  if (matchComm(commodity, ['Aluminium Sulphate', 'Aluminum Sulphate', 'AS'])) return 7;
  if (matchComm(commodity, ['SMBS'])) return 8;
  if (matchComm(commodity, ['SBS'])) return 9;
  if (matchComm(commodity, ['HCL', 'Hydrochloric Acid'])) return 10;
  if (matchComm(commodity, ['Sulfuric Acid', 'Sulphuric Acid', 'SA'])) return 11;

  return 999;
}

// ---------------------------------------------------------------------
// READY SCHEDULE TEMPLATE PARSER (Option 2: Direct Sheet/Template Ingestion)
// ---------------------------------------------------------------------
const MONTH_NAME_MAP: Record<string, string> = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12'
};

export function parseDateFromText(text: string): string | null {
  // 1. "Monday, 5 October 2026" or "5 October 2026"
  const m1 = text.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const month = MONTH_NAME_MAP[m1[2].toLowerCase()];
    const year = m1[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // 2. "DD-MM-YYYY" or "DD/MM/YYYY" or "DD.MM.YYYY"
  const m2 = text.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (m2) {
    const day = m2[1].padStart(2, '0');
    const month = m2[2].padStart(2, '0');
    const year = m2[3];
    return `${year}-${month}-${day}`;
  }

  // 3. "YYYY-MM-DD"
  const m3 = text.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m3) {
    const year = m3[1];
    const month = m3[2].padStart(2, '0');
    const day = m3[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function parseReadySchedule(
  text: string,
  commodities: TimetableCommodity[] = [],
  storeMap: TimetableStoreMap = {}
): { date: string; rows: TimetableRow[] } {
  const rawLines = String(text || '').replace(/\r/g, '').split('\n');
  let scheduleDate: string | null = null;
  const rows: TimetableRow[] = [];
  let currentGroupTransporter = 'TLS';

  let headerIndex = -1;
  let colMap: Partial<Record<keyof TimetableRow, number>> = {
    driverName: 0,
    iqama: 1,
    mobile: 2,
    equipmentNo: 3,
    plateNo: 4,
    source: 5,
    destination: 6,
    customer: 7,
    supplier: 8,
    store: 9,
    equipmentType: 10,
    commodity: 11,
    waybill: 12,
    dn: 13,
    transporter: 14,
    notes: 15,
    bayanExpiry: 16,
    id: -1,
    priority: -1
  };

  // Step 1: Detect Date and Header Row
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // Detect date from early lines (e.g. "Monday, 5 October 2026")
    if (!scheduleDate) {
      const detectedDate = parseDateFromText(line);
      if (detectedDate) {
        scheduleDate = detectedDate;
      }
    }

    // Check if this line is the Column Header Row
    const lineLower = line.toLowerCase();
    if (
      (lineLower.includes('driver name') && lineLower.includes('equipment')) ||
      (lineLower.includes('driver name') && lineLower.includes('plate')) ||
      (lineLower.includes('iqama') && lineLower.includes('plate'))
    ) {
      headerIndex = i;
      const headers = rawLines[i].split('\t').map(h => h.trim().toLowerCase());

      headers.forEach((rawH, idx) => {
        const h = rawH.replace(/[\r\n\t]+/g, ' ').trim().toLowerCase();
        const clean = h.replace(/[^a-z0-9#]/g, ' ').replace(/\s+/g, ' ').trim();

        if (clean.includes('driver name') || clean === 'driver') colMap.driverName = idx;
        else if (clean.includes('iqama')) colMap.iqama = idx;
        else if (clean.includes('mobile') || clean.includes('phone') || clean.includes('contact')) colMap.mobile = idx;
        else if (clean.includes('plate') || clean.includes('vehicle plate')) colMap.plateNo = idx;
        // CRITICAL FIX: Match "Equipment Type" FIRST so "equipment#" doesn't steal it
        else if (
          clean.includes('equipment type') ||
          clean.includes('equip type') ||
          clean.includes('trailer type') ||
          clean === 'type' ||
          clean === 'trailer'
        ) {
          colMap.equipmentType = idx;
        }
        // Match "Equipment#" or "Equipment No"
        else if (
          clean.includes('equipment#') ||
          clean.includes('equipment no') ||
          clean.includes('equipment number') ||
          (clean.includes('equipment') && !clean.includes('type')) ||
          clean === 'equipment#' ||
          clean === 'eq#' ||
          clean === 'equip#'
        ) {
          colMap.equipmentNo = idx;
        }
        else if (clean.includes('source') || clean === 'from') colMap.source = idx;
        else if (clean.includes('destination') || clean === 'to') colMap.destination = idx;
        else if (clean.includes('customer')) colMap.customer = idx;
        else if (clean.includes('supplier')) colMap.supplier = idx;
        else if (clean.includes('store')) colMap.store = idx;
        else if (clean.includes('commodity') || clean.includes('material')) colMap.commodity = idx;
        else if (clean.includes('waybill') || clean.includes('waybill#')) colMap.waybill = idx;
        else if (clean.includes('dn') || clean.includes('delivery note')) colMap.dn = idx;
        else if (clean.includes('transporter')) colMap.transporter = idx;
        else if (clean.includes('notes') || clean.includes('requirement')) colMap.notes = idx;
        else if (clean.includes('bayan')) colMap.bayanExpiry = idx;
      });
      break;
    }
  }

  // Step 2: Parse Rows
  const startIdx = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startIdx; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Check for section header lines (e.g. "TLS Fleets", "External Trips")
    if (/^TLS\s*Fleets/i.test(trimmed)) {
      currentGroupTransporter = 'TLS';
      continue;
    }
    if (/^External\s*(?:Trips|Fleet)?/i.test(trimmed)) {
      currentGroupTransporter = 'External';
      continue;
    }

    const cells = rawLine.split('\t').map(c => c.trim());
    // Remove trailing empty cells
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.length === 0) continue;

    const getVal = (col: keyof TimetableRow): string => {
      const idx = colMap[col];
      return idx !== undefined && idx >= 0 && idx < cells.length ? cells[idx] || '' : '';
    };

    const driverName = getVal('driverName');
    const plateNo = getVal('plateNo');
    let equipmentNo = getVal('equipmentNo');
    const commodity = getVal('commodity');
    const source = getVal('source');
    const destination = getVal('destination');
    const customer = getVal('customer');
    const supplier = getVal('supplier');
    const store = getVal('store');
    const waybill = getVal('waybill');
    const dn = getVal('dn');
    const notes = getVal('notes');
    const iqama = getVal('iqama');
    const mobile = getVal('mobile');
    let equipmentType = getVal('equipmentType');
    let transporter = getVal('transporter') || currentGroupTransporter;
    let bayanExpiry = getVal('bayanExpiry');

    // Skip lines that have no logistical data (like company name or stray headers)
    if (!driverName && !plateNo && !equipmentNo && !commodity && !source && !destination && !waybill) {
      continue;
    }

    // -----------------------------------------------------------------
    // DISAMBIGUATION: Equipment# (unit ID) vs Equipment Type (category)
    // Equipment# is like: DT-01, 135HCL19, 217SLF19, 4004006, 4004010...
    // Equipment Type is like: Dumber, Tanker, Flatbed...
    // -----------------------------------------------------------------
    const KNOWN_TYPE_WORDS = ['DUMBER', 'DUMPER', 'TANKER', 'FLATBED', 'TRAILER', 'CURTAIN', 'LOWBED'];
    const eqNoUpper = equipmentNo.trim().toUpperCase();
    const eqTypeUpper = equipmentType.trim().toUpperCase();

    // Check if equipmentNo mistakenly contains a type word while equipmentType has the actual equipment ID
    if (KNOWN_TYPE_WORDS.includes(eqNoUpper)) {
      if (equipmentType && !KNOWN_TYPE_WORDS.includes(eqTypeUpper)) {
        // Inverted: swap them!
        const temp = equipmentNo;
        equipmentNo = equipmentType;
        equipmentType = temp;
      } else if (!equipmentType) {
        equipmentType = equipmentNo;
        equipmentNo = '';
      }
    }

    // If equipmentType contains an equipment ID (e.g. "DT-01", "135HCL19", "4004006") and equipmentNo is empty
    if (!equipmentNo && equipmentType && !KNOWN_TYPE_WORDS.includes(eqTypeUpper)) {
      equipmentNo = equipmentType;
      equipmentType = '';
    }

    // Standardize equipmentType spelling/casing (Dumber, Tanker, Flatbed)
    if (/^dump/i.test(equipmentType)) {
      equipmentType = 'Dumber';
    } else if (/^flat/i.test(equipmentType)) {
      equipmentType = 'Flatbed';
    } else if (/^tank/i.test(equipmentType)) {
      equipmentType = 'Tanker';
    }

    // Auto-derive equipment type if missing and equipmentNo is present
    if (!equipmentType && equipmentNo) {
      equipmentType = deriveEquipmentType(equipmentNo);
    }
    if (!equipmentType) {
      equipmentType = 'Tanker';
    }

    const rowId = uid();
    const row: TimetableRow = {
      id: rowId,
      driverName,
      iqama,
      mobile,
      plateNo,
      equipmentNo,
      source: source || 'Yanbu',
      destination: destination || '',
      customer,
      supplier,
      store: store || (destination ? mapStore(storeMap, destination) : ''),
      equipmentType,
      commodity,
      waybill,
      dn,
      transporter,
      notes,
      bayanExpiry
    };

    row.priority = schedulePriority(row);
    rows.push(row);
  }

  return {
    date: scheduleDate || todayISO(),
    rows
  };
}
