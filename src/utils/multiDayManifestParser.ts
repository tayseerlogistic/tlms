// =====================================================================
// Multi-Day Daily Manifest Parser & Synchronizer Engine
// Ingests multi-date driver manifests from spreadsheets & exports
// =====================================================================

import { Driver } from '../types';
import { ALL_84_DRIVERS } from '../data/seedDrivers';

export interface ParsedManifestEntry {
  driverIndex: number;
  driverName: string;
  empNo: string;
  iqama: string;
  plate: string;
  tagsByDate: Record<string, string>; // YYYY-MM-DD -> Tag
}

export interface MultiDayParseResult {
  detectedDates: string[]; // sorted YYYY-MM-DD
  mappedDriversCount: number;
  totalEntriesCount: number;
  entries: ParsedManifestEntry[];
  unmatchedLines: string[];
  manifestByDate: Record<string, Record<number, string>>; // date -> { driverIndex -> tag }
}

const norm = (s: string) => String(s || '').toUpperCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const cleanNum = (s: string) => String(s || '').replace(/\D/g, '');

/**
 * Parses header column text to detect date in formats:
 * - "Thursday, 1" / "Friday, 2" / "1" (with defaultYearMonth e.g. "2026-10")
 * - "01-10-2026" / "01/10/2026"
 * - "2026-10-01"
 * - "1 Oct" / "1 October 2026"
 */
export function parseHeaderDate(colHeader: string, defaultYearMonth: string = '2026-10'): string | null {
  const h = String(colHeader || '').trim();
  if (!h) return null;

  // 1. "YYYY-MM-DD"
  const mISO = h.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (mISO) {
    return `${mISO[1]}-${mISO[2].padStart(2, '0')}-${mISO[3].padStart(2, '0')}`;
  }

  // 2. "DD-MM-YYYY" or "DD/MM/YYYY"
  const mFull = h.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (mFull) {
    return `${mFull[3]}-${mFull[2].padStart(2, '0')}-${mFull[1].padStart(2, '0')}`;
  }

  // 3. "Thursday, 1" or "Sunday, 4" or "Day, DD"
  const mDayName = h.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(\d{1,2})\b/i);
  if (mDayName) {
    const dayNum = parseInt(mDayName[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const [year, month] = defaultYearMonth.split('-');
      return `${year}-${month.padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    }
  }

  // 4. "1 Oct" or "01 October"
  const MONTHS: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const mMonthName = h.match(/(\d{1,2})\s*([A-Za-z]{3,9})(?:\s*(\d{4}))?/i);
  if (mMonthName) {
    const day = mMonthName[1].padStart(2, '0');
    const monKey = mMonthName[2].slice(0, 3).toLowerCase();
    const month = MONTHS[monKey] || '10';
    const year = mMonthName[3] || defaultYearMonth.split('-')[0] || '2026';
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Main parser: ingests multi-day spreadsheet rows and matches against master drivers list.
 */
export function parseMultiDayManifest(
  rawText: string,
  driversList: Driver[],
  defaultYearMonth: string = '2026-10'
): MultiDayParseResult {
  const lines = String(rawText || '').replace(/\r/g, '').split('\n');
  let headerIndex = -1;
  const dateColMap: Array<{ colIdx: number; dateStr: string; label: string }> = [];

  let nameColIdx = 0;
  let iqamaColIdx = -1;
  let empColIdx = -1;
  let plateColIdx = -1;

  // Step 1: Detect header row and date columns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = lines[i].split('\t').map(c => c.trim());

    // Look for header indicators
    const lineNorm = norm(line);
    if (
      lineNorm.includes('IQAMA') ||
      lineNorm.includes('EMPLOYEE NO') ||
      lineNorm.includes('DRIVER NAME') ||
      lineNorm.includes('THURSDAY') ||
      lineNorm.includes('FRIDAY')
    ) {
      headerIndex = i;

      cells.forEach((cell, idx) => {
        const cn = norm(cell);
        if (cn.includes('IQAMA')) iqamaColIdx = idx;
        else if (cn.includes('EMPLOYEE') || cn.includes('EMP NO') || cn.includes('EMP.')) empColIdx = idx;
        else if (cn.includes('DRIVER NAME') || (idx === 0 && !cn.includes('IQAMA') && !cn.includes('EMPLOYEE'))) nameColIdx = idx;
        else if (cn.includes('PLATE')) plateColIdx = idx;

        // Check if column is a date
        const parsedDate = parseHeaderDate(cell, defaultYearMonth);
        if (parsedDate) {
          dateColMap.push({ colIdx: idx, dateStr: parsedDate, label: cell });
        }
      });

      break;
    }
  }

  // Fallback: if no date columns found in header, look for day numbers in first few lines
  if (dateColMap.length === 0 && headerIndex >= 0) {
    const cells = lines[headerIndex].split('\t').map(c => c.trim());
    cells.forEach((cell, idx) => {
      const parsedDate = parseHeaderDate(cell, defaultYearMonth);
      if (parsedDate) {
        dateColMap.push({ colIdx: idx, dateStr: parsedDate, label: cell });
      }
    });
  }

  // Sort detected dates chronologically
  dateColMap.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const detectedDates = Array.from(new Set(dateColMap.map(d => d.dateStr))).sort();

  const manifestByDate: Record<string, Record<number, string>> = {};
  detectedDates.forEach(dt => {
    manifestByDate[dt] = {};
  });

  const entries: ParsedManifestEntry[] = [];
  const unmatchedLines: string[] = [];
  const startIdx = headerIndex >= 0 ? headerIndex + 1 : 0;
  let totalEntriesCount = 0;

  // Step 2: Parse driver rows
  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const cells = rawLine.split('\t').map(c => c.trim());
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (!cells.length) continue;

    const rawName = cells[nameColIdx] || '';
    const rawIqama = iqamaColIdx >= 0 ? cells[iqamaColIdx] : '';
    const rawEmp = empColIdx >= 0 ? cells[empColIdx] : '';
    const rawPlate = plateColIdx >= 0 ? cells[plateColIdx] : '';

    // Find driver match in master list
    let matchedDriverIndex = -1;

    // 1. Match by clean Iqama # (highest fidelity)
    const cleanIq = cleanNum(rawIqama);
    if (cleanIq.length >= 7) {
      matchedDriverIndex = driversList.findIndex(d => cleanNum(d.iqama) === cleanIq);
    }

    // 2. Match by Employee No (e.g. L-EMP0024)
    if (matchedDriverIndex < 0 && rawEmp) {
      const cleanEmp = norm(rawEmp);
      matchedDriverIndex = driversList.findIndex(d => norm(d.empNo) === cleanEmp);
    }

    // 3. Match by Driver Name
    if (matchedDriverIndex < 0 && rawName) {
      const nName = norm(rawName);
      matchedDriverIndex = driversList.findIndex(d => {
        const dNorm = norm(d.name);
        return dNorm === nName || dNorm.includes(nName) || nName.includes(dNorm);
      });
    }

    // 4. Match by Vehicle Plate
    if (matchedDriverIndex < 0 && rawPlate) {
      const pNorm = norm(rawPlate).replace(/\s+/g, '');
      matchedDriverIndex = driversList.findIndex(d => {
        const dpNorm = norm(d.assignedVehiclePlate || '').replace(/\s+/g, '');
        return dpNorm && dpNorm === pNorm;
      });
    }

    if (matchedDriverIndex < 0) {
      // Row might be a section label (e.g. "TLS Fleets") or unrecognized
      if (rawName && !rawName.toUpperCase().includes('FLEET') && !rawName.toUpperCase().includes('TOTAL')) {
        unmatchedLines.push(trimmed.slice(0, 80));
      }
      continue;
    }

    const matchedDriver = driversList[matchedDriverIndex];
    const tagsByDate: Record<string, string> = {};

    dateColMap.forEach(dCol => {
      if (dCol.colIdx < cells.length) {
        const val = cells[dCol.colIdx];
        if (val && val.trim() && val !== '-' && val !== '—') {
          const cleanedTag = val.trim();
          tagsByDate[dCol.dateStr] = cleanedTag;
          manifestByDate[dCol.dateStr][matchedDriverIndex] = cleanedTag;
          totalEntriesCount++;
        }
      }
    });

    entries.push({
      driverIndex: matchedDriverIndex,
      driverName: matchedDriver.name,
      empNo: matchedDriver.empNo || rawEmp,
      iqama: matchedDriver.iqama || rawIqama,
      plate: matchedDriver.assignedVehiclePlate || rawPlate,
      tagsByDate
    });
  }

  return {
    detectedDates,
    mappedDriversCount: entries.length,
    totalEntriesCount,
    entries,
    unmatchedLines,
    manifestByDate
  };
}

// =====================================================================
// Sample Historical Manifest Data: Thursday 1 to Sunday 4 October 2026
// Provided by User
// =====================================================================
export const SAMPLE_OCTOBER_1_4_MANIFEST_TEXT = `	Iqama #	Nationality	Contact Number	Equipment#	Transporter	Vehicle Plate No	Driver card		Employee No.	Working For	Thursday, 1 	Friday, 2 	Saturday, 3 	Sunday, 4 
MUHAMMAD FAYYAZ AWAN	2326626773	PAKISTAN	595343932	401LSR18	TLS	أ ح د D J A 4829			L-EMP0024	Yanbu - Local	CS Supply for SWCC - Under Offloading at Yanbu	 Internal Transfer 	MOLTEN SULPHER Collection from LUBEREF	MOLTEN SULPHER Collection from LUBEREF
MOJIB REHMAN GHOFRAN MOHAMMAD	2385059262	PAKISTAN	551100682	206SLF18	TLS	أ س ح J S A 8648	24-07-2027		L-EMP0074	KSA - Local Supplies	SA Supply for CISCO - At Kuwait Border	Coming Back to Yanbu	At Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
DOST MUHAMMAD KHALIQ	2385353681	PAKISTAN	551100589	207SLF18	TLS	أ ر ق G R A 6845	24-07-2027		L-EMP0078	KSA - Local Supplies	SA Supply for CISCO - At Kuwait Border	Coming Back to Yanbu	At Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
RAISUL HASAN ALEY HASAN	2469328948	INDIA	581793947	4004011	TLS	أ س ح J S A 8753	24-07-2027		L-EMP0130	KSA - Local Supplies	 Internal Transfer 	 Internal Transfer 	 Internal Transfer 	CS Collection from TRONOX 
AZAD ALI KHAN	2482998701	PAKISTAN	562726119	219SLF23	TLS	أ س ح J S A 8650	24-07-2027		L-EMP0187	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
TALHA FAZLAY RUB	2324352547	INDIA	599595250	102HCL15	TLS	أ ر ح J R A 5160	22-07-2027		L-EMP0192	KSA - Local Supplies	FC Supply for SWCC - On the way to Jubail	FC Supply for SWCC - Under Offloading at Jubail	Coming Back to Yanbu	HCL Supply for RPC - Under Loading at Yanbu
ABDUL MAJEED ABDUL KAREEM	2533446445	PAKISTAN	583508134	209SLF19	TLS	أ ص ه H X A 3589	12-08-2027		L-EMP0327	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
SHAFIQ AHMED MUHAMMAD	2533446320	PAKISTAN	554691685	4004006	TLS	أ ر ح J R A 5159	12-08-2027		L-EMP0328	KSA - Local Supplies	CS Flakes Supply for WANG KANG - Under Loading at Yanbu /  Internal Transfer 	 Internal Transfer 	CS Flakes Supply for WANG KANG - Under Loading at Yanbu /  Internal Transfer 	 Internal Transfer 
RIAZ AHMAD HAFIZ WAHID KAKHSH	2533446114	PAKISTAN	554630317		TLS				L-EMP0329	KSA - Local Supplies	With Out Truck	With Out Truck	With Out Truck	With Out Truck
SHADEEB KHAN SHAH	2536286293	PAKISTAN	592490391		TLS				L-EMP0330	Vacation	Vacation	Vacation	Vacation	Vacation
BABAR KHAN CHAUDARY SHAMROZ KHAN	2532772700	PAKISTAN	533923819		TLS				L-EMP0343	KSA - Local Supplies	At Yanbu	At Yanbu	At Yanbu	At Yanbu
NAZIR AHMAD BASHIR AHMAD	2544772664	PAKISTAN	564754735	219SLF17	TLS	أ س ح J S A 8649	24-07-2027		L-EMP0344	KSA - Local Supplies	SA Supply for MWSPC - Under Loading at Yanbu	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu
SAJJAD ALI AHMAD DIN	2523313100	PAKISTAN	571043206	219SLF24	TLS	أ ص ه H X A 3593			L-EMP0346	KSA - Local Supplies	HCL Supply for ENGIE - Under Loading at Yanbu	SA Supply for TASNEE - Under Loading at Yanbu	SA Supply for TASNEE - On the way to Jubail	SA Supply for TASNEE - Under Offloading at Jubail
KARIM KHAN HAKIM WALI KHAN	2422698981	PAKISTAN	501173728		TLS	أ ر ك K R A 8469	05-08-2027		L-EMP0349	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	SA Supply for MWSPC - Under Loading at Yanbu
TAHIR MEHMOOD MAZOOR AHMED	2531251532	PAKISTAN	532486754	213SLF19	TLS	أ س ح J S A 8647	25-07-2027		L-EMP0351	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
MOHD SAIF MOHD JULFIKAR	2418036303	INDIA	597734852	219SLF20	TLS	أ ص ه H X A 3597	24-07-2027		L-EMP0407	KSA - Local Supplies	SA Supply for MWSPC - Under Loading at Yanbu	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu
AMAN TULLAH	2582346751	INDIA	575630903	107HCL18	TLS	أ ر ك K R A 8477	24-07-2027		L-EMP0459	KSA - Local Supplies	PAC Supply for SWCC - Under Offloading at hali Dam - Change trip	PAC Supply for SWCC - Waiting for Offloading at Baish	PAC Supply for SWCC - Under Offloading at Hali Dam	Coming Back to Yanbu
MUSTAFA ANSARI 	2582346561	INDIA	575676728	219SLF22	TLS	أ ص ه H X A 3595	24-07-2027		L-EMP0460	KSA - Local Supplies	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif
SADDAM HABIB	2584834994	INDIA	535341643	116HCL19	TLS	أ ر ك K R A 8470	11-9-2027		L-EMP0466	KSA - Local Supplies	FC Supply for SWCC - Under Offloading at Ras Al Khair	Coming Back to Yanbu	HCL Supply for MWSPC - Under Loading at Yanbu	HCL Supply for MWSPC - On the way to Turaif
AFAQ SHAH RASOOL SHAH	2586607794	PAKISTAN	571423665		TLS	أ س س S S A 1195	24-07-2027		L-EMP0485	KSA - Local Supplies	HCL Supply for MWSPC - On the way to Turaif	HCL Supply for MWSPC - Under Offloading at Turaif	External Fleet ( ARASCO ) - Under Loading at Turaif	External Fleet ( ARASCO ) - On the way to Dammam
MUHAMMAD ASHRAF SAED AHMED	2349470464	PAKISTAN	593304841	121HCL18	TLS	أ ر ك K R A 8479	24-07-2027		L-EMP0503	KSA - Local Supplies	FC Supply for SWCC - Under Loading at Yanbu	FC Supply for SWCC - On the way to Ras Al Khair	FC Supply for SWCC - Under Offloading at Ras Al Khair	Coming Back to Yanbu
IFTIKHAR KHAN CHAUDHARY SHAMROZ KHAN	2596915450	PAKISTAN	554579587	216SLF19	TLS	أ ص ه H X A 3596	24-07-2027		L-EMP0514	KSA - Local Supplies	SA Supply for CISCO - At Kuwait Border	SA Supply for CISCO - Under Offloading at Kuwait	Coming Back to Yanbu	Coming Back to Yanbu
ZAIN UL ABIDEEN MUHAMMAD FAZIL	2596916110	PAKISTAN	552021611	210SLF19	TLS	أ ص ه H X A 3591			L-EMP0515	KSA - Local Supplies	FC & MS & METHNOL Transfer TPF WH - On the way to Yanbu	FC & MS & METHNOL Transfer TPF WH - Under Offloading at Yanbu	 Internal Transfer / SA Supply for MWSPC - Under Loading at Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
ABDUL WALI HAKEEM WALI KHAN	2596916599	PAKISTAN	553734337		TLS	أ ر ح J R A 5158	24-07-2027		L-EMP0516	KSA - Local Supplies	 Internal Transfer / On the way to Tanker collection from Riyadh	On the way to Tanker collection from Riyadh	Coming Back to Yanbu	HCL Supply for ENERGIA - Under Loading at Yanbu
MOHAMMAD ILYAS MANZOOR HUSSAIN	2596032090	PAKISTAN	509377928	4004015	TLS	أ ص ه H X A 3598			L-EMP0517	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
AHMAD ABBASI ABDUL REHMAN	2596031993	PAKISTAN	503837881	4004013	TLS	أ ص ه H X A 3594			L-EMP0518	KSA - Local Supplies	SA Supply for MWSPC - Under Loading at Yanbu	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu
SIBGHAT ULLAH ABDUL AMIN	2596916359	PAKISTAN	572718522	217SLF19	TLS	أ س س S S A 5046			L-EMP0519	KSA - Local Supplies	SA Supply for PRC - Under Loading at Yanbu	SA Supply for PRC - Under Loading at Yanbu	SA Supply for PRC - Waiting for Offloading at Rabigh	SA Supply for PRC - Under Offloading at Rabigh
MOHD ZAID	2596915633	INDIA	535170627	608LTT26	TLS	أ ص ه H X A 3592	24-07-2027		L-EMP0524	KSA - Local Supplies	HCL Supply for MWSPC - Waiting for Offloading at Turaif	HCL Supply for MWSPC - Waiting for Offloading at Turaif	HCL Supply for MWSPC - Waiting for Offloading at Turaif	HCL Supply for MWSPC - Under Offloading at Turaif
MOHD JUNAID	2596915856	INDIA	538932902		TLS		24-07-2027		L-EMP0527	KSA - Local Supplies	With Out Truck	With Out Truck	With Out Truck	With Out Truck
GHULAM YASIN HAFIZ WAHID BAKHSH	2589336318	PAKISTAN	571440790	108HCL18	TLS	أ ر ك K R A 8471	24-07-2027		L-EMP0557	KSA - Local Supplies	HCL Supply for ENERGIA - Under Loading at Yanbu	CS Supply for SWCC - Under Loading at Yanbu	CS Supply for SWCC - On the way to Shuqaiq	CS Supply for SWCC - Under Offloading at Shuqaiq
SAJJAD AHMAD AHMAD YAR	2519909721	PAKISTAN	505157170	4004003	TLS	أ ص ه H X A 3590			L-EMP0558	KSA - Local Supplies	SA Supply for MWSPC - Under Loading at Yanbu	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu
SHAHZAD AHMAD AHMAD YAR	2552847986	PAKISTAN	556234501	4004009	TLS	أ س س S S A 1196	24-07-2027		L-EMP0559	KSA - Local Supplies	Coming Back to Yanbu	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu
JAWAD AHMAD GUL PARAS	2513786141	PAKISTAN	591130576	117HCL18	TLS	أ ر ح J R A 5170	24-07-2027		L-EMP0582	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
FAISAL HAMMAD MUKHTAR AHMED	2557293632	PAKISTAN	571466910	4004011	TLS	أ س س S S A 1199	24-07-2027		L-EMP0589	KSA - Local Supplies	SOP Supply for MAAR - On the way to Riyadh	SOP Supply for MAAR - Under Offloading at Riyadh	Waiting for Loading at Dammam	SMBS Supply for NOMAC - Under Loading at Dammam
WASEEM HUSSAIN KHEWA DIN	2582425654	PAKISTAN	502278971	601LTT25	TLS	أ ح د D J A 4827	24-07-2027		L-EMP0599	KSA - Local Supplies	External Fleet ( ARASCO ) - Waiting for Loading at Turaif	External Fleet ( ARASCO ) - Waiting for Loading at Turaif	External Fleet ( ARASCO ) - Under Loading at Turaif	External Fleet ( ARASCO ) - On the way to Dammam
AZIZ ULLAH	2621874466	PAKISTAN	564691757		TLS				L-EMP0600	No Valid Documents	At Dammam	At Dammam	At Dammam	At Dammam
FAHIM AKRAM MUHAMMAD AKRAM	2621881396	PAKISTAN	535746244	4004006	TLS	أ س س S S A 1192	24-07-2027		L-EMP0605	KSA - Local Supplies	External Fleet ( ARASCO ) - Waiting for Loading at Turaif	External Fleet ( ARASCO ) - Waiting for Loading at Turaif	External Fleet ( ARASCO ) - Under Loading at Turaif	External Fleet ( ARASCO ) - On the way to Dammam
MUHAMMAD MOHSIN MUHAMMAD FAROOQ	2621881743	PAKISTAN	535791905	143HCL19	TLS	أ ر ك K R A 7502	24-07-2027		L-EMP0606	KSA - Local Supplies	Coming Back to Yanbu	HCL Supply for ENERGIA - Under Loading at Yanbu	HCL Supply for ENERGIA - Under Loading at Yanbu	FC Supply for SWCC - Under Loading at Yanbu
ABDUL SHAKOOR ABDUL GHFOOR	2533446171	PAKISTAN	554757493	219SLF16	TLS	أ ر ح J R A 5165	24-07-2027		L-EMP0607	KSA - Local Supplies	SA Supply for MWSPC - On the way to Turaif	SA Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu	SA Supply for MWSPC - Under Loading at Yanbu
HARUN ANSARI HASANAIN ANSARI	2573654445	INDIA	509661506	208SLF19	TLS	أ ر ك K R A 7501	24-07-2027		L-EMP0610	KSA - Local Supplies	SA Supply for CISCO - At Kuwait Border	SA Supply for NBC - On the way to Loading for Riyadh	SA Supply for NBC - Waiting for Loading at Riyadh	SA Supply for NBC - Under Loading at Riyadh
ISRAYAL KHAN	2628590271	INDIA	572523090	219SLF18	TLS	أ ر ق G R A 6844	24-07-2027		L-EMP0609	KSA - Local Supplies	SA Supply for CISCO - At Kuwait Border	SA Supply for CISCO - Under Offloading at Kuwait	SA Supply for CISCO - On the way to Loading for Riyadh	SA Supply for CISCO - On the way to Loading for Riyadh
AJAZ AHMAD SHER MUHAMMAD KHAN	2564126478	PAKISTAN	563088749		TLS	أ ص ه H X A 3593	24-07-2027		L-EMP0612	KSA - Local Supplies	With Out Truck	With Out Truck	With Out Truck	With Out Truck
NAFIW MOHAMMED	2598515431	GHANA	506370546		TLS	أ س س S S A 1193	24-07-2027		L-EMP0613	KSA - Local Supplies	With Out Truck	With Out Truck	With Out Truck	With Out Truck
SARU IBRAHIM	2598393839	GHANA	531330746		TLS	أ ر ك K R A 7503			L-EMP0614	KSA - Local Supplies	On the way to Riyadh for Tanker Collection	On the way to Riyadh for Tanker Collection	CS Supply for SWCC - Under Loading at Yanbu	CS Supply for SWCC - Under Offloading at Shuhaiba
SHAHZAD AHMAD SIRAJ AHMAD KHAN	2634188631	PAKISTAN	573685786	219SLF22	TLS	أ س س S S A 1193	25-07-2027		L-EMP0615	KSA - Local Supplies	SA Supply for PRC - Under Loading at Yanbu	SA Supply for PRC - Under Loading at Yanbu	SA Supply for PRC - Under Offloading at Rabigh	SA Supply for TRONOX - Under Loading at Yanbu
MOHD MOHSEN KHAN	2634188532	INDIA	555325046		TLS	أ ر ك K R A 8478	24-07-2027		L-EMP0616	KSA - Local Supplies	Coming Back to Yanbu	Arrived Yanbu	SBS Supply for MWSPC - Under Loading at Yanbu	SBS Supply for MWSPC - On the way to Ras Al Khair
AALAMGEER	2634189274	INDIA	579612154		TLS	أ س س S S A 1194			L-EMP0618		Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu
MUSTAK	2634189381	INDIA	579614750		TLS	أ س س S S A 1194			L-EMP0619	KSA - Local Supplies	At Yanbu	At Yanbu	At Yanbu	At Yanbu
PARAVEJ ALAM	2634189530	INDIA	502500957		TLS	أ س س S S A 1194			L-EMP0620	KSA - Local Supplies	At Yanbu	At Yanbu	At Yanbu	At Yanbu
KAMRAN ELLAHI ELLAHI BAKHSH	2594959245	PAKISTAN	502911856		TLS	أ س ح J S A 8751	24-07-2027		L-EMP0621	KSA - Local Supplies	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu	Truck Under Maintenance at Yanbu
IQBAL HOSSAIN	2601876291	BANGLADESH	571651516	4004010	TLS	أ س ح J S A 8752			L-EMP0622	KSA - Local Supplies	 Internal Transfer / Material Transfer for Port	 Internal Transfer	 Internal Transfer / METEL SHEET Supply for AL MAHMOOD - Under Loading at Yanbu	 Internal Transfer
JAVID KHAN	2635431444	PAKISTAN	570140037	141HCL19	TLS	أ س س S S A 1198	25-12-2027		L-EMP0623	KSA - Local Supplies	HCL Supply for MWSPC - Under Loading at Yanbu	HCL Supply for MWSPC - On the way to Turaif	HCL Supply for MWSPC - Under Offloading at Turaif	Coming Back to Yanbu
MUHAMMAD MADNI	2635431741	PAKISTAN	551667907		TLS	أ ح د D J A 4828			L-EMP0624	KSA - Local Supplies	At Yanbu	At Yanbu	At Yanbu	At Yanbu
SAEED AHMAD	2636058030	PAKISTAN	552163821		TLS				L-EMP0629		At Yanbu	At Yanbu	At Yanbu	At Yanbu
SHAHZAD AMIR	2636169167	PAKISTAN	534593695		TLS				L-EMP0630		At Yanbu	At Yanbu	At Yanbu	At Yanbu
SHASHIKANT KUMAR		INDIA			TLS				L-EMP0647		At Yanbu	At Yanbu	At Yanbu	At Yanbu
WALEED		PAKISTAN			TLS				L-EMP0652		At Yanbu	At Yanbu	At Yanbu	At Yanbu
MUHAMMAD ASLAM		PAKISTAN	573448047		TLS				L-EMP0653		At Yanbu	At Yanbu	At Yanbu	At Yanbu
PERVAIZ AHMAD MURAD ALI KHAN		PAKISTAN			TLS				L-EMP0658		At Yanbu	At Yanbu	At Yanbu	At Yanbu
MUSHTAQ HUSSAIN ALI REHMAT		PAKISTAN			TLS				L-EMP0659		At Yanbu	At Yanbu	At Yanbu	At Yanbu
SABIR HUSSAIN MUHAMMAD RAMZAN		PAKISTAN			TLS				L-EMP0660		At Yanbu	At Yanbu	At Yanbu	At Yanbu
FAYIZ IJAZ MUHAMMAD		PAKISTAN			TLS				L-EMP0651		At Yanbu	At Yanbu	At Yanbu	At Yanbu
ARIF ANSARI		INDIA			TLS				L-EMP0661		At Yanbu	At Yanbu	At Yanbu	At Yanbu
MUHAMMAD ABRAR		PAKISTAN			TLS				L-EMP0665		At Yanbu	At Yanbu	At Yanbu	At Yanbu`;

export const SEED_OCTOBER_1_4_MANIFESTS: Record<string, Record<number, string>> =
  parseMultiDayManifest(SAMPLE_OCTOBER_1_4_MANIFEST_TEXT, ALL_84_DRIVERS, '2026-10').manifestByDate;

