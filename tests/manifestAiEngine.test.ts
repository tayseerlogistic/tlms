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

test('training correlates every scheduled trip without counting the same daily observation twice', async () => {
  const { predictManifestForDriver } = await import('../src/utils/manifestAiEngine.ts');
  const driver = { id:'d1',name:'Driver A',history:{} } as Driver;
  const schedule = { '2026-10-01': { date:'2026-10-01', rows:[
    {id:'a',driverId:'d1',source:'Yanbu',destination:'Yanbu',supplier:'TRONOX',commodity:'CS'},
    {id:'b',driverId:'d1',source:'TPF',destination:'TLS',commodity:'SOP'},
  ] }};
  const tag='CS Collection from TRONOX / Internal Transfer';
  const result=trainManifestAiModel([driver],schedule as any,{'2026-10-01':{d1:tag}});
  assert.equal(result.rules[0].hits,1);
  assert.equal(result.rules[0].keys.length,2);
  assert.equal(predictManifestForDriver(0,driver,'2026-11-01',[],'',[
    {driverId:'d1',driverIndex:0,driverName:'Driver A',keys:[],result:'CS Supply for Old Customer',hits:50,lastSeen:'2025-01-01'}
  ]).text,'At Yanbu');
});
