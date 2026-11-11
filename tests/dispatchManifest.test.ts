import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestActivity, manifestForTrips, normalizeDispatchParties, scheduleManifestTags, scheduleRowsForDriver } from '../src/utils/dispatchManifest';
import { predictManifestForDriver } from '../src/utils/manifestAiEngine';
import type { Driver, TimetableRow } from '../src/types';
const driver = { id: 'driver-a', name: 'DRIVER A', iqama: '1234567890', assignedVehiclePlate: 'ABC 1234' } as Driver;
const trip = (patch: Partial<TimetableRow> = {}) => ({ id: 'trip-1', driverId: driver.id, driverName: driver.name, source: 'Yanbu', destination: 'Jubail', commodity: 'CS / 25 MT', supplier: '', customer: 'Customer A', ...patch }) as TimetableRow;

test('all trips, including identical repeat trips, survive prediction and persisted tag grouping', () => {
  const rows = [trip({supplier: 'TRONOX', customer: ''}), trip({id:'trip-2',source:'TPF',destination:'TLS'}), trip({id:'trip-3'}), trip({id:'trip-4'})];
  const expected = 'CS Collection from TRONOX / Internal Transfer / CS Supply for Customer A - Under Loading at Yanbu / CS Supply for Customer A - Under Loading at Yanbu';
  assert.equal(manifestForTrips(rows), expected);
  assert.equal(scheduleManifestTags(rows)[driver.id], expected);
  assert.equal(predictManifestForDriver(0,driver,'2026-11-01',rows,'',[]).text,expected);
});

test('supplier depends on commodity and loading direction; refinery deliveries remain deliveries', () => {
  assert.equal(manifestActivity(trip({supplier:'YASREF',commodity:'Molten Sulphur / 25 MT',customer:''})), 'Molten Sulphur Collection from YASREF');
  assert.equal(manifestActivity(trip({supplier:'YASREF',commodity:'Sulphur / 25 MT',customer:''})), 'Sulphur Collection from YASREF');
  assert.equal(manifestActivity(trip({source:'TLS',destination:'TRONOX',customer:'TRONOX'})), 'CS Supply for TRONOX - Under Loading at TLS');
  assert.equal(normalizeDispatchParties(trip({source:'YASREF',commodity:'Sulphur'})).supplier,'YASREF');
  assert.equal(normalizeDispatchParties(trip({source:'YASREF',commodity:'Sulphuric Acid'})).supplier,'');
});

test('internal transfer is exact and takes priority over commodity or party', () => {
  for (const [source,destination] of [['TLS','TPF'],['TPF','TLS'],['TLS-TPF',''],['TPF-TLS','']]) {
    assert.equal(manifestActivity(trip({source,destination,supplier:'TRONOX'})),'Internal Transfer');
  }
  assert.notEqual(manifestActivity(trip({source:'TLS',destination:'Jubail'})),'Internal Transfer');
});

test('stable driver ID overrides shared plates and names; iqama overrides name', () => {
  assert.equal(scheduleRowsForDriver(driver,[trip({driverId:'other',plateNo:driver.assignedVehiclePlate!})]).length,0);
  assert.equal(scheduleRowsForDriver(driver,[trip({driverId:null,iqama:'9999999999'})]).length,0);
  assert.equal(scheduleRowsForDriver(driver,[trip({driverId:null,iqama:driver.iqama,driverName:'Changed spelling'})]).length,1);
  assert.equal(scheduleRowsForDriver(driver,[trip({driverId:null,driverName:'DRIVER'})]).length,0);
});

test('confirmed text is preserved and multi-activity history never invents a single next stage', () => {
  assert.equal(predictManifestForDriver(0,driver,'2026-11-01',[trip()],'',[],'Manually reviewed').text,'Manually reviewed');
  const prior='CS Collection from TRONOX / HCL Supply for X - Under Loading at Yanbu';
  const suggestion=predictManifestForDriver(0,driver,'2026-11-01',[],prior,[]);
  assert.equal(suggestion.text,prior);assert.equal(suggestion.conf,'low');
});

test('manifest uses follow-up customer codes while dispatch keeps the original customer', () => {
  for (const [customer, code] of [
    ['Saudi Arabian Mining Co.', 'SWCC'], ['National Battery Company', 'NBC'],
    ['National Batteries Company', 'NBC'], ['Petro- Rabigh Alky plant', 'PRC'],
    ['Petro Rabigh Company', 'PRC'], ['Rabigh Power Company', 'RPC'],
    ['Saudi Arabian Mining Company - Maaden (WH)', 'MWSPC'], ['Petro Rabigh Other', 'Petro Rabigh Other']
  ]) {
    const row = trip({customer});
    assert.equal(scheduleManifestTags([row])[driver.id], 'CS Supply for ' + code + ' - Under Loading at Yanbu');
    assert.equal(row.customer, customer);
  }
});

test('follow-up continues a full-name historical status with the manifest customer code', () => {
  const tag = 'CS Supply for Petro Rabigh - AP - Under Loading at Yanbu';
  const d = {...driver, history: {'2026-11-10': tag}};
  const predict = (confirmed?: string) => predictManifestForDriver(0, d, '2026-11-11', [], tag, [], confirmed, {schedules:{}});
  assert.equal(predict().text, 'CS Supply for PRC - On the way');
  assert.equal(predict(tag).text, tag);
});
