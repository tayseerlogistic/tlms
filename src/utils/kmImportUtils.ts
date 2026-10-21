import type { KmRecord } from '../types';
import { isValidISODate } from './dateUtils';

export function monthKeyToISO(value: unknown, fallbackYear = new Date().getFullYear()): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let match = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(raw);
  if (match) {
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? `${match[1]}-${String(month).padStart(2, '0')}` : null;
  }
  match = /^(\d{1,2})[-/](\d{4})$/.exec(raw);
  if (match) {
    const month = Number(match[1]);
    return month >= 1 && month <= 12 ? `${match[2]}-${String(month).padStart(2, '0')}` : null;
  }
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const normalized = raw.toLowerCase();
  const monthIndex = monthNames.findIndex(name => normalized.includes(name) || normalized.slice(0, 3) === name.slice(0, 3));
  if (monthIndex < 0) return null;
  const yearMatch = normalized.match(/(?:19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : fallbackYear;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export interface ParsedMonthlyKmImport {
  records: Array<Omit<KmRecord, 'id'>>;
  months: string[];
  skippedRows: number;
}

export function parseMonthlyKmUpload(
  jsonText: string,
  fallbackMonth: string,
  resolvePlate: (rawPlate: string) => string,
  fallbackYear = Number(fallbackMonth.slice(0, 4))
): ParsedMonthlyKmImport {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(fallbackMonth)) throw new Error('Fallback month must use YYYY-MM format.');
  let data: unknown;
  try { data = JSON.parse(jsonText); }
  catch (error) { throw new Error('Invalid JSON: ' + (error instanceof Error ? error.message : String(error))); }
  const groups: Array<{ month: string; rows: unknown[] }> = [];
  if (Array.isArray(data)) {
    groups.push({ month: fallbackMonth, rows: data });
  } else if (data && typeof data === 'object') {
    const root = (data as Record<string, unknown>).months;
    if (root && typeof root === 'object' && !Array.isArray(root)) {
      Object.entries(root as Record<string, unknown>).forEach(([key, value]) => {
        if (Array.isArray(value)) groups.push({ month: monthKeyToISO(key, fallbackYear) || fallbackMonth, rows: value });
      });
    } else if (Array.isArray((data as Record<string, unknown>).records)) {
      groups.push({ month: fallbackMonth, rows: (data as Record<string, unknown>).records as unknown[] });
    } else {
      Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
        if (Array.isArray(value)) groups.push({ month: monthKeyToISO(key, fallbackYear) || fallbackMonth, rows: value });
      });
    }
  }
  if (!groups.length) throw new Error('JSON must be an array of records or an object whose month keys contain arrays of records.');

  const records: Array<Omit<KmRecord, 'id'>> = [];
  let skippedRows = 0;

  // Accept the two common wide-table day-header formats found in fleet exports:
  // "1-Jan" and timestamp-like Excel headers such as "2026-03-01 00:00:00".
  const dayColumnToISO = (column: string, groupMonth: string): string | null => {
    const raw = column.trim();
    let match = /^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/.exec(raw);
    if (match) return isValidISODate(match[1]) ? match[1] : null;

    match = /^(\d{1,2})[-/]([A-Za-z]{3,})$/.exec(raw);
    if (match) {
      const year = Number(groupMonth.slice(0, 4));
      const headerMonth = monthKeyToISO(`${match[2]} ${year}`, year);
      const day = Number(match[1]);
      if (!headerMonth || headerMonth !== groupMonth) return null;
      const date = `${headerMonth}-${String(day).padStart(2, '0')}`;
      return isValidISODate(date) ? date : null;
    }

    match = /^(?:day\s*)?(\d{1,2})$/i.exec(raw);
    if (match) {
      const date = `${groupMonth}-${String(Number(match[1])).padStart(2, '0')}`;
      return isValidISODate(date) ? date : null;
    }
    return null;
  };

  for (const group of groups) {
    for (const rowValue of group.rows) {
      if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) { skippedRows++; continue; }
      const row = rowValue as Record<string, unknown>;
      const rawPlate = row['Truck Plate#'] ?? row['Truck Plate'] ?? row.truckPlate ?? row.plateNo ?? row.vehicle ?? row.Plate ?? row.veh ?? row.plate ?? '';
      const plate = resolvePlate(String(rawPlate));
      if (!plate) { skippedRows++; continue; }

      const dailyColumns = Object.keys(row)
        .map(column => ({ column, date: dayColumnToISO(column, group.month) }))
        .filter((item): item is { column: string; date: string } => item.date !== null);

      // When a row contains day columns, import each daily distance and ignore the
      // monthly total column. These are KM-run values, not cumulative odometer readings.
      if (dailyColumns.length > 0) {
        for (const item of dailyColumns) {
          const rawValue = row[item.column];
          if (rawValue == null || String(rawValue).trim() === '') continue;
          const kmText = String(rawValue).replace(/,/g, '').trim();
          const kmVal = Number(kmText);
          if (!Number.isFinite(kmVal) || kmVal < 0) { skippedRows++; continue; }
          records.push({
            date: item.date,
            veh: plate,
            odometer: null,
            km: kmVal,
            notes: `Imported daily KM (${item.date.slice(0, 7)})`
          });
        }
        continue;
      }

      // Backward-compatible fallback for summary-style rows with no daily columns.
      const rawKm = row['Total KM/M'] ?? row['Total KM'] ?? row.totalKm ?? row.km ?? row.KM ?? row.distance;
      const kmText = String(rawKm ?? '').replace(/,/g, '').trim();
      const kmVal = Number(kmText);
      if (!Number.isFinite(kmVal) || kmVal < 0) { skippedRows++; continue; }
      const rowMonth = monthKeyToISO(row.month ?? row.Month ?? row.period ?? row.Period, fallbackYear);
      const rawDate = String(row.date ?? row.Date ?? '').trim();
      const parsedDate = /^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/.exec(rawDate)?.[1] ?? '';
      if (parsedDate && !isValidISODate(parsedDate)) { skippedRows++; continue; }
      const date = parsedDate && isValidISODate(parsedDate) ? parsedDate : `${rowMonth || group.month}-15`;
      const rawOdometerText = String(row.odometer ?? row.Odometer ?? '').replace(/,/g, '').trim();
      const rawOdometer = rawOdometerText ? Number(rawOdometerText) : Number.NaN;
      records.push({
        date,
        veh: plate,
        // A monthly distance summary is not an odometer measurement.
        odometer: Number.isFinite(rawOdometer) && rawOdometer > 0 ? rawOdometer : null,
        km: kmVal,
        notes: `Uploaded monthly KM summary (${rowMonth || group.month})`
      });
    }
  }
  if (!records.length) throw new Error('No valid KM readings found. Each row needs a truck plate and either dated daily KM values or a non-negative monthly KM total.');
  const months = Array.from(new Set(records.map(record => record.date.slice(0, 7)))).sort();
  return { records, months, skippedRows };
}
