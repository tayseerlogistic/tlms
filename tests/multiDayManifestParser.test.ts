import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHeaderDate, parseMultiDayManifest } from '../src/utils/multiDayManifestParser';
import type { Driver } from '../src/types';

test('numbered spreadsheet with Name header and pasted UI instructions maps stable driver IDs', () => {
  const drivers = [
    { id: 'driver-a', name: 'FIRST DRIVER', iqama: '1234567890', empNo: 'L-EMP0001' },
    { id: 'driver-b', name: 'SECOND DRIVER', iqama: '', empNo: 'L-EMP0002' },
  ] as Driver[];
  const result = parseMultiDayManifest([
    'Paste daily manifests with dates like Thursday 1, Friday 2.',
    'Driver Name • Iqama # • Employee No.',
    'SL#\t Name\tIqama #\tEmployee No.\tThursday, 1\tFriday, 2',
    '1\tFIRST DRIVER\t1234567890\tL-EMP0001\tAt Yanbu\tLoading',
    '2\tSECOND DRIVER\t\tL-EMP0002\tVacation\t',
  ].join('\n'), drivers, '2026-10');
  assert.equal(result.mappedDriversCount, 2);
  assert.equal(result.totalEntriesCount, 3);
  assert.deepEqual(result.unmatchedLines, []);
  assert.deepEqual(result.detectedDates, ['2026-10-01', '2026-10-02']);
  assert.deepEqual(result.manifestByDate['2026-10-01'], {
    'driver-a': 'At Yanbu', 'driver-b': 'Vacation',
  });
});

test('date labels cannot be arbitrary descriptive text or driver identifiers', () => {
  assert.equal(parseHeaderDate('Instructions for Thursday, 1'), null);
  assert.equal(parseHeaderDate('L-EMP0024'), null);
  assert.equal(parseHeaderDate('1 Oct', '2026-09'), '2026-10-01');
  assert.equal(parseHeaderDate('1 Unknown'), null);
});
