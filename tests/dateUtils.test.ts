import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidISODate, ksaDateISO, shiftISODate, shiftISOMonth } from '../src/utils/dateUtils.ts';

test('KSA business date changes at midnight in Riyadh, not UTC midnight', () => {
  assert.equal(ksaDateISO(new Date('2026-10-20T20:59:59.000Z')), '2026-10-20');
  assert.equal(ksaDateISO(new Date('2026-10-20T21:00:00.000Z')), '2026-10-21');
});

test('ISO day shifting handles month, year, and leap-year boundaries', () => {
  assert.equal(shiftISODate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftISODate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftISODate('2026-12-31', 1), '2027-01-01');
});

test('month shifting rolls across years', () => {
  assert.equal(shiftISOMonth('2026-01-01', -1), '2025-12');
  assert.equal(shiftISOMonth('2026-12-01', 1), '2027-01');
});

test('ISO date validator rejects impossible dates', () => {
  assert.equal(isValidISODate('2024-02-29'), true);
  assert.equal(isValidISODate('2026-02-30'), false);
  assert.equal(isValidISODate('20-01-2026'), false);
});
