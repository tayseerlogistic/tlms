import assert from 'node:assert/strict';
import test from 'node:test';
import { latestRecordedKmMonth, monthKeyToISO, parseMonthlyKmUpload } from '../src/utils/kmImportUtils.ts';

const resolvePlate = (raw: string) => {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
  return ({ 'DJA4827': 'D J A 4827', 'KRA7501': 'K R A 7501' } as Record<string, string>)[normalized] || '';
};

test('latest recorded KM month ignores invalid dates and selects the newest populated month', () => {
  assert.equal(latestRecordedKmMonth([
    { date: '2026-01-01' },
    { date: '2026-08-31' },
    { date: '2026-03-15' },
    { date: '2026-09-31' },
    { date: 'not-a-date' }
  ]), '2026-08');
  assert.equal(latestRecordedKmMonth([{ date: 'not-a-date' }]), null);
  assert.equal(latestRecordedKmMonth([]), null);
});

test('month parser accepts year-month, month-year, full month names, and abbreviations', () => {
  assert.equal(monthKeyToISO('2026-08', 2026), '2026-08');
  assert.equal(monthKeyToISO('08/2026', 2026), '2026-08');
  assert.equal(monthKeyToISO('August 2026', 2026), '2026-08');
  assert.equal(monthKeyToISO('Sep 2025', 2026), '2025-09');
  assert.equal(monthKeyToISO('October', 2026), '2026-10');
  assert.equal(monthKeyToISO('2026-13', 2026), null);
});

test('one JSON file imports rows for multiple months and retains exact KM totals', () => {
  const parsed = parseMonthlyKmUpload(JSON.stringify({
    'August 2026': [{ 'Truck Plate#': 'D J A 4827', 'Total KM/M': '15,400' }],
    'September 2026': [{ 'Truck Plate#': 'K R A 7501', 'Total KM/M': 12800 }]
  }), '2026-10', resolvePlate, 2026);
  assert.equal(parsed.records.length, 2);
  assert.deepEqual(parsed.months, ['2026-08', '2026-09']);
  assert.equal(parsed.records[0].km, 15400);
  assert.equal(parsed.records[0].date, '2026-08-15');
  assert.equal(parsed.records[1].date, '2026-09-15');
  assert.equal(parsed.records[0].odometer, null, 'monthly distance must not create a fake odometer reading');
  assert.equal(parsed.skippedRows, 0);
});

test('row-level month metadata overrides the containing JSON group', () => {
  const parsed = parseMonthlyKmUpload(JSON.stringify({
    'August 2026': [{ 'Truck Plate#': 'D J A 4827', km: 1000, month: '2026-10' }]
  }), '2026-08', resolvePlate, 2026);
  assert.equal(parsed.records[0].date, '2026-10-15');
  assert.deepEqual(parsed.months, ['2026-10']);
});

test('wide fleet exports import each daily KM value and skip invalid negative readings', () => {
  const parsed = parseMonthlyKmUpload(JSON.stringify({
    'January - 2026': [{
      'Truck Plate#': 'D J A 4827',
      '1-Jan': 946,
      '2-Jan': 0,
      '31-Jan': 35,
      'Total KM/M': 17203
    }],
    'March- 2026': [{
      'Truck Plate#': 'K R A 7501',
      '2026-03-01 00:00:00': 34,
      '2026-03-02 00:00:00': 0,
      '2026-03-17 00:00:00': -418000,
      'Total KM/M': 15593,
      'Unnamed: 0': 0
    }]
  }), '2026-10', resolvePlate, 2026);

  assert.equal(parsed.records.length, 5);
  assert.deepEqual(parsed.months, ['2026-01', '2026-03']);
  assert.equal(parsed.records[0].date, '2026-01-01');
  assert.equal(parsed.records[0].km, 946);
  assert.equal(parsed.records[1].date, '2026-01-02');
  assert.equal(parsed.records[1].km, 0);
  assert.equal(parsed.records[2].date, '2026-01-31');
  assert.equal(parsed.records[3].date, '2026-03-01');
  assert.equal(parsed.records[3].km, 34);
  assert.equal(parsed.records[3].odometer, null);
  assert.equal(parsed.skippedRows, 1);
});

test('invalid plate, negative KM, and impossible ISO date rows are skipped', () => {
  const parsed = parseMonthlyKmUpload(JSON.stringify({
    '2026-08': [
      { 'Truck Plate#': 'D J A 4827', km: 500 },
      { 'Truck Plate#': 'UNKNOWN', km: 500 },
      { 'Truck Plate#': 'K R A 7501', km: -2 },
      { 'Truck Plate#': 'K R A 7501', km: 100, date: '2026-02-30' }
    ]
  }), '2026-08', resolvePlate, 2026);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.skippedRows, 3);
});

test('invalid JSON and data without month groups return useful errors', () => {
  assert.throws(() => parseMonthlyKmUpload('{bad json', '2026-08', resolvePlate, 2026), /Invalid JSON/);
  assert.throws(() => parseMonthlyKmUpload('{"label":"no records"}', '2026-08', resolvePlate, 2026), /must be an array/);
});
