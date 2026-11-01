import { ksaDateISO } from './dateUtils';
import * as XLSX from 'xlsx';
import type { Driver } from '../types';
import { parseMultiDayManifest, type MultiDayParseResult } from './multiDayManifestParser';

/** Preview only: skip dispatch tabs and preserve canonical driver identities. */
export function parseManifestWorkbook(workbook: XLSX.WorkBook, drivers: Driver[], cutoff = ksaDateISO()): MultiDayParseResult {
  const result: MultiDayParseResult = { detectedDates: [], mappedDriversCount: 0, totalEntriesCount: 0, entries: [], unmatchedLines: [], manifestByDate: {} };
  const matched = new Set<number>();
  const conflicts = new Set<string>();
  for (const name of workbook.SheetNames) {
    if (/schedule/i.test(name)) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
    const header = rows.findIndex(row => row.some(cell => /^iqama/i.test(String(cell))));
    if (header < 0) continue;
    const headerDate = (value: unknown): string | null => {
      if (typeof value === 'number' && value > 30000 && value < 90000) {
        const epoch = workbook.Workbook?.WBProps?.date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
        return new Date(epoch + Math.floor(value) * 86400000).toISOString().slice(0, 10);
      }
      if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      return null;
    };
    const headers = rows[header].map(value => headerDate(value) || String(value || ''));
    if (!rows[header].some(value => headerDate(value))) continue;
    if (/^SL/i.test(headers[0]) && !headers[1]?.trim()) headers[1] = 'Driver Name';
    // Expiry columns are identity metadata, never manifest days.
    const text = [headers.join('\t'), ...rows.slice(header + 1).map(row => headers.map((_, index) =>
      row[index] instanceof Date ? '' : String(row[index] ?? '').replace(/[\t\r\n]+/g, ' ')
    ).join('\t'))].join('\n');
    const parsed = parseMultiDayManifest(text, drivers);
    parsed.entries.forEach(entry => matched.add(entry.driverIndex));
    result.entries.push(...parsed.entries);
    result.unmatchedLines.push(...parsed.unmatchedLines.map(line => `${name}: ${line}`));
    for (const [date, tags] of Object.entries(parsed.manifestByDate)) {
      if (date > cutoff) continue; // Future plan cells are not historical observations.
      const existing = result.manifestByDate[date] ||= {};
      for (const [id, tag] of Object.entries(tags)) {
        const key = `${date}:${id}`;
        if (conflicts.has(key)) continue;
        if (existing[id] !== undefined && existing[id] !== tag) {
          delete existing[id];
          conflicts.add(key);
          result.unmatchedLines.push(`Conflicting sheets: ${date}, ${id}. Both statuses omitted; review original workbook.`);
        } else existing[id] = tag;
      }
    }
  }
  result.manifestByDate = Object.fromEntries(Object.entries(result.manifestByDate).filter(([, tags]) => Object.keys(tags).length));
  result.detectedDates = Object.keys(result.manifestByDate).sort();
  result.entries = [...new Map(result.entries.map(entry => [entry.driverIndex, entry])).values()].map(entry => ({
    ...entry,
    tagsByDate: Object.fromEntries(Object.entries(result.manifestByDate)
      .filter(([, tags]) => tags[drivers[entry.driverIndex].id] !== undefined)
      .map(([date, tags]) => [date, tags[drivers[entry.driverIndex].id]]))
  }));
  result.mappedDriversCount = matched.size;
  result.totalEntriesCount = Object.values(result.manifestByDate).reduce((sum, tags) => sum + Object.keys(tags).length, 0);
  if (!result.totalEntriesCount) throw new Error('No dated manifest sheets found. Upload the original workbook with date headers.');
  return result;
}
