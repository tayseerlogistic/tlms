// =====================================================================
// Timetable Dispatch Engine & Data Services (v4)
// =====================================================================

import { TimetableRow } from '../types';

export interface TimetableDriver {
  id: string;
  name: string;
  iqama: string;
  mobile: string;
}

export interface TimetableVehicle {
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
  { key: 'mobile', label: 'Mobile #', def: true, w: 110 },
  { key: 'plateNo', label: 'Plate No', def: true, w: 150 },
  { key: 'equipmentNo', label: 'Equipment#', def: true, w: 100 },
  { key: 'customer', label: 'Customer', def: true, w: 150 },
  { key: 'source', label: 'Source', def: true, w: 90 },
  { key: 'destination', label: 'Destination', def: true, w: 100 },
  { key: 'commodity', label: 'Commodity', def: true, w: 300 },
  { key: 'supplier', label: 'Supplier', def: false, w: 120 },
  { key: 'store', label: 'Store', def: false, w: 180 },
  { key: 'equipmentType', label: 'Equipment Type', def: false, w: 110 },
  { key: 'waybill', label: 'Waybill#', def: false, w: 90 },
  { key: 'dn', label: 'DN Number', def: false, w: 90 },
  { key: 'transporter', label: 'Transporter', def: false, w: 120 },
  { key: 'notes', label: 'Notes', def: false, w: 200 },
  { key: 'bayanExpiry', label: 'Bayan Expiry', def: false, w: 120 }
];

export const OFFICIAL_EXPORT_COLUMNS: [keyof TimetableRow, string][] = [
  ['driverName', 'Driver Name'],
  ['iqama', 'Iqama #'],
  ['mobile', 'Driver Mobile #'],
  ['equipmentNo', 'Equipment#'],
  ['plateNo', 'Vehicle Plate No'],
  ['source', 'Source'],
  ['destination', 'Destination'],
  ['customer', 'Customer'],
  ['supplier', 'Supplier'],
  ['store', 'Store'],
  ['equipmentType', 'Equipment Type'],
  ['commodity', 'Commodity'],
  ['waybill', 'Waybill#'],
  ['dn', 'DN Number'],
  ['transporter', 'Transporter'],
  ['notes', 'Notes'],
  ['bayanExpiry', 'Bayan Expiry']
];

export const OUR_LOCS = ['tls', 'tpf', 'nagadhi', 'dammam'];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
  if (/^40040/.test(eq)) return 'Flatbed';
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
export const RAW_DRIVERS: [string, string, string][] = [
  ["MUHAMMAD FAYYAZ AWAN", "2326626773", "595343932"],
  ["MOJIB REHMAN GHOFRAN MOHAMMAD", "2385059262", "551100682"],
  ["DOST MUHAMMAD KHALIQ", "2385353681", "551100589"],
  ["RAISUL HASAN ALEY HASAN", "2469328948", "581793947"],
  ["AZAD ALI KHAN", "2482998701", "562726119"],
  ["TALHA FAZLAY RUB", "2324352547", "599595250"],
  ["ABDUL MAJEED ABDUL KAREEM", "2533446445", "583508134"],
  ["SHAFIQ AHMED MUHAMMAD", "2533446320", "554691685"],
  ["RIAZ AHMAD HAFIZ WAHID KAKHSH", "2533446114", "554630317"],
  ["SHADEEB KHAN SHAH", "2536286293", "592490391"],
  ["BABAR KHAN CHAUDARY SHAMROZ KHAN", "2532772700", "533923819"],
  ["NAZIR AHMAD BASHIR AHMAD", "2544772664", "564754735"],
  ["SAJJAD ALI AHMAD DIN", "2523313100", "571043206"],
  ["KARIM KHAN HAKIM WALI KHAN", "2422698981", "501173728"],
  ["TAHIR MEHMOOD MAZOOR AHMED", "2531251532", "532486754"],
  ["MOHD SAIF MOHD JULFIKAR", "2418036303", "597734852"],
  ["AMAN TULLAH", "2582346751", "575630903"],
  ["MUSTAFA ANSARI", "2582346561", "575676728"],
  ["SADDAM HABIB", "2584834994", "535341643"],
  ["AFAQ SHAH RASOOL SHAH", "2586607794", "571423665"],
  ["MUHAMMAD ASHRAF SAED AHMED", "2349470464", "593304841"],
  ["IFTIKHAR KHAN CHAUDHARY SHAMROZ KHAN", "2596915450", "554579587"],
  ["ZAIN UL ABIDEEN MUHAMMAD FAZIL", "2596916110", "552021611"],
  ["ABDUL WALI HAKEEM WALI KHAN", "2596916599", "553734337"],
  ["MOHAMMAD ILYAS MANZOOR HUSSAIN", "2596032090", "509377928"],
  ["AHMAD ABBASI ABDUL REHMAN", "2596031993", "503837881"],
  ["SIBGHAT ULLAH ABDUL AMIN", "2596916359", "572718522"],
  ["MOHD ZAID", "2596915633", "535170627"],
  ["MOHD JUNAID", "2596915856", "538932902"],
  ["GHULAM YASIN HAFIZ WAHID BAKHSH", "2589336318", "571440790"],
  ["SAJJAD AHMAD AHMAD YAR", "2519909721", "505157170"],
  ["SHAHZAD AHMAD AHMAD YAR", "2552847986", "556234501"],
  ["JAWAD AHMAD GUL PARAS", "2513786141", "591130576"],
  ["FAISAL HAMMAD MUKHTAR AHMED", "2557293632", "571466910"],
  ["WASEEM HUSSAIN KHEWA DIN", "2582425654", "502278971"],
  ["AZIZ ULLAH", "2621874466", "564691757"],
  ["FAHIM AKRAM MUHAMMAD AKRAM", "2621881396", "535746244"],
  ["MUHAMMAD MOHSIN MUHAMMAD FAROOQ", "2621881743", "535791905"],
  ["ABDUL SHAKOOR ABDUL GHFOOR", "2533446171", "554757493"],
  ["HARUN ANSARI HASANAIN ANSARI", "2573654445", "509661506"],
  ["ISRAYAL KHAN", "2628590271", "572523090"],
  ["AJAZ AHMAD SHER MUHAMMAD KHAN", "2564126478", "563088749"],
  ["NAFIW MOHAMMED", "2598515431", "506370546"],
  ["SARU IBRAHIM", "2598393839", "531330746"],
  ["SHAHZAD AHMAD SIRAJ AHMAD KHAN", "2634188631", "573685786"],
  ["MOHD MOHSEN KHAN", "2634188532", "555325046"],
  ["AALAMGEER", "2634189274", "579612154"],
  ["MUSTAK", "2634189381", "579614750"],
  ["PARAVEJ ALAM", "2634189530", "502500957"],
  ["KAMRAN ELLAHI ELLAHI BAKHSH", "2594959245", "502911856"],
  ["IQBAL HOSSAIN", "2601876291", "571651516"],
  ["JAVID KHAN", "2635431444", "570140037"],
  ["MUHAMMAD MADNI", "2635431741", "551667907"],
  ["SAEED AHMAD", "2636058030", "552163821"],
  ["SHAHZAD AMIR", "2636169167", "534593695"],
  ["SHASHIKANT KUMAR", "", ""],
  ["WALEED", "", ""],
  ["MUHAMMAD ASLAM", "", "573448047"],
  ["PERVAIZ AHMAD MURAD ALI KHAN", "", ""],
  ["MUSHTAQ HUSSAIN ALI REHMAT", "", ""],
  ["SABIR HUSSAIN MUHAMMAD RAMZAN", "", ""],
  ["FAYIZ IJAZ MUHAMMAD", "", ""],
  ["ARIF ANSARI", "", ""],
  ["MUHAMMAD ABRAR", "", ""]
];

export const INITIAL_EQUIPMENT_LIST: string[] = [
  "102HCL15","104HCL15","105HCL15","106HCL18","107HCL18","108HCL18","109HCL18","110HCL18",
  "111HCL18","112HCL18","113HCL18","114HCL18","115HCL18","116HCL18","117HCL18","118HCL18",
  "119HCL18","120HCL18","121HCL18","122HCL18","123HCL18","124HCL18","125HCL18","126HCL19",
  "127HCL19","128HCL19","129HCL19","130HCL19","131HCL19","132HCL19","133HCL19","134HCL19",
  "135HCL19","136HCL19","137HCL19","138HCL19","139HCL19","140HCL19","141HCL19","142HCL19",
  "143HCL19","144HCL19","601LTT25","602LTT25","603LTT25","604LTT25","605LTT25","606LTT26",
  "607LTT26","608LTT26","205SLF18","206SLF18","207SLF18","208SLF19","209SLF19","210SLF19",
  "213SLF19","214SLF19","215SLF19","216SLF19","217SLF19","218SLF12","219SLF12","220SLF15",
  "219SLF15","219SLF16","219SLF17","219SLF18","219SLF19","219SLF20","219SLF21","219SLF22",
  "219SLF23","219SLF24","301CSD15","401LSR18","DT-01","DT-02","4004002","4004003","4004004",
  "4004005","4004006","4004007","4004008","4004009","4004010","4004011","4004012","4004013",
  "4004014","4004015","4004016","4004018"
];

export const KNOWN_EQUIPMENT_INFO: Record<string, { plate: string; driver: string }> = {
  "DT-01":     {plate:'أ ح د D J A 4829', driver:'MUHAMMAD FAYYAZ AWAN'},
  "4004003":   {plate:'أ س س S S A 5046', driver:'SIBGHAT ULLAH ABDUL AMIN'},
  "4004004":   {plate:'أ ر ح J R A 5158', driver:'ABDUL WALI HAKEEM WALI KHAN'},
  "4004006":   {plate:'أ ر ح J R A 5159', driver:'SHAFIQ AHMED MUHAMMAD'},
  "4004007":   {plate:'أ ص ه H X A 3597', driver:'MOHD SAIF MOHD JULFIKAR'},
  "4004008":   {plate:'أ ر ح J R A 5170', driver:'JAWAD AHMAD GUL PARAS'},
  "4004009":   {plate:'أ ص ه H X A 3592', driver:'MOHD ZAID'},
  "4004010":   {plate:'أ س ح J S A 8752', driver:'IQBAL HOSSAIN'},
  "4004011":   {plate:'أ س ح J S A 8753', driver:'RAISUL HASAN ALEY HASAN'},
  "4004012":   {plate:'أ ص ه H X A 3591', driver:'ZAIN UL ABIDEEN MUHAMMAD FAZIL'},
  "4004013":   {plate:'أ ص ه H X A 3594', driver:'AHMAD ABBASI ABDUL REHMAN'},
  "4004014":   {plate:'أ ص ه H X A 3595', driver:'MUSTAFA ANSARI'},
  "4004015":   {plate:'أ ص ه H X A 3598', driver:'MOHAMMAD ILYAS MANZOOR HUSSAIN'},
  "4004016":   {plate:'أ ر ك K R A 7503', driver:'SARU IBRAHIM'},
  "4004018":   {plate:'أ س ح J S A 8754', driver:''},
  "104HCL15":  {plate:'أ ر ك K R A 8479', driver:'MUHAMMAD ASHRAF SAED AHMED'},
  "113HCL19":  {plate:'أ ص ه H X A 3589', driver:'ABDUL MAJEED ABDUL KAREEM'},
  "116HCL18":  {plate:'أ س س S S A 5046', driver:'SIBGHAT ULLAH ABDUL AMIN'},
  "117HCL18":  {plate:'أ ر ك K R A 8471', driver:'GHULAM YASIN HAFIZ WAHID BAKHSH'},
  "118HCL18":  {plate:'أ ص ه H X A 3593', driver:'AJAZ AHMAD SHER MUHAMMAD KHAN'},
  "121HCL18":  {plate:'أ ر ك K R A 8478', driver:'MOHD MOHSEN KHAN'},
  "124HCL18":  {plate:'أ س س S S A 1192', driver:'FAHIM AKRAM MUHAMMAD AKRAM'},
  "126HCL19":  {plate:'أ ر ك K R A 7502', driver:'MUHAMMAD MOHSIN MUHAMMAD FAROOQ'},
  "128HCL19":  {plate:'أ ر ك K R A 8469', driver:'KARIM KHAN HAKIM WALI KHAN'},
  "130HCL19":  {plate:'أ ر ك K R A 8470', driver:'RIAZ AHMAD HAFIZ WAHID KAKHSH'},
  "133HCL19":  {plate:'أ ر ك K R A 8471', driver:'GHULAM YASIN HAFIZ WAHID BAKHSH'},
  "135HCL19":  {plate:'أ ص ه H X A 3593', driver:'AJAZ AHMAD SHER MUHAMMAD KHAN'},
  "141HCL19":  {plate:'أ س ح J S A 8647', driver:'TAHIR MEHMOOD MAZOOR AHMED'},
  "143HCL19":  {plate:'أ ر ك K R A 8479', driver:'MUHAMMAD ASHRAF SAED AHMED'},
  "144HCL19":  {plate:'أ س س S S A 1198', driver:'JAVID KHAN'},
  "601LTT25":  {plate:'أ ر ك K R A 8479', driver:'MUHAMMAD ASHRAF SAED AHMED'},
  "602LTT25":  {plate:'أ ص ه H X A 3590', driver:'MOHD JUNAID'},
  "605LTT25":  {plate:'أ ص ه H X A 3589', driver:'ABDUL MAJEED ABDUL KAREEM'},
  "607LTT26":  {plate:'أ س س S S A 1196', driver:'SHAHZAD AHMAD AHMAD YAR'},
  "608LTT26":  {plate:'أ ص ه H X A 3592', driver:'MOHD ZAID'},
  "205SLF18":  {plate:'أ ر ك K R A 8471', driver:'GHULAM YASIN HAFIZ WAHID BAKHSH'},
  "206SLF18":  {plate:'أ ر ح J R A 5160', driver:'TALHA FAZLAY RUB'},
  "207SLF18":  {plate:'أ ر ق G R A 6845', driver:'DOST MUHAMMAD KHALIQ'},
  "208SLF19":  {plate:'أ ر ك K R A 7501', driver:'HARUN ANSARI HASANAIN ANSARI'},
  "209SLF19":  {plate:'أ س ح J S A 8751', driver:'MUHAMMAD FAYYAZ AWAN'},
  "215SLF19":  {plate:'أ ص ه H X A 3590', driver:'MOHD JUNAID'},
  "216SLF19":  {plate:'أ ص ه H X A 3596', driver:'IFTIKHAR KHAN CHAUDHARY SHAMROZ KHAN'},
  "217SLF19":  {plate:'أ س س S S A 5046', driver:'SIBGHAT ULLAH ABDUL AMIN'},
  "220SLF15":  {plate:'أ ح د D J A 4827', driver:'WASEEM HUSSAIN KHEWA DIN'},
  "219SLF16":  {plate:'أ س س S S A 1198', driver:'JAVID KHAN'},
  "219SLF17":  {plate:'أ س ح J S A 8753', driver:'RAISUL HASAN ALEY HASAN'},
  "219SLF18":  {plate:'أ ص ه H X A 3590', driver:'MOHD JUNAID'},
  "219SLF20":  {plate:'أ ر ح J R A 5160', driver:'TALHA FAZLAY RUB'},
  "219SLF22":  {plate:'أ س س S S A 1193', driver:'SHAHZAD AHMAD SIRAJ AHMAD KHAN'},
  "219SLF23":  {plate:'أ س ح J S A 8648', driver:'MOJIB REHMAN GHOFRAN MOHAMMAD'},
  "219SLF24":  {plate:'أ س ح J S A 8649', driver:'NAZIR AHMAD BASHIR AHMAD'},
  "301CSD15":  {plate:'أ س ح J S A 8649', driver:'NAZIR AHMAD BASHIR AHMAD'},
  "401LSR18":  {plate:'أ ر ك K R A 8477', driver:'AMAN TULLAH'}
};

export const INITIAL_COMMODITIES: TimetableCommodity[] = [
  {canonical:'Sulfuric Acid',          shortForm:'SA',                 aliases:[], jumboBagMT:1.25},
  {canonical:'HCL',                    shortForm:'HCL',                aliases:['Hydrochloric Acid'], jumboBagMT:1.25},
  {canonical:'Caustic Soda',           shortForm:'CS',                 aliases:['Caustic Soda Flakes'], jumboBagMT:1.25},
  {canonical:'Caustic Soda Flakes',    shortForm:'CS',                 aliases:[], jumboBagMT:1.25},
  {canonical:'SBS',                    shortForm:'SBS',                aliases:[], jumboBagMT:1.25},
  {canonical:'SMBS',                   shortForm:'SMBS',               aliases:[], jumboBagMT:1.25},
  {canonical:'PAC',                    shortForm:'PAC',                aliases:[], jumboBagMT:1.25},
  {canonical:'FC',                     shortForm:'FC',                 aliases:['Ferric Chloride'], jumboBagMT:1.25},
  {canonical:'AS',                     shortForm:'AS',                 aliases:[], jumboBagMT:1.25},
  {canonical:'Aluminium Trihydrate',   shortForm:'ATH',                aliases:['Aluminium Hydroxide','Aluminum Hydroxide','Aluminum Trihydrate'], jumboBagMT:1.25},
  {canonical:'Aluminium Hydroxide',    shortForm:'ATH',                aliases:[], jumboBagMT:1.25},
  {canonical:'KCL',                    shortForm:'KCL',                aliases:['Potassium Chloride'], jumboBagMT:1.25},
  {canonical:'SOP Powder',             shortForm:'SOP Powder',         aliases:[], jumboBagMT:1.25},
  {canonical:'SOP Granular',           shortForm:'SOP Granular',       aliases:[], jumboBagMT:1.25},
  {canonical:'SOP Granular Bulk',      shortForm:'SOP Granular Bulk',  aliases:[], jumboBagMT:1.25},
  {canonical:'Molten Sulphur',         shortForm:'Molten Sulphur',     aliases:[], jumboBagMT:1.25},
  {canonical:'Sulphur',                shortForm:'SULPHUR',            aliases:[], jumboBagMT:1.25},
  {canonical:'Magnesium Sulphate',     shortForm:'Magnesium Sulphate', aliases:['Magnesium Sulfate','Magnesium Sulphate Crystal','Magnesium Sulfate Powder','Magnesium Sulfate Crystal'], jumboBagMT:1.2},
  {canonical:'Calcined Alumina',       shortForm:'Calcined Alumina',   aliases:[], jumboBagMT:1.2},
  {canonical:'Calcium Carbonate',      shortForm:'Calcium Carbonate',  aliases:[], jumboBagMT:2},
  {canonical:'Calcium Chloride',       shortForm:'Calcium Chloride',   aliases:[], jumboBagMT:1},
  {canonical:'Citric Acid',            shortForm:'Citric Acid',        aliases:['Citrix Acid'], jumboBagMT:1.25},
  {canonical:'Sodium Chlorite',        shortForm:'Sodium Chlorite',    aliases:['Sodium chloite'], jumboBagMT:1.25},
  {canonical:'Fine Alumina',           shortForm:'Fine Alumina',       aliases:[], jumboBagMT:1.1},
  {canonical:'Yellow Iron Oxide',      shortForm:'Yellow Iron Oxide',  aliases:['Yellow Ion Oxide','Yellow Ion oxide'], jumboBagMT:1.25},
  {canonical:'Gypsum',                 shortForm:'Gypsum',             aliases:[], jumboBagMT:1.25},
  {canonical:'Empty IBC',              shortForm:'Empty IBC',          aliases:[], jumboBagMT:1},
  {canonical:'Container',              shortForm:'Containar',          aliases:['Containar'], jumboBagMT:1},
  {canonical:'CurbStone',              shortForm:'CurbStone',          aliases:[], jumboBagMT:1},
  {canonical:'Waste Material',         shortForm:'Waste Material',     aliases:[], jumboBagMT:1},
  {canonical:'Calcium Hydroxide',      shortForm:'Calcium Hydroxide',  aliases:[], jumboBagMT:1.2},
  {canonical:'Methanol',               shortForm:'METHANOL',           aliases:['METHANOL'], jumboBagMT:1.25}
];

export const INITIAL_STORE_MAP: TimetableStoreMap = {
  'TLS':     'TLS Warehouse',
  'TPF':     'Tayseer Group Factory',
  'Nagadhi': 'Tayseer Group Warehouse Nagadhi',
  'Dammam':  'Tayseer Group WH (3rd Industrial Area)'
};

// ---------------------------------------------------------------------
// DATABASE INITIALIZATION & LOCALSTORAGE
// ---------------------------------------------------------------------
export const TT_STORAGE_KEY = 'timetable_db_v4';

export function createDefaultDatabase(): TimetableDatabase {
  const drivers: TimetableDriver[] = RAW_DRIVERS.map(([name, iqama, mobile]) => ({
    id: uid(),
    name,
    iqama,
    mobile
  }));

  const vehicles: TimetableVehicle[] = INITIAL_EQUIPMENT_LIST.map(eq => {
    const info = KNOWN_EQUIPMENT_INFO[eq] || { plate: '', driver: '' };
    let defaultDriverId = '';
    if (info.driver) {
      const d = drivers.find(x => x.name.toLowerCase() === info.driver.toLowerCase());
      if (d) defaultDriverId = d.id;
    }
    return {
      id: uid(),
      equipmentNo: eq,
      plateNo: info.plate,
      type: deriveEquipmentType(eq),
      defaultDriverId,
      isThirdParty: false
    };
  });

  return {
    drivers,
    vehicles,
    commodities: [...INITIAL_COMMODITIES],
    storeMap: { ...INITIAL_STORE_MAP },
    schedules: {},
    uiPrefs: {
      visibleColumnsList: null,
      visibleColumnsDaily: null,
      lastDate: null,
      showPriority: true,
      enableSort: true
    }
  };
}

export function loadTimetableDatabase(): TimetableDatabase {
  const fallback = createDefaultDatabase();
  try {
    const str = localStorage.getItem(TT_STORAGE_KEY);
    if (!str) return fallback;
    const parsed = JSON.parse(str);
    return {
      drivers: Array.isArray(parsed.drivers) && parsed.drivers.length ? parsed.drivers : fallback.drivers,
      vehicles: Array.isArray(parsed.vehicles) && parsed.vehicles.length ? parsed.vehicles : fallback.vehicles,
      commodities: Array.isArray(parsed.commodities) && parsed.commodities.length ? parsed.commodities : fallback.commodities,
      storeMap: parsed.storeMap && Object.keys(parsed.storeMap).length ? parsed.storeMap : fallback.storeMap,
      schedules: parsed.schedules || {},
      uiPrefs: {
        visibleColumnsList: parsed.uiPrefs?.visibleColumnsList || null,
        visibleColumnsDaily: parsed.uiPrefs?.visibleColumnsDaily || null,
        lastDate: parsed.uiPrefs?.lastDate || null,
        showPriority: parsed.uiPrefs?.showPriority !== false,
        enableSort: parsed.uiPrefs?.enableSort !== false
      }
    };
  } catch (e) {
    console.warn("Failed to load timetable DB from localStorage", e);
    return fallback;
  }
}

export function saveTimetableDatabase(db: TimetableDatabase): void {
  try {
    localStorage.setItem(TT_STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn("Failed to save timetable DB to localStorage", e);
  }
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
  let colMap: Record<keyof TimetableRow, number> = {
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

      headers.forEach((h, idx) => {
        if (h.includes('driver name') || h === 'driver') colMap.driverName = idx;
        else if (h.includes('iqama')) colMap.iqama = idx;
        else if (h.includes('mobile') || h.includes('phone')) colMap.mobile = idx;
        else if (h.includes('equipment#') || h.includes('equipment')) colMap.equipmentNo = idx;
        else if (h.includes('plate')) colMap.plateNo = idx;
        else if (h.includes('source') || h === 'from') colMap.source = idx;
        else if (h.includes('destination') || h === 'to') colMap.destination = idx;
        else if (h.includes('customer')) colMap.customer = idx;
        else if (h.includes('supplier')) colMap.supplier = idx;
        else if (h.includes('store')) colMap.store = idx;
        else if (h.includes('equipment type') || h === 'type' || h === 'trailer') colMap.equipmentType = idx;
        else if (h.includes('commodity') || h.includes('material')) colMap.commodity = idx;
        else if (h.includes('waybill')) colMap.waybill = idx;
        else if (h.includes('dn')) colMap.dn = idx;
        else if (h.includes('transporter')) colMap.transporter = idx;
        else if (h.includes('notes') || h.includes('requirement')) colMap.notes = idx;
        else if (h.includes('bayan')) colMap.bayanExpiry = idx;
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
      return idx >= 0 && idx < cells.length ? cells[idx] || '' : '';
    };

    const driverName = getVal('driverName');
    const plateNo = getVal('plateNo');
    const equipmentNo = getVal('equipmentNo');
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

    // Auto-derive equipment type if missing
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

