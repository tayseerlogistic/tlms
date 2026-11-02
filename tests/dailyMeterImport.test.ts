import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDailyMeters,dailyMeterExport} from '../src/utils/dailyMeterImport';
import type {Truck,KmRecord} from '../src/types';
const trucks=[{id:'t1',plate:'D J A 4827'},{id:'t2',plate:'D J A 4828'}] as Truck[];
test('one-column meters need full fleet count and explicit order acknowledgement',()=>{
 assert.throws(()=>parseDailyMeters([['Opening KM'],[203425],[282426]],trucks,'2026-11-01'),/confirmation/);
 assert.throws(()=>parseDailyMeters([[203425]],trucks,'2026-11-01',true),/exactly 2/);
 assert.deepEqual(parseDailyMeters([['Opening KM'],[203425],[282426]],trucks,'2026-11-01',true).map(row=>[row.truckId,row.odometer]),[['t1',203425],['t2',282426]]);
});
test('plate-labelled imports match identities independent of row order and preserve real zero',()=>{
 const result=parseDailyMeters([['Truck Plate#','Opening KM','Date'],['DJA4828','0','2026-11-01'],['DJA4827','203,425','2026-11-01']],trucks,'2026-11-01');
 assert.deepEqual(result.map(row=>[row.truckId,row.odometer]),[['t1',203425],['t2',0]]);
});
test('rejects wrong dates, duplicates, unmatched trucks and invalid numeric readings',()=>{
 for(const rows of [
  [['Truck Plate#','Opening KM','Date'],['DJA4827',100,'2026-10-31']],
  [['Truck Plate#','Opening KM'],['DJA4827',100],['DJA4827',200]],
  [['Truck Plate#','Opening KM'],['UNKNOWN',100]],
  [['Truck Plate#','Opening KM'],['DJA4827',-1]],
  [['Truck Plate#','Opening KM'],['DJA4827','123abc']],
 ])assert.throws(()=>parseDailyMeters(rows,trucks,'2026-11-01'));
});
test('export includes every truck for exactly the selected date and round-trips meters only',()=>{
 const records=[{truckId:'t1',date:'2026-11-01',odometerKm:203425,distanceKm:700},{truckId:'t2',date:'2026-10-31',odometerKm:282426,distanceKm:20}] as KmRecord[];
 const output=dailyMeterExport(trucks,records,'2026-11-01');
 assert.equal(output.length,2);assert.equal(output[0]['Opening KM'],203425);
 assert.equal(output[0]['Daily KM Run'],700);assert.equal(output[1]['Opening KM'],null);
 const keys=Object.keys(output[0]);
 const imported=parseDailyMeters([keys,...output.map(row=>keys.map(key=>row[key as keyof typeof row]))],trucks,'2026-11-01');
 assert.deepEqual(imported,[{truckId:'t1',plate:'D J A 4827',odometer:203425}]);
 assert.equal(records[0].distanceKm,700);
});
