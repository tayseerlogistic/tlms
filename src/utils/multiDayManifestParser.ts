// =====================================================================
// Multi-Day Daily Manifest Parser & Synchronizer Engine
// Ingests multi-date driver manifests from spreadsheets & exports
// =====================================================================

import { Driver } from '../types';

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
  manifestByDate: Record<string, Record<string, string>>; // date -> { stable driver ID -> tag }
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

  const manifestByDate: Record<string, Record<string, string>> = {};
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
          manifestByDate[dCol.dateStr][matchedDriver.id || String(matchedDriverIndex)] = cleanedTag;
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
// Empty format example; paste actual historical data explicitly.
export const SAMPLE_OCTOBER_1_4_MANIFEST_TEXT = `Driver Name\tIqama #\tThursday, 1\tFriday, 2\tSaturday, 3\tSunday, 4`;
