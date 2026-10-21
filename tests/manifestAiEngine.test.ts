import assert from 'node:assert/strict';
import test from 'node:test';
import { trainManifestAiModel } from '../src/utils/manifestAiEngine.ts';
import type { Driver } from '../src/types/index.ts';

test('retraining the same history and manifests does not inflate learned rule hits', () => {
  const driver: Driver = {
    id: 'driver-1', seq: 1, name: 'Driver A', nameNorm: 'DRIVER A', empNo: 'E-1', iqama: '1234567890',
    nationality: 'Saudi', mobile: '', transporter: '', workingFor: '', status: 'AVAILABLE',
    assignedTruckId: null, assignedVehiclePlate: null, active: true,
    history: { '2026-10-01': 'At Yanbu' }
  };
  const manifests = { '2026-10-01': { 'driver-1': 'At Yanbu' } };
  const first = trainManifestAiModel([driver], {}, manifests, []);
  const second = trainManifestAiModel([driver], {}, manifests, first.rules);

  assert.equal(first.stats.totalTripsIngested, 1);
  assert.equal(second.stats.totalTripsIngested, 1);
  assert.equal(first.rules.find(rule => rule.driverId === driver.id && rule.result === 'At Yanbu')?.hits, 1);
  assert.equal(second.rules.find(rule => rule.driverId === driver.id && rule.result === 'At Yanbu')?.hits, 1);
});
