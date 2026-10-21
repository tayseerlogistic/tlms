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
  for (const group of groups) {
    for (const rowValue of group.rows) {
      if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) { skippedRows++; continue; }
      const row = rowValue as Record<string, unknown>;
      const rawPlate = row['Truck Plate#'] ?? row['Truck Plate'] ?? row.truckPlate ?? row.plateNo ?? row.vehicle ?? row.Plate ?? row.veh ?? row.plate ?? '';
      const plate = resolvePlate(String(rawPlate));
      const rawKm = row['Total KM/M'] ?? row['Total KM'] ?? row.totalKm ?? row.km ?? row.KM ?? row.distance;
      const kmText = String(rawKm ?? '').replace(/,/g, '').trim();
      const kmVal = Number(kmText);
      if (!plate || !Number.isFinite(kmVal) || kmVal < 0) { skippedRows++; continue; }
      const rowMonth = monthKeyToISO(row.month ?? row.Month ?? row.period ?? row.Period, fallbackYear);
      const rawDate = String(row.date ?? row.Date ?? '').trim();
      if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !isValidISODate(rawDate)) { skippedRows++; continue; }
      const date = rawDate && isValidISODate(rawDate) ? rawDate : `${rowMonth || group.month}-15`;
      const rawOdometer = Number(String(row.odometer ?? row.Odometer ?? '').replace(/,/g, '').trim());
      records.push({
        date,
        veh: plate,
        // Monthly distance uploads are not odometer measurements. Keep odo empty unless supplied.
        odometer: Number.isFinite(rawOdometer) && rawOdometer > 0 ? rawOdometer : null,
        km: kmVal,
        notes: `Uploaded monthly KM summary (${rowMonth || group.month})`
      });
    }
  }
  if (!records.length) throw new Error('No valid rows found. Each row needs a truck plate and a non-negative KM value; dates must be valid ISO dates.');
  const months = Array.from(new Set(records.map(record => record.date.slice(0, 7)))).sort();
  return { records, months, skippedRows };
}
